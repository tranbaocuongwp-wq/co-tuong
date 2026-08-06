/**
 * IndexedDB history store, used by the browser/PWA build.
 *
 * Chosen over `localStorage` because a long game list plus the experience book
 * comfortably exceeds the 5 MB string quota, and because IndexedDB survives
 * being written to from a service-worker-backed offline session.
 */

import Dexie, { type Table } from 'dexie'

import type { GameRecord, HistoryStore } from './types'

interface StateRow {
  key: string
  value: string
  updatedAt: number
}

interface InProgressRow {
  id: number
  payload: string
  updatedAt: number
}

class CoTuongDb extends Dexie {
  games!: Table<GameRecord, string>
  state!: Table<StateRow, string>
  inProgress!: Table<InProgressRow, number>

  constructor() {
    super('co-tuong')
    this.version(1).stores({
      games: 'id, createdAt, result',
      state: 'key',
      inProgress: 'id',
    })
  }
}

export class DexieHistoryStore implements HistoryStore {
  readonly kind = 'indexeddb' as const
  private db = new CoTuongDb()

  async saveGame(game: GameRecord): Promise<void> {
    await this.db.games.put(game)
  }

  async listGames(): Promise<GameRecord[]> {
    return this.db.games.orderBy('createdAt').reverse().toArray()
  }

  async getGame(id: string): Promise<GameRecord | null> {
    return (await this.db.games.get(id)) ?? null
  }

  async deleteGame(id: string): Promise<void> {
    await this.db.games.delete(id)
  }

  async clearGames(): Promise<void> {
    await this.db.games.clear()
  }

  async saveInProgress(game: GameRecord | null): Promise<void> {
    if (!game) {
      await this.db.inProgress.delete(1)
      return
    }
    await this.db.inProgress.put({
      id: 1,
      payload: JSON.stringify(game),
      updatedAt: Date.now(),
    })
  }

  async getInProgress(): Promise<GameRecord | null> {
    const row = await this.db.inProgress.get(1)
    if (!row) return null
    try {
      return JSON.parse(row.payload) as GameRecord
    } catch {
      // A corrupt autosave should not block the app from starting.
      await this.db.inProgress.delete(1)
      return null
    }
  }

  async getState(key: string): Promise<string | null> {
    return (await this.db.state.get(key))?.value ?? null
  }

  async setState(key: string, value: string): Promise<void> {
    await this.db.state.put({ key, value, updatedAt: Date.now() })
  }
}
