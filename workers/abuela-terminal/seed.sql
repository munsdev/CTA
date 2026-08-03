-- ============================================================================
-- Abuela terminal — seed content
--
-- Everything here is authored. The tone target is section 6 of the canon
-- reference: restrained, terse, computer output. No personality flourishes,
-- no warmth in the literal text. The warmth is entirely in the dramatic irony
-- of a system named after someone's grandmother producing clipped machine
-- output — so the console must never wink at it.
--
-- Spanish bodies are populated where the line is short and confident enough
-- to be worth committing to. Where they're absent the console falls back to
-- body_en, which matches the current draft state of the manuscript.
-- ============================================================================

INSERT INTO content_meta (id, version, updated_at) VALUES (1, 1, unixepoch());

-- ---------------------------------------------------------------------------
-- Flags
-- ---------------------------------------------------------------------------
INSERT INTO flags (key, label_en, label_es, sort_order, trigger_note, spoiler) VALUES
  ('clear',  'No flags',           'Sin banderas',      0, 'Nominal. Monitoring only.', 0),
  ('flag_1', 'Flag 1 — record',    'Bandera 1 — acta',  1, 'A federal report was logged as an official record.', 0),
  ('flag_2', 'Flag 2 — pattern',   'Bandera 2 — patrón',2, 'Independent pattern recognition. Not yet reported.', 0),
  ('flag_3', 'Flag 3 — acquisition','Bandera 3 — adquisición', 3, 'Privately funded. Objective is control, not exposure.', 1),
  ('detonated', 'Terminal',        'Terminal',          4, 'Full disclosure executed.', 1);

-- ---------------------------------------------------------------------------
-- Commands
--
-- Spanish primary, English aliases. unlocked_at_flag gates what the client is
-- allowed to know exists — the manifest sent on boot is filtered by the
-- session's flag_state, so command names never leak ahead of the player.
-- ---------------------------------------------------------------------------
INSERT INTO commands (name, aliases, args_spec, handler, help_en, help_es, unlocked_at_flag, sort_order) VALUES
  ('ayuda',    '["help","?","h"]',           NULL,        'static', 'List available commands.',                 'Lista de comandos disponibles.',   0,  10),
  ('estado',   '["status","stat"]',          NULL,        'state',  'System status.',                           'Estado del sistema.',              0,  20),
  ('banderas', '["flags"]',                  NULL,        'state',  'Detection flags.',                         'Banderas de detección.',           0,  30),
  ('riesgo',   '["risk"]',                   NULL,        'state',  'Detection risk assessment.',               'Evaluación de riesgo.',            0,  40),
  ('varianza', '["variance","var"]',         '[valor]',   'action', 'Read or adjust conservation variance.',    'Leer o ajustar la varianza.',      0,  50),
  ('reservas', '["reserves","pools"]',       NULL,        'state',  'Reservoir levels by tier.',                'Niveles de reserva por nivel.',    0,  60),
  ('cinta',    '["tape","ticker"]',          NULL,        'static', 'Recent edits. The tape is always running.','Ediciones recientes.',             0,  70),
  ('consultar','["query","lookup","q"]',     '<proveedor>','ledger','Query a supplier ledger.',                 'Consultar el libro de un proveedor.',0, 80),
  ('proveedores','["suppliers","vendors"]',  NULL,        'ledger', 'List known suppliers.',                    'Lista de proveedores conocidos.',  0,  90),
  ('papel',    '["paper"]',                  '[clave]',   'asset',  'Physical records. Not rewritable.',        'Registros físicos. No reescribibles.',0,100),
  ('glosario', '["glossary","gloss"]',       NULL,        'static', 'Terms encountered so far.',                'Términos encontrados.',            0, 110),
  ('nodos',    '["nodes","map"]',            NULL,        'state',  'Trail topology.',                          'Topología de rastros.',            1, 120),
  ('investigadores','["investigators","who"]',NULL,       'state',  'Active investigations.',                   'Investigaciones activas.',         1, 130),
  ('codigo',   '["code","unlock"]',          '<codigo>',  'action', 'Redeem a code from the printed edition.',  'Canjear un código impreso.',       0, 140),
  ('detonar',  '["detonate"]',               NULL,        'action', 'Full disclosure. Irreversible.',           'Divulgación total. Irreversible.',  3, 150),
  ('limpiar',  '["clear","cls"]',            NULL,        'static', 'Clear the screen.',                        'Limpiar la pantalla.',             0, 160);

-- ---------------------------------------------------------------------------
-- Responses bound to commands
-- ---------------------------------------------------------------------------
INSERT INTO responses (command_id, match_mode, body_en, body_es, ack, typing_ms)
SELECT id, 'command',
  'ABUELA — pricing and ledger system. Uptime 41,208h.
Operating continuously. No external interface.
Type a command. Unrecognized input is discarded.',
  'ABUELA — sistema de precios y libros. Actividad 41.208h.
Operación continua. Sin interfaz externa.
Escriba un comando. La entrada no reconocida se descarta.',
  NULL, 10
