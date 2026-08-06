/**
 * SQLite history store, used inside the Tauri desktop app.
 *
 * Preferred over IndexedDB there because the database file lives outside the
 * webview: clearing browsing data, or the webview reprovisioning itself after
 * an OS update, cannot take a player's game history with it.
 */

import Database from '@tauri-apps/plugin-sql'

import type { GameRecord, HistoryStore } from './types'
import { GAME_FORMAT } from './types'

/** Matches the migration registered in `src-tauri/src/lib.rs`. */
const DB_URL = 'sqlite:cotuong.db'

interface GameRow {
  id: string
  created_at: number
  ended_at: number | null
  red_player: string
  black_player: string
  difficulty: string | null
  result: string
  reason: string | null
  start_fen: string
  moves: string
  final_fen: string | null
  move_count: number
  duration_ms: number
  app_version: string | null
  mode: string | null
  shared: number | null
}

function rowToRecord(row: GameRow): GameRecord {
  return {
    format: GAME_FORMAT,
    id: row.id,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    mode: row.mode === 'pvp' ? 'pvp' : 'pve',
    redPlayer: row.red_player === 'ai' ? 'ai' : 'human',
    blackPlayer: row.black_player === 'human' ? 'human' : 'ai',
    difficulty: (row.difficulty as GameRecord['difficulty']) ?? null,
    result: row.result as GameRecord['result'],
    reason: (row.reason ?? '') as GameRecord['reason'],
    startFen: row.start_fen,
    moves: row.moves,
    finalFen: row.final_fen ?? '',
    moveCount: row.move_count,
    durationMs: row.duration_ms,
    appVersion: row.app_version ?? 'unknown',
    shared: row.shared === 1,
  }
}

export class SqliteHistoryStore implements HistoryStore {
  readonly kind = 'sqlite' as const
  private dbPromise: Promise<Database> | null = null

  private db(): Promise<Database> {
    if (!this.dbPromise) {
      this.dbPromise = Database.load(DB_URL).then(async (db) => {
        // Columns added after the first release. Migrations run before this
        // point, but adding them defensively keeps a database created by an
        // older build usable without a version bump.
        for (const sql of [
          "ALTER TABLE games ADD COLUMN mode TEXT NOT NULL DEFAULT 'pve'",
          'ALTER TABLE games ADD COLUMN shared INTEGER NOT NULL DEFAULT 0',
        ]) {
          try {
            await db.execute(sql)
          } catch {
            // Already present — SQLite has no "ADD COLUMN IF NOT EXISTS".
          }
        }
        return db
      })
    }
    return this.dbPromise
  }

  async saveGame(game: GameRecord): Promise<void> {
    const db = await this.db()
    await db.execute(
      `INSERT INTO games (id, created_at, ended_at, red_player, black_player, difficulty,
         result, reason, start_fen, moves, final_fen, move_count, duration_ms, app_version,
         mode, shared)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT(id) DO UPDATE SET
         ended_at=excluded.ended_at, result=excluded.result, reason=excluded.reason,
         moves=excluded.moves, final_fen=excluded.final_fen, move_count=excluded.move_count,
         duration_ms=excluded.duration_ms, shared=excluded.shared`,
      [
        game.id,
        game.createdAt,
        game.endedAt,
        game.redPlayer,
        game.blackPlayer,
        game.difficulty,
        game.result,
        game.reason,
        game.startFen,
        game.moves,
        game.finalFen,
        game.moveCount,
        game.durationMs,
        game.appVersion,
        game.mode,
        game.shared ? 1 : 0,
      ]
    )
  }

  async listGames(): Promise<GameRecord[]> {
    const db = await this.db()
    const rows = await db.select<GameRow[]>('SELECT * FROM games ORDER BY created_at DESC')
    return rows.map(rowToRecord)
  }

  async getGame(id: string): Promise<GameRecord | null> {
    const db = await this.db()
    const rows = await db.select<GameRow[]>('SELECT * FROM games WHERE id = $1', [id])
    return rows.length ? rowToRecord(rows[0]) : null
  }

  async deleteGame(id: string): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM games WHERE id = $1', [id])
  }

  async clearGames(): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM games')
  }

  async saveInProgress(game: GameRecord | null): Promise<void> {
    const db = await this.db()
    if (!game) {
      await db.execute('DELETE FROM in_progress WHERE id = 1')
      return
    }
    await db.execute(
      `INSERT INTO in_progress (id, updated_at, payload) VALUES (1, $1, $2)
       ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at, payload=excluded.payload`,
      [Date.now(), JSON.stringify(game)]
    )
  }

  async getInProgress(): Promise<GameRecord | null> {
    const db = await this.db()
    const rows = await db.select<{ payload: string }[]>(
      'SELECT payload FROM in_progress WHERE id = 1'
    )
    if (!rows.length) return null
    try {
      return JSON.parse(rows[0].payload) as GameRecord
    } catch {
      await db.execute('DELETE FROM in_progress WHERE id = 1')
      return null
    }
  }

  async getState(key: string): Promise<string | null> {
    const db = await this.db()
    const rows = await db.select<{ value: string }[]>(
      'SELECT value FROM app_state WHERE key = $1',
      [key]
    )
    return rows.length ? rows[0].value : null
  }

  async setState(key: string, value: string): Promise<void> {
    const db = await this.db()
    await db.execute(
      `INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      [key, value, Date.now()]
    )
  }
}
