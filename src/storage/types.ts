/**
 * The saved-game format.
 *
 * A game is stored as its starting position plus the move list — never as a
 * board snapshot. Replaying the moves through the engine is the only
 * representation that cannot drift from the rules, it is far smaller, and it is
 * what makes review, export and re-import all the same operation.
 *
 * `FORMAT` is versioned because these files leave the app: a game exported
 * today must still open in a build from next year, and an unknown version has
 * to fail loudly rather than be misread.
 */

import type { Difficulty, EndReason, GameStatus } from '../engine/types'

export const GAME_FORMAT = 'cotuong.game.v1'
export const EXPORT_FORMAT = 'cotuong.export.v1'

export type GameResult = GameStatus | 'unfinished'

/**
 * One line the commentator actually said, and when.
 *
 * Kept with the game rather than thrown away because it is part of what the
 * game *was* — replaying a saved game without its commentary would replay a
 * different, quieter event. It is also what a later cloud sync would carry, so
 * it is recorded in the same shape it will be uploaded in.
 *
 * Only the line id is stored. The words live in the script and the audio lives
 * in R2, both keyed by that id, so copying either into every game record would
 * be storing the same sentence hundreds of times.
 */
export interface CommentaryEntry {
  /** Move number the line was spoken on; 0 before the first move. */
  ply: number
  /** Content-addressed line id, as used by the voice cache and R2. */
  id: string
  at: number
}

/**
 * A time the player leaned on the app rather than the board.
 *
 * Recorded because a win with five hints and five take-backs is a different
 * result from a win without them, and a history that hides the difference
 * flatters the player at the cost of being true. It is also what a leaderboard
 * would need to compare two games honestly.
 */
export interface AssistEntry {
  /** Move number this happened on. */
  ply: number
  kind: 'hint' | 'undo'
  /** For a hint, the move that was suggested. */
  iccs?: string
  at: number
}

export interface GameRecord {
  format: typeof GAME_FORMAT
  id: string
  createdAt: number
  endedAt: number | null
  mode: 'pve' | 'pvp'
  redPlayer: 'human' | 'ai'
  blackPlayer: 'human' | 'ai'
  difficulty: Difficulty | null
  result: GameResult
  reason: EndReason
  startFen: string
  /** Space-separated ICCS coordinates, e.g. "h2e2 h9g7". */
  moves: string
  finalFen: string
  moveCount: number
  durationMs: number
  appVersion: string
  /**
   * The player's own decision on whether this game may be shared. Games are
   * private by default; nothing leaves the device unless this is set and the
   * player exports or shares it explicitly.
   */
  shared: boolean
  /**
   * What the commentator said during this game, in order.
   *
   * Optional because games recorded before commentary existed have none, and
   * claiming otherwise in the type would push that lie into every reader.
   */
  commentary?: CommentaryEntry[]
  /**
   * Hints taken and moves taken back, in order.
   *
   * Optional for the same reason as `commentary`: games recorded before this
   * existed have none, and saying otherwise in the type would push that lie
   * into every reader.
   */
  assists?: AssistEntry[]
}

export interface ExportBundle {
  format: typeof EXPORT_FORMAT
  exportedAt: number
  appVersion: string
  games: GameRecord[]
}

export interface HistoryStore {
  readonly kind: 'sqlite' | 'indexeddb'
  saveGame(game: GameRecord): Promise<void>
  listGames(): Promise<GameRecord[]>
  getGame(id: string): Promise<GameRecord | null>
  deleteGame(id: string): Promise<void>
  clearGames(): Promise<void>
  saveInProgress(game: GameRecord | null): Promise<void>
  getInProgress(): Promise<GameRecord | null>
  getState(key: string): Promise<string | null>
  setState(key: string, value: string): Promise<void>
}

export function newGameId(): string {
  // `randomUUID` needs a secure context, which a file:// Tauri webview is not
  // always considered to be; fall back to a random hex string of equal spread.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID()
    } catch {
      /* fall through */
    }
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate an untrusted object as a `GameRecord`.
 *
 * Imported files come from outside the app, so every field is checked before it
 * reaches storage or the engine. A malformed file must produce a clear message,
 * not a corrupted history list.
 */