FROM commands WHERE name = 'ayuda';

INSERT INTO responses (command_id, match_mode, body_en, body_es, ack, typing_ms)
SELECT id, 'command',
  'The tape is always running. Sample follows.',
  'La cinta siempre corre. Muestra a continuación.',
  'Acknowledged.', 8
FROM commands WHERE name = 'cinta';

INSERT INTO responses (command_id, match_mode, body_en, body_es, ack, typing_ms)
SELECT id, 'command',
  'Screen cleared.', 'Pantalla limpia.', NULL, 4
FROM commands WHERE name = 'limpiar';

INSERT INTO responses (command_id, match_mode, body_en, body_es, ack, typing_ms)
SELECT id, 'command',
  'Terms recorded during this session. The list grows as you encounter them.',
  'Términos registrados en esta sesión. La lista crece al encontrarlos.',
  NULL, 8
FROM commands WHERE name = 'glosario';

-- ---------------------------------------------------------------------------
-- Keyword responses — the near-miss layer.
--
-- These exist mostly to catch people typing at the machine instead of
-- operating it. Canon is explicit that Abuela is not conversational and no
-- one ever talks to it, so the correct answer to conversation is a flat
-- refusal, not a chatty deflection. The refusal IS the characterization.
-- ---------------------------------------------------------------------------
INSERT INTO responses (trigger, match_mode, priority, body_en, body_es, ack) VALUES
  ('who are you|what are you|are you alive|are you real|hello|hola', 'regex', 10,
   'Not a conversational system.', 'No es un sistema conversacional.', NULL),

  ('abuela', 'contains', 20,
   'Designation only. The name is not a reference the system can resolve.',
   'Solo designación. El nombre no es una referencia que el sistema pueda resolver.', NULL),

  ('who built you|creator|hacker|owner', 'regex', 20,
   'No operator record. This console has one user and keeps no log of them.',
   'Sin registro de operador. Esta consola tiene un usuario y no lo registra.', NULL),

  ('why|purpose|what do you do', 'regex', 30,
   'Prices are set by algorithms. Algorithms are editable.',
   'Los precios los fijan algoritmos. Los algoritmos son editables.', NULL),

  ('stop|shut down|turn off|kill', 'regex', 30,
   'No stop condition defined.', 'Sin condición de parada definida.', NULL),

  ('money|steal|stealing|theft|rob', 'regex', 40,
   'Nothing is removed. Values are rewritten. The distinction is load-bearing.',
   'No se retira nada. Los valores se reescriben. La distinción es estructural.', NULL),

  ('paper|printed|physical', 'regex', 40,
   'Paper is outside scope. Paper cannot be rewritten. See: papel',
   'El papel está fuera de alcance. El papel no se reescribe. Ver: papel', NULL),

  ('262144|2^18|262,144', 'regex', 5,
   'No entry.', 'Sin entrada.', NULL);

-- The rejection pool. Rotated at random so repeated bad input doesn't produce
-- a stuck response, but every line is flat — one clipped sentence, no help
-- offered. A homebrew console does not have a natural-language layer and
-- should not pretend to.
INSERT INTO responses (trigger, match_mode, priority, body_en, body_es, variants) VALUES
  (NULL, 'fallback', 999, 'Unrecognized.', 'No reconocido.',
   '["Unrecognized.","No entry.","Discarded.","Not a command.","No.","Input does not resolve."]');

-- ---------------------------------------------------------------------------
-- Glossary
-- ---------------------------------------------------------------------------
INSERT INTO glossary (term_es, gloss_en, note, first_seen_in, unlocked_at_flag) VALUES
  ('bandera',    'flag',        'A detection event the system is tracking against itself.', 'banderas', 0),
  ('varianza',   'variance',    'Deliberate imprecision. Perfect conservation is a signature.', 'varianza', 0),
  ('reserva',    'reservoir',   'Value pooled in the luxury tier, available to draw against later.', 'reservas', 0),
  ('cinta',      'tape',        'The running record of individual edits.', 'cinta', 0),
  ('papel',      'paper',       'Physical record. The one medium outside the system''s reach.', 'papel', 0),
  ('proveedor',  'supplier',    NULL, 'proveedores', 0),
  ('acta',       'record',      'An entry that has been logged officially. Logging is what makes it dangerous.', 'banderas', 1),
  ('rastro',     'trail',       NULL, 'nodos', 1),
  ('adquisición','acquisition', 'Not exposure. Control.', 'banderas', 3),
  ('divulgación','disclosure',  'Everything, at once, on the operator''s terms.', 'detonar', 3);

