/**
 * Past games.
 *
 * Only what a player wants: what happened, when, and a way to watch it again.
 * Backing up to a file is a maintenance job, not a game feature, so it lives in
 * Settings — JSON is how this app stores things, not something to hand someone
 * mid-browse.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'

import { Icon } from '../components/Icon'
import { DIFFICULTY_PRESETS, describeResult } from '../engine/types'
import { getHistoryStore } from '../storage'
import type { GameRecord } from '../storage/types'

export function HistoryPage() {
  const [games, setGames] = useState<GameRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const store = await getHistoryStore()
      setGames(await store.listGames())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setGames([])
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const onDelete = useCallback(
    async (id: string) => {
      const store = await getHistoryStore()
      await store.deleteGame(id)
      await reload()
    },
    [reload]
  )

  return (
    <>
      <h1 className="page__title">Lịch sử ván đấu</h1>
      <p className="page__lede">
        Toàn bộ ván đấu được lưu trên máy này.
      </p>

      {error && <div className="banner banner--error">{error}</div>}

      {games === null && <p className="muted">Đang tải…</p>}

      {games && games.length === 0 && (
        <div className="card empty">
          Chưa có ván nào được lưu. <Link to="/play">Chơi một ván</Link> và nó sẽ xuất hiện ở
          đây.
        </div>
      )}

      {games && games.length > 0 && (
        <div className="game-list">
          {games.map((g) => (
            <div className="game-row" key={g.id}>
              <div className="game-row__main">
                <div className="game-row__title">
                  {describeResult(
                    g.result === 'unfinished' ? 'playing' : g.result,
                    g.reason
                  )}
                  {g.result === 'unfinished' && ' — chưa kết thúc'}
                </div>
                <div className="muted">
                  {new Date(g.createdAt).toLocaleString('vi-VN')} · {g.moveCount} nước
                  {g.difficulty && ` · mức ${DIFFICULTY_PRESETS[g.difficulty].label}`}
                </div>
              </div>
              <span className="badge">{g.mode === 'pve' ? 'Đấu máy' : 'Hai người'}</span>
              <Link className="btn" to={`/review/${g.id}`}>
                <Icon name="play" /> Xem lại
              </Link>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => void onDelete(g.id)}
                aria-label="Xóa ván này"
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
