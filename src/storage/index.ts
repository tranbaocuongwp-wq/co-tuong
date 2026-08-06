/**
 * Picks the history store that fits the host, and holds the export/import
 * helpers that move games in and out of the app as JSON.
 */

import { isTauri } from '../engine/client'
import { DexieHistoryStore } from './dexie'
import type { ExportBundle, GameRecord, HistoryStore } from './types'
import { EXPORT_FORMAT, parseExportBundle } from './types'

let shared: HistoryStore | null = null

/**
 * The process-wide store: SQLite inside the desktop app, IndexedDB on the web.
 *
 * The SQLite module is imported lazily because it pulls in the Tauri SQL
 * plugin, which does not exist in a plain browser — a static import would break
 * the web build at load time.
 */
export async function getHistoryStore(): Promise<HistoryStore> {
  if (shared) return shared
  if (isTauri()) {
    const { SqliteHistoryStore } = await import('./sqlite')
    shared = new SqliteHistoryStore()
  } else {
    shared = new DexieHistoryStore()
  }
  return shared
}

export function buildExportBundle(games: GameRecord[], appVersion: string): ExportBundle {
  return {
    format: EXPORT_FORMAT,
    exportedAt: Date.now(),
    appVersion,
    games,
  }
}

/** Serialize games to the JSON text written to a downloaded file. */
export function serializeGames(games: GameRecord[], appVersion: string): string {
  return JSON.stringify(buildExportBundle(games, appVersion), null, 2)
}

/**
 * Parse a JSON file back into games.
 *
 * Every field is validated (see `parseExportBundle`) because this is the one
 * place untrusted data enters the app.
 */
export function deserializeGames(text: string): GameRecord[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Tệp không phải JSON hợp lệ.')
  }
  return parseExportBundle(parsed)
}

/** Trigger a browser download. Works identically in the Tauri webview. */
export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Release the object URL on the next tick, once the click has been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function suggestedFilename(game?: GameRecord): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return game ? `co-tuong-van-${stamp}.json` : `co-tuong-lich-su-${stamp}.json`
}

export * from './types'