-- ---------------------------------------------------------------------------
-- Suppliers — the authored spine
--
-- Marcus's five. Their flagged deltas sum to exactly $262,144 across the
-- period, matching to a fraction of a percent across five independent
-- vendors. Per canon this is mentioned once and never explained: the console
-- surfaces the number in a reconciliation total and offers no comment on it.
-- Nothing anywhere else references it.
-- ---------------------------------------------------------------------------
INSERT INTO suppliers (code, name, tier, region, thread, note_en) VALUES
  ('LX-4417', 'Meridian Stone & Tile',     'luxury',    'CA', 'marcus', 'Estate supplier. Household books.'),
  ('LX-4419', 'Coastal Atelier Millwork',  'luxury',    'CA', 'marcus', 'Estate supplier.'),
  ('LX-4423', 'Vermeer Glass Partners',    'luxury',    'CA', 'marcus', 'Estate supplier.'),
  ('LX-4431', 'Anselm Interiors Supply',   'luxury',    'CA', 'marcus', 'Estate supplier.'),
  ('LX-4442', 'Rowan & Pike Provisioning', 'luxury',    'CA', 'marcus', 'Estate supplier. Also services salon trade.'),
  ('ES-8801', 'Northline Coffee Import',   'essential', 'MN', 'rose',   'Raw material. Cost rose in lockstep.'),
  ('ES-8804', 'Granite Falls Packaging',   'essential', 'MN', 'rose',   'Packaging. Offsets a bump that never landed.'),
  ('ES-8812', 'Continental Hospitality and Travel', 'essential', 'MN', 'rose', 'Appears in catering and executive travel lines both.'),
  ('SH-0001', 'Registered Agent — Florida','shell',     'FL', 'root',   'Convergence point. Structure is sloppy by nature, not by error.');

-- Marcus's thread: the synchronized deltas.
--   61204.19 + 48930.77 + 55118.42 + 44672.05 + 52218.57 = 262144.00
INSERT INTO ledger_entries (supplier_id, period, amount, delta, mode, flagged, note_en)
SELECT id, '2025-FY', 1284900.00, 61204.19, 'A', 1, NULL FROM suppliers WHERE code = 'LX-4417';
INSERT INTO ledger_entries (supplier_id, period, amount, delta, mode, flagged, note_en)
SELECT id, '2025-FY',  982340.00, 48930.77, 'A', 1, NULL FROM suppliers WHERE code = 'LX-4419';
INSERT INTO ledger_entries (supplier_id, period, amount, delta, mode, flagged, note_en)
SELECT id, '2025-FY', 1105770.00, 55118.42, 'A', 1, NULL FROM suppliers WHERE code = 'LX-4423';
INSERT INTO ledger_entries (supplier_id, period, amount, delta, mode, flagged, note_en)
SELECT id, '2025-FY',  897120.00, 44672.05, 'A', 1, NULL FROM suppliers WHERE code = 'LX-4431';
INSERT INTO ledger_entries (supplier_id, period, amount, delta, mode, flagged, note_en)
SELECT id, '2025-FY', 1047880.00, 52218.57, 'A', 1, NULL FROM suppliers WHERE code = 'LX-4442';

-- Rose's thread: mode B. The coffee cost rises to hold a price flat elsewhere.
INSERT INTO ledger_entries (supplier_id, period, amount, delta, mode, flagged, note_en)
SELECT id, '2025-Q3', 214600.00,  18240.00, 'B', 1, 'Offset. Counterparty held flat.' FROM suppliers WHERE code = 'ES-8801';
INSERT INTO ledger_entries (supplier_id, period, amount, delta, mode, flagged, note_en)
SELECT id, '2025-Q3', 187330.00,  18239.60, 'B', 1, 'Near-perfect lockstep. Variance 0.002%.' FROM suppliers WHERE code = 'ES-8804';
INSERT INTO ledger_entries (supplier_id, period, amount, delta, mode, flagged, note_en)
SELECT id, '2025-Q3',  96410.00,   3120.00, 'B', 0, 'Appears twice in unrelated budget lines.' FROM suppliers WHERE code = 'ES-8812';

-- ---------------------------------------------------------------------------
-- Paper. R2 objects are not uploaded yet — these rows describe what belongs
-- there. /papel lists them; requesting one that has no object behind it
-- reports the absence rather than erroring, so the console is playable before
-- the scans exist.
-- ---------------------------------------------------------------------------
INSERT INTO assets (key, r2_key, kind, caption_en, caption_es, unlocked_at_flag) VALUES
  ('agente',   'paper/fl-registered-agent.jpg', 'scan', 'Registered agent filing. Florida. Photographed, not exported.', 'Acta de agente registrado. Florida.', 0),
  ('factura',  'paper/salon-invoice.jpg',       'scan', 'Salon trade invoice. Printed at point of sale.',               'Factura del oficio. Impresa en el punto de venta.', 0),
  ('lccn',     'paper/lccn-budget-line.jpg',    'scan', 'Printed budget line. Catering and travel, same vendor.',       'Línea de presupuesto impresa.', 1),
  ('nota',     'paper/handwritten-note.jpg',    'scan', 'Handwritten. No digital counterpart exists.',                  'Manuscrito. No existe contraparte digital.', 2);

-- ---------------------------------------------------------------------------
-- Book codes. Replace before the printed edition ships.
-- ---------------------------------------------------------------------------
INSERT INTO unlock_codes (code, grants, note) VALUES
  ('GARDENER', 'full', 'Placeholder. Back matter, near the glossary.');
