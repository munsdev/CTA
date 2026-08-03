-- ============================================================================
-- Abuela terminal — D1 schema
--
-- Apply with:
--   wrangler d1 execute abuela-terminal-db --remote --file=schema.sql
--   wrangler d1 execute abuela-terminal-db --remote --file=seed.sql
--
-- Two rules shape this schema:
--
-- 1. Every piece of player-visible text carries body_en AND body_es. The
--    novel's intent is Spanish log entries with an English glossary in the
--    back matter, but the drafted scene text is still English placeholder.
--    Both columns exist from day one so switching the console to Spanish is
--    a render-time decision, not a migration.
--
-- 2. Nothing story-critical is generated. The LLM fills the long tail of
--    unrecognized input; every authored line, flag transition, and ledger
--    anomaly is a row here.
-- ============================================================================

DROP TABLE IF EXISTS content_meta;
DROP TABLE IF EXISTS commands;
DROP TABLE IF EXISTS responses;
DROP TABLE IF EXISTS flags;
DROP TABLE IF EXISTS glossary;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS session_log;
DROP TABLE IF EXISTS llm_cache;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS ledger_entries;
DROP TABLE IF EXISTS unlock_codes;

-- ---------------------------------------------------------------------------
-- Cache-bust. The client fetches /api/boot on load, compares version against
-- its cached value, and only re-pulls the command manifest on a mismatch.
-- Same pattern as kyr-content.
-- ---------------------------------------------------------------------------
CREATE TABLE content_meta (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  version    INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- The flag ladder. This is the whole progression: three flags and the
-- detonation. flag_state on a session is an index into sort_order.
--
-- spoiler = 1 means the row's label is withheld from the client until the
-- session has been unlocked with a code from the book. The console still
-- renders the slot — a visibly locked flag is better theatre than a hidden
-- one — but the label and trigger_note stay server-side.
-- ---------------------------------------------------------------------------
CREATE TABLE flags (
  key          TEXT PRIMARY KEY,
  label_en     TEXT NOT NULL,
  label_es     TEXT NOT NULL,
  sort_order   INTEGER NOT NULL,
  trigger_note TEXT,
  spoiler      INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Commands. The console bundles only the commands unlocked at the session's
-- current flag_state — tab-completion works, but command names are plot and
-- don't leak ahead of the player.
--
-- handler tells the Worker how to answer:
--   static  — look up rows in `responses`
--   state   — computed from session state (estado, riesgo, banderas)
--   ledger  — query suppliers/ledger_entries + procedural filler
--   asset   — stream a paper scan out of R2
--   action  — mutates session state (detonar, and the unlock command)
-- ---------------------------------------------------------------------------
CREATE TABLE commands (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL UNIQUE,
  aliases          TEXT NOT NULL DEFAULT '[]',  -- JSON array, incl. English forms
  args_spec        TEXT,
  handler          TEXT NOT NULL DEFAULT 'static',
  help_en          TEXT,
  help_es          TEXT,
  unlocked_at_flag INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Responses. One table serves both exact commands and loose keyword matching:
-- a command is just an exact-match trigger, so there is one matcher rather
-- than two code paths.
--
-- match_mode:
--   command  — bound to commands.id, matched on the parsed verb
--   exact    — whole normalized input equals trigger
--   contains — trigger appears anywhere in normalized input
--   regex    — trigger is a JS regex source
--   fallback — the rejection pool, matched when nothing else does
--
-- ack is the flat second line of the book's established two-beat rhythm
-- ("Flag 1 initiated. Monitoring." / "Acknowledged."). Making it a column
-- rather than trailing text in body means the cadence is structural.
-- ---------------------------------------------------------------------------
CREATE TABLE responses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id    INTEGER REFERENCES commands(id) ON DELETE CASCADE,
  trigger       TEXT,
  match_mode    TEXT NOT NULL DEFAULT 'command',
  priority      INTEGER NOT NULL DEFAULT 100,
  body_en       TEXT NOT NULL,
  body_es       TEXT,
  ack           TEXT,
  variants      TEXT NOT NULL DEFAULT '[]',  -- JSON array of alternate body_en
  typing_ms     INTEGER NOT NULL DEFAULT 12,
  requires_flag INTEGER NOT NULL DEFAULT 0,
  sets_flag     INTEGER,
  asset_key     TEXT,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_responses_command ON responses(command_id);
CREATE INDEX idx_responses_mode ON responses(match_mode, priority);

-- ---------------------------------------------------------------------------
-- Glossary. Terms accumulate as the player meets them, so the back-matter
-- glossary from the book becomes something you assemble by playing rather
-- than a static appendix.
-- ---------------------------------------------------------------------------
CREATE TABLE glossary (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  term_es          TEXT NOT NULL UNIQUE,
  gloss_en         TEXT NOT NULL,
  note             TEXT,
  first_seen_in    TEXT,
  unlocked_at_flag INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Sessions.
--
-- variance is the conservation-slop gauge and the one real mechanic. Canon:
-- the system deliberately does NOT balance its books precisely, because
-- perfect conservation is mathematically fingerprintable. So the danger zone
-- is at ZERO, not at the extremes. Operating drifts variance down toward
-- zero; the player has to reintroduce slop or detection risk climbs.
--
-- risk is derived (flag_state + low variance + investigator proximity) but
-- cached here so the console has one number to render and the Worker isn't
-- recomputing it on every panel poll.
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  flag_state INTEGER NOT NULL DEFAULT 0,
  unlocked   INTEGER NOT NULL DEFAULT 0,   -- book code redeemed
  detonated  INTEGER NOT NULL DEFAULT 0,
  variance   REAL NOT NULL DEFAULT 0.42,   -- percent; 0 is fatal, not ideal
  risk       INTEGER NOT NULL DEFAULT 4,   -- 0-100
  vars       TEXT NOT NULL DEFAULT '{}',   -- JSON scratch (seen assets, etc.)
  llm_calls  INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Every input, matched or not. The miss log is the highest-value table here:
-- a terminal lives or dies on coverage, and this is the only honest way to
-- find the gaps. The admin surfaces source='miss' rows for promotion into
-- authored `responses`.
-- ---------------------------------------------------------------------------
CREATE TABLE session_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  input       TEXT NOT NULL,
  matched_id  INTEGER,
  source      TEXT NOT NULL DEFAULT 'static',  -- static | llm | miss | blocked
  flag_state  INTEGER NOT NULL DEFAULT 0,
  at          INTEGER NOT NULL
);

CREATE INDEX idx_log_source ON session_log(source, at DESC);
CREATE INDEX idx_log_session ON session_log(session_id, at);

-- ---------------------------------------------------------------------------
-- Generated long-tail responses, keyed by normalized input. Everyone types
-- the same things, so this makes generation cost trend toward zero: the first
-- visitor to type something pays for it, everyone after reads the cache.
-- promoted=1 marks rows already turned into authored `responses` by the admin.
-- ---------------------------------------------------------------------------
CREATE TABLE llm_cache (
  input_hash TEXT PRIMARY KEY,
  input_norm TEXT NOT NULL,
  body_en    TEXT NOT NULL,
  uses       INTEGER NOT NULL DEFAULT 1,
  promoted   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Paper. Rows here point at R2 objects; the console never gets a direct
-- bucket URL, only /paper/<key> through the Worker.
-- ---------------------------------------------------------------------------
CREATE TABLE assets (
  key              TEXT PRIMARY KEY,
  r2_key           TEXT NOT NULL,
  kind             TEXT NOT NULL DEFAULT 'scan',  -- scan | image | audio | file
  caption_en       TEXT,
  caption_es       TEXT,
  unlocked_at_flag INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- The authored ledger spine. Story-critical vendors are rows; everything else
-- the console shows is generated around them from a fixed seed, so the world
-- feels bottomless while you only author what matters.
--
-- thread: which investigation surfaces this vendor —
--   marcus  (California estate/luxury supplier manipulation)
--   rose    (Minnesota raw-material/packaging offset)
--   root    (the Florida shell both trails converge on)
-- ---------------------------------------------------------------------------
CREATE TABLE suppliers (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  code     TEXT NOT NULL UNIQUE,
  name     TEXT NOT NULL,
  tier     TEXT NOT NULL DEFAULT 'luxury',   -- luxury | essential | shell
  region   TEXT,
  thread   TEXT,
  note_en  TEXT,
  active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE ledger_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  period      TEXT NOT NULL,
  amount      REAL NOT NULL,
  delta       REAL NOT NULL DEFAULT 0,
  mode        TEXT NOT NULL DEFAULT 'A',     -- A: direct  B: price-holding
  flagged     INTEGER NOT NULL DEFAULT 0,
  note_en     TEXT
);

CREATE INDEX idx_ledger_supplier ON ledger_entries(supplier_id);

-- ---------------------------------------------------------------------------
-- Codes printed in the book's back matter, near the glossary. Redeeming one
-- unlocks Flag 3 and the detonation ending. Paper is the one thing Abuela
-- can't rewrite, so gating the ending behind a physical page is the joke and
-- the theme at the same time.
-- ---------------------------------------------------------------------------
CREATE TABLE unlock_codes (
  code       TEXT PRIMARY KEY,
  grants     TEXT NOT NULL DEFAULT 'full',
  note       TEXT,
  redeemed   INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1
);
