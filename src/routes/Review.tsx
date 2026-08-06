/**
 * Replay a saved game.
 *
 * The board is rebuilt by replaying the move list through the engine up to the
 * chosen ply, rather than by storing a position per move. It is the same code
 * path that validated the game when it was played, so a review can never show a
 * position the rules would not allow.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'

import { Board } from '../components/Board'
import { MoveList } from '../components/MoveList'
import type { MoveInfo, Piece, StatusInfo } from '../engine/types'
import { describeResult } from '../engine/types'
import { loadEngineWasm, WasmGame } from '../engine/wasm'
import { useSettings } from '../settings'
import { getHistoryStore } from '../storage'
import type { GameRecord } from '../storage/types'

export function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const { settings } = useSettings()

  const [game, setGame] = useState<GameRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ply, setPly] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [moveTexts, setMoveTexts] = useState<string[]>([])

  const moves = useMemo(
    () => (game?.moves ? game.moves.split(/\s+/).filter(Boolean) : []),
    [game]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await loadEngineWasm()
        if (cancelled) return
        setReady(true)
        const store = await getHistoryStore()
        const found = id ? await store.getGame(id) : null
        if (cancelled) return
        if (!found) {
          setError('Không tìm thấy ván đấu này.')
          return
        }
        setGame(found)
        setPly(found.moves ? found.moves.split(/\s+/).filter(Boolean).length : 0)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  // Full move list in Vietnamese, computed once per game.
  useEffect(() => {
    if (!ready || !game) return
    try {
      const g = WasmGame.fromMoves(game.startFen, game.moves)
      setMoveTexts(g.movesText() as string[])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [ready, game])

  // The board at the selected ply.
  const view = useMemo(() => {
    if (!ready || !game) return null
    try {
      const g = WasmGame.fromMoves(game.startFen, moves.slice(0, ply).join(' '))
      return {
        pieces: g.pieces() as Piece[],
        status: g.status() as StatusInfo,
        legalMoves: [] as MoveInfo[],
      }
    } catch {
      return null
    }
  }, [ready, game, moves, ply])

  // Autoplay.
  useEffect(() => {
    if (!playing) return
    if (ply >= moves.length) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => setPly((p) => Math.min(p + 1, moves.length)), 800)
    return () => clearTimeout(timer)
  }, [playing, ply, moves.length])

  const lastMove = useMemo(() => {
    if (!game || ply === 0 || !ready) return null
    try {
      // Ask the engine which squares the last played move connected, rather
      // than parsing the coordinates by hand here.
      const before = WasmGame.fromMoves(game.startFen, moves.slice(0, ply - 1).join(' '))
      const info = (before.legalMoves() as MoveInfo[]).find((m) => m.iccs === moves[ply - 1])
      return info
        ? {
            fromRow: info.fromRow,
            fromCol: info.fromCol,
            toRow: info.toRow,
            toCol: info.toCol,
          }
        : null
    } catch {
      return null
    }
  }, [game, moves, ply, ready])

  const step = useCallback(
    (delta: number) => {
      setPlaying(false)
      setPly((p) => Math.max(0, Math.min(moves.length, p + delta)))
    },
    [moves.length]
  )

  if (error) {
    return (
      <>
        <div className="banner banner--error">{error}</div>
        <Link className="btn" to="/history">
          Về lịch sử
        </Link>
      </>
    )
  }

  if (!game || !view) return <p className="muted">Đang tải ván đấu…</p>

  return (
    <>
      <h1 className="page__title">Xem lại ván đấu</h1>
      <p className="page__lede">
        {describeResult(game.result === 'unfinished' ? 'playing' : game.result, game.reason)} ·{' '}
        {new Date(game.createdAt).toLocaleString('vi-VN')} · {game.moveCount} nước
      </p>

      <div className="play">
        <div className="play__board">
          <Board
            pieces={view.pieces}
            legalMoves={[]}
            sideToMove={view.status.sideToMove}
            controllable={null}
            onMove={() => undefined}
            lastMove={lastMove}
            flipped={settings.flipped}
            inCheck={view.status.inCheck}
            disabled
            hint={null}
          />
        </div>

        <div className="play__side">
          <div className="card">
            <div className="status-line">
              <strong>
                Nước {ply} / {moves.length}
              </strong>
              {view.status.inCheck && <span className="badge badge--loss">Chiếu tướng</span>}
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => step(-moves.length)}>
                ⏮
              </button>
              <button type="button" className="btn" onClick={() => step(-1)} disabled={ply === 0}>
                ◀
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setPlaying((p) => !p)}
                disabled={ply >= moves.length}
              >
                {playing ? '⏸ Dừng' : '▶ Phát'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => step(1)}
                disabled={ply >= moves.length}
              >
                ▶
              </button>
              <button type="button" className="btn" onClick={() => step(moves.length)}>
                ⏭
              </button>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>Biên bản</h2>
            <MoveList
              moves={moveTexts}
              autoScroll={false}
              activeIndex={ply - 1}
              onSelect={(i) => {
                setPlaying(false)
                setPly(i + 1)
              }}
            />
          </div>

          <Link className="btn" to="/history">
            Về lịch sử
          </Link>
        </div>
      </div>
    </>
  )
}
