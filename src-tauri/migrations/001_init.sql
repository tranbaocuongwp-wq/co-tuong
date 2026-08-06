-- Local game history for the desktop build.
--
-- A game is stored as its starting position plus the move list, not as a board
-- snapshot per ply: that is compact, and replaying it through the engine is the
-- only representation that cannot disagree with the rules.

CREATE TABLE IF NOT EXISTS games (
  id            TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  ended_at      INTEGER,
  red_player    TEXT NOT NULL,          -- 'human' | 'ai'
  black_player  TEXT NOT NULL,
  difficulty    TEXT,                   -- 'easy' | 'medium' | 'hard' | 'master'
  result        TEXT NOT NULL,          -- 'redWin' | 'blackWin' | 'draw' | 'unfinished'
  reason        TEXT,                   -- 'checkmate' | 'stalemate' | 'resign' | ...
  start_fen     TEXT NOT NULL,
  moves         TEXT NOT NULL,          -- space-separated ICCS
  final_fen     TEXT,
  move_count    INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER NOT NULL DEFAULT 0,
  app_version   TEXT
);

CREATE INDEX IF NOT EXISTS games_created_at ON games (created_at DESC);
CREATE INDEX IF NOT EXISTS games_result ON games (result);

-- Exactly one row, holding the game currently in progress so closing the app
-- mid-game never loses it.
CREATE TABLE IF NOT EXISTS in_progress (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  updated_at    INTEGER NOT NULL,
  payload       TEXT NOT NULL           -- JSON game record
);

-- Key/value settings and the serialized experience book.
CREATE TABLE IF NOT EXISTS app_state (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    INTEGER NOT NULL
);
