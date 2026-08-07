-- Bird Rebels: Storm Watch — game store
CREATE TABLE IF NOT EXISTS games (
  id           TEXT PRIMARY KEY,      -- 6-digit game number
  player_count INTEGER NOT NULL,
  state        TEXT NOT NULL,         -- full game state as JSON
  rev          INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,      -- epoch ms
  updated_at   INTEGER NOT NULL       -- epoch ms (used for 7-day cleanup)
);

CREATE INDEX IF NOT EXISTS idx_games_updated ON games (updated_at);
