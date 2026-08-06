/**
 * The playing screen.
 *
 * Owns three responsibilities beyond rendering: autosaving the game in progress
 * after every move, filing the finished game into history exactly once, and
 * feeding the result back to the engine's experience book.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { Board } from '../components/Board'
import { MoveList } from '../components/MoveList'
import { getEngineClient } from '../engine/client'
import type { SearchInfo } from '../engine/types'
import { DIFFICULTY_PRESETS, describeResult } from '../engine/types'
import { engineVersion } from '../engine/wasm'
import { useGame } from '../game/useGame'
import { useSettings } from '../settings'
import { getHistoryStore } from '../storage'
import type { GameRecord } from '../storage/types'
import { GAME_FORMAT, newGameId } from '../storage/types'

/** Key under which the experience book is persisted. */
const EXPERIENCE_KEY = 'engine.experience'

export function PlayPage() {
  const { settings } = useSettings()
  const game = useGame({
    mode: settings.mode,
    playerSide: settings.playerSide,
    difficulty: settings.difficulty,
  })

  const [gameId, setGameId] = useState(newGameId)
  const [hint, setHint] = useState<SearchInfo | null>(null)
  const [hintBusy, setHintBusy] = useState(false)
  const [shared, setShared] = useState(false)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  /** Ensures a finished game is filed once, not once per re-render. */
  const filedRef = useRef<string | null>(null)

  const { projection, status, isOver, thinking, lastInfo } = game
  const preset = DIFFICULTY_PRESETS[settings.difficulty]

  const record = useMemo<GameRecord>(() => {
    const humanIsRed = settings.playerSide === 'r'
    return {
      format: GAME_FORMAT,
      id: gameId,
      createdAt: game.startedAt,
      endedAt: isOver ? Date.now() : null,
      mode: settings.mode,
      redPlayer: settings.mode === 'pvp' || humanIsRed ? 'human' : 'ai',
      blackPlayer: settings.mode === 'pvp' || !humanIsRed ? 'human' : 'ai',
      difficulty: settings.mode === 'pve' ? settings.difficulty : null,
      result: isOver ? status.status : 'unfinished',
      reason: status.reason,
      startFen: projection.startFen,
      moves: projection.movesIccs.join(' '),
      finalFen: projection.fen,
      moveCount: projection.movesIccs.length,
      durationMs: Date.now() - game.startedAt,
      appVersion: engineVersion(),
      shared,
    }
  }, [
    gameId,
    game.startedAt,
    isOver,
    settings.mode,
    settings.playerSide,
    settings.difficulty,
    status.status,
    status.reason,
    projection,
    shared,
  ])

  // Autosave the game in progress so closing the app never loses it.
  useEffect(() => {
    if (!game.ready || isOver) return
    if (projection.movesIccs.length === 0) return
    let cancelled = false
    getHistoryStore()
      .then((store) => {
        if (!cancelled) return store.saveInProgress(record)
      })
      .catch(() => {
        /* autosave is best-effort */
      })
    return () => {
      cancelled = true
    }
  }, [game.ready, isOver, projection.movesIccs.length, record])

  // File the finished game and let the engine learn from it.
  useEffect(() => {
    if (!isOver || filedRef.current === gameId) return
    if (projection.movesIccs.length === 0) return
    filedRef.current = gameId

    void (async () => {
      const store = await getHistoryStore()
      await store.saveGame(record)
      await store.saveInProgress(null)
      setSavedNote('Đã lưu ván này vào lịch sử.')

      if (!settings.learnFromGames || settings.mode !== 'pve') return
      // Learn from the *engine's* own moves, graded by how it did. Learning
      // from the human's moves would teach it to imitate them, not beat them.
      const engineSide = settings.playerSide === 'r' ? 'b' : 'r'
      const engineWon =
        (engineSide === 'r' && status.status === 'redWin') ||
        (engineSide === 'b' && status.status === 'blackWin')
      const outcome =
        status.status === 'draw' ? 'draw' : engineWon ? 'win' : 'loss'

      try {
        const client = getEngineClient()
        await client.learn(record.startFen, record.moves, engineSide, outcome)
        const text = await client.experienceText()
        await store.setState(EXPERIENCE_KEY, text)
      } catch {
        // Learning is an enhancement; never let it break the end of a game.
      }
    })()
  }, [isOver, gameId, record, projection.movesIccs.length, settings, status.status])

  // Restore the engine's saved experience once per session.
  useEffect(() => {
    if (!game.ready) return
    void (async () => {
      try {
        const store = await getHistoryStore()
        const text = await store.getState(EXPERIENCE_KEY)
        if (text) await getEngineClient().loadExperience(text)
      } catch {
        /* a missing experience book just means the engine starts fresh */
      }
    })()
  }, [game.ready])

  const onNewGame = useCallback(() => {
    game.reset()
    setGameId(newGameId())
    setHint(null)
    setSavedNote(null)
    setShared(false)
    filedRef.current = null
    void getEngineClient().reset()
  }, [game])

  const onHint = useCallback(async () => {
    setHintBusy(true)
    try {
      setHint(await game.hint())
    } finally {
      setHintBusy(false)
    }
  }, [game])

  const hintSquares = useMemo(() => {
    if (!hint) return null
    const m = projection.legalMoves.find((x) => x.iccs === hint.iccs)
    return m
      ? { fromRow: m.fromRow, fromCol: m.fromCol, toRow: m.toRow, toCol: m.toCol }
      : null
  }, [hint, projection.legalMoves])

  if (game.error) {
    return (
      <div className="banner banner--error">
        Không khởi động được engine: {game.error}
      </div>
    )
  }

  if (!game.ready) {
    return <p className="muted">Đang tải engine…</p>
  }

  const humanControls =
    settings.mode === 'pvp' ? null : settings.playerSide
  const boardDisabled = isOver || thinking || game.engineToMove

  return (
    <div className="play">
      <div className="play__board">
        <Board
          pieces={projection.pieces}
          legalMoves={projection.legalMoves}
          sideToMove={status.sideToMove}
          controllable={humanControls}
          onMove={(iccs) => {
            setHint(null)
            game.playMove(iccs)
          }}
          lastMove={game.lastMove}
          flipped={settings.flipped}
          inCheck={status.inCheck}
          disabled={boardDisabled}
          hint={settings.showHints ? hintSquares : null}
        />
      </div>

      <div className="play__side">
        <div className="card">
          <div className="status-line">
            <span className={`dot dot--${status.sideToMove}`} />
            <strong>
              {isOver
                ? describeResult(status.status, status.reason)
                : `${status.sideToMove === 'r' ? 'Đỏ' : 'Đen'} đi`}
            </strong>
            {status.inCheck && !isOver && <span className="badge badge--loss">Chiếu tướng</span>}
            {thinking && (
              <span className="thinking">
                <span className="spinner" /> Máy đang nghĩ…
              </span>
            )}
          </div>

          {settings.mode === 'pve' && (
            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Chế độ {preset.label} — {preset.blurb}
            </p>
          )}

          {lastInfo && (
            <>
              <div className="evalbar" style={{ marginTop: 12 }}>
                <div
                  className="evalbar__fill"
                  style={{ width: `${evalToPercent(lastInfo.score, status.sideToMove)}%` }}
                />
              </div>
              <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
                {lastInfo.fromBook
                  ? 'Máy đi theo sách khai cuộc.'
                  : `Độ sâu ${lastInfo.depth} · ${formatScore(lastInfo)} · ${Math.round(
                      lastInfo.nodes / 1000
                    )}k nút trong ${lastInfo.timeMs}ms`}
                {lastInfo.fromExperience && ' · đã học từ ván trước'}
              </p>
            </>
          )}
        </div>

        {savedNote && <div className="banner">{savedNote}</div>}

        {isOver && (
          <div className="card">
            <strong>{describeResult(status.status, status.reason)}</strong>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn--primary" onClick={onNewGame}>
                Ván mới
              </button>
              <Link className="btn" to="/history">
                Xem lịch sử
              </Link>
            </div>
          </div>
        )}

        <div className="card">
          <div className="btn-row">
            <button type="button" className="btn" onClick={onNewGame}>
              Ván mới
            </button>
            <button
              type="button"
              className="btn"
              onClick={game.undo}
              disabled={projection.movesIccs.length === 0}
            >
              Đi lại
            </button>
            <button
              type="button"
              className="btn"
              onClick={onHint}
              disabled={isOver || thinking || hintBusy}
            >
              {hintBusy ? 'Đang tìm…' : 'Gợi ý'}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={game.resign}
              disabled={isOver}
            >
              Xin thua
            </button>
          </div>
          {hint && (
            <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
              Gợi ý: <strong>{hint.text ?? hint.iccs}</strong>
            </p>
          )}
        </div>

        <div>
          <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>Biên bản</h2>
          <MoveList moves={projection.movesText} />
        </div>
      </div>
    </div>
  )
}

/** Map a centipawn score to a 0..100 bar width, from Red's point of view. */
function evalToPercent(score: number, sideToMove: 'r' | 'b'): number {
  const fromRed = sideToMove === 'r' ? score : -score
  // A logistic squash keeps large material swings from pinning the bar.
  const p = 100 / (1 + Math.exp(-fromRed / 400))
  return Math.max(2, Math.min(98, p))
}

function formatScore(info: SearchInfo): string {
  if (info.mateIn !== null && info.mateIn !== undefined) {
    const moves = Math.ceil(Math.abs(info.mateIn) / 2)
    return info.mateIn > 0 ? `chiếu hết sau ${moves} nước` : `bị chiếu hết sau ${moves} nước`
  }
  const pawns = info.score / 100
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`
}