export function parseGameRecord(value: unknown, index = 0): GameRecord {
  const where = `Ván ${index + 1}`
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${where}: không phải một đối tượng JSON hợp lệ.`)
  }
  const raw = value as Record<string, unknown>
  if (raw.format !== GAME_FORMAT) {
    throw new Error(
      `${where}: định dạng "${String(raw.format)}" không được hỗ trợ (cần "${GAME_FORMAT}").`
    )
  }
  const str = (key: string, fallback = ''): string =>
    typeof raw[key] === 'string' ? (raw[key] as string) : fallback
  const num = (key: string, fallback = 0): number =>
    typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? (raw[key] as number) : fallback

  const startFen = str('startFen')
  if (!startFen) throw new Error(`${where}: thiếu thế cờ xuất phát.`)

  const moves = str('moves').trim()
  // The move list is the one field the engine will execute, so constrain its
  // shape here rather than discovering the problem during replay.
  if (moves && !/^([a-i][0-9][a-i][0-9])(\s+[a-i][0-9][a-i][0-9])*$/.test(moves)) {
    throw new Error(`${where}: danh sách nước đi sai định dạng.`)
  }

  return {
    format: GAME_FORMAT,
    id: str('id') || newGameId(),
    createdAt: num('createdAt', Date.now()),
    endedAt: typeof raw.endedAt === 'number' ? raw.endedAt : null,
    mode: raw.mode === 'pvp' ? 'pvp' : 'pve',
    redPlayer: raw.redPlayer === 'ai' ? 'ai' : 'human',
    blackPlayer: raw.blackPlayer === 'human' ? 'human' : 'ai',
    difficulty: (['easy', 'medium', 'hard', 'master'] as const).includes(
      raw.difficulty as Difficulty
    )
      ? (raw.difficulty as Difficulty)
      : null,
    result: (['redWin', 'blackWin', 'draw', 'playing', 'unfinished'] as const).includes(
      raw.result as GameResult
    )
      ? (raw.result as GameResult)
      : 'unfinished',
    reason: str('reason') as EndReason,
    startFen,
    moves,
    finalFen: str('finalFen'),
    moveCount: num('moveCount', moves ? moves.split(/\s+/).length : 0),
    durationMs: num('durationMs'),
    appVersion: str('appVersion', 'unknown'),
    shared: raw.shared === true,
    commentary: Array.isArray(raw.commentary)
      ? (raw.commentary as unknown[]).flatMap((e) => {
          if (typeof e !== 'object' || e === null) return []
          const entry = e as Record<string, unknown>
          if (typeof entry.id !== 'string') return []
          return [
            {
              ply: typeof entry.ply === 'number' ? entry.ply : 0,
              id: entry.id,
              at: typeof entry.at === 'number' ? entry.at : 0,
            },
          ]
        })
      : [],
    assists: Array.isArray(raw.assists)
      ? (raw.assists as unknown[]).flatMap((e) => {
          if (typeof e !== 'object' || e === null) return []
          const entry = e as Record<string, unknown>
          if (entry.kind !== 'hint' && entry.kind !== 'undo') return []
          return [
            {
              ply: typeof entry.ply === 'number' ? entry.ply : 0,
              kind: entry.kind,
              ...(typeof entry.iccs === 'string' ? { iccs: entry.iccs } : {}),
              at: typeof entry.at === 'number' ? entry.at : 0,
            },
          ]
        })
      : [],
  }
}

/** Validate an untrusted object as an export bundle, or a single game. */
export function parseExportBundle(value: unknown): GameRecord[] {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Tệp không phải JSON hợp lệ.')
  }
  const raw = value as Record<string, unknown>

  // A single exported game is also accepted, so a player can drop in one file.
  if (raw.format === GAME_FORMAT) return [parseGameRecord(raw)]

  if (raw.format !== EXPORT_FORMAT) {
    throw new Error(
      `Định dạng "${String(raw.format)}" không được hỗ trợ (cần "${EXPORT_FORMAT}").`
    )
  }
  if (!Array.isArray(raw.games)) throw new Error('Tệp thiếu danh sách ván đấu.')
  return raw.games.map((g, i) => parseGameRecord(g, i))
}
