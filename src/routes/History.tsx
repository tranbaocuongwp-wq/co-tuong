/**
 * Game history, plus the JSON export/import that lets a game leave the device.
 *
 * Nothing is uploaded anywhere: sharing means the player exports a file and
 * sends it themselves. That keeps the app genuinely offline while still letting
 * a game be handed to someone else or carried to another machine.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { describeResult } from '../engine/types'
import { engineVersion } from '../engine/wasm'
import {
  deserializeGames,
  downloadJson,
  getHistoryStore,
  serializeGames,
  suggestedFilename,
} from '../storage'
import type { GameRecord } from '../storage/types'

export function HistoryPage() {
  const [games, setGames] = useState<GameRecord[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const onExportAll = useCallback(() => {
    if (!games || games.length === 0) return
    downloadJson(suggestedFilename(), serializeGames(games, engineVersion()))
    setNotice(`Đã xuất ${games.length} ván ra tệp JSON.`)
  }, [games])

  const onExportOne = useCallback((game: GameRecord) => {
    // A single game exports as the game object itself, so the file is readable
    // on its own and can be re-imported without unwrapping.
    downloadJson(suggestedFilename(game), JSON.stringify(game, null, 2))
  }, [])

  const onImport = useCallback(
    async (file: File) => {
      setError(null)
      setNotice(null)
      try {
        const text = await file.text()
        const imported = deserializeGames(text)
        const store = await getHistoryStore()
        for (const g of imported) await store.saveGame(g)
        await reload()
        setNotice(`Đã nhập ${imported.length} ván từ "${file.name}".`)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [reload]
  )

  return (
    <>
      <h1 className="page__title">Lịch sử ván đấu</h1>
      <p className="page__lede">
        Toàn bộ dữ liệu nằm trên máy bạn. Xuất ra JSON để lưu trữ hoặc gửi cho người khác xem
        lại.
      </p>

      {error && <div className="banner banner--error">{error}</div>}
      {notice && <div className="banner">{notice}</div>}

      <div className="btn-row" style={{ marginBottom: 18 }}>
        <button
          type="button"
          className="btn"
          onClick={onExportAll}
          disabled={!games || games.length === 0}
        >
          Xuất tất cả (JSON)
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Nhập từ tệp JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onImport(file)
            // Reset so choosing the same file twice still fires a change event.
            e.target.value = ''
          }}
        />
      </div>

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
                  {g.difficulty && ` · ${g.difficulty}`}
                </div>
              </div>
              <span className="badge">{g.mode === 'pve' ? 'Đấu máy' : 'Hai người'}</span>
              <Link className="btn" to={`/review/${g.id}`}>
                Xem lại
              </Link>
              <button type="button" className="btn" onClick={() => onExportOne(g)}>
                Xuất
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => void onDelete(g.id)}
              >
                Xóa
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
