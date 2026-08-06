/**
 * The game drawer.
 *
 * Everything that is not the board lives here — controls, the score sheet,
 * what has been captured — so the playing screen itself stays a board and
 * nothing else. On a phone that is the difference between a board you can read
 * and one squeezed between panels.
 *
 * The wording avoids engine vocabulary throughout. A player wants to know the
 * computer is looking eight moves ahead; "nodes", "depth" and "centipawns" tell
 * them nothing.
 */

import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router'

import type { Piece, SearchInfo, Side } from '../engine/types'
import { Icon } from './Icon'
import { MoveList } from './MoveList'

export interface GameMenuProps {
  open: boolean
  onClose: () => void
  moves: string[]
  pieces: Piece[]
  info: SearchInfo | null
  difficultyLabel: string | null
  canUndo: boolean
  isOver: boolean
  busy: boolean
  /** Suggestions left in this game. */
  hintsLeft: number
  onNewGame: () => void
  onUndo: () => void
  onHint: () => void
  onFlip: () => void
  onResign: () => void
}

/** The full complement each side starts with, by piece kind. */
const FULL_SET: Record<string, number> = { k: 1, a: 2, e: 2, h: 2, r: 2, c: 2, p: 5 }

const GLYPHS: Record<Side, Record<string, string>> = {
  r: { k: '帥', a: '仕', e: '相', h: '傌', r: '俥', c: '炮', p: '兵' },
  b: { k: '將', a: '士', e: '象', h: '馬', r: '車', c: '砲', p: '卒' },
}

/** Pieces of `side` that are no longer on the board. */
function capturedFrom(pieces: Piece[], side: Side): string[] {
  const alive: Record<string, number> = {}
  for (const p of pieces) {
    if (p.side === side) alive[p.kind] = (alive[p.kind] ?? 0) + 1
  }
  const gone: string[] = []
  for (const [kind, total] of Object.entries(FULL_SET)) {
    const missing = total - (alive[kind] ?? 0)
    for (let i = 0; i < missing; i++) gone.push(GLYPHS[side][kind])
  }
  return gone
}

export function GameMenu({
  open,
  onClose,
  moves,
  pieces,
  info,
  difficultyLabel,
  canUndo,
  isOver,
  busy,
  hintsLeft,
  onNewGame,
  onUndo,
  onHint,
  onFlip,
  onResign,
}: GameMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape closes the drawer, which is what anyone who opened it by accident
  // will reach for first. Opening also locks the page behind it: without that,
  // scrolling the drawer drags the board around underneath and the whole thing
  // judders.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.classList.add('drawer-open')
    panelRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('drawer-open')
    }
  }, [open, onClose])

  const redLost = capturedFrom(pieces, 'r')
  const blackLost = capturedFrom(pieces, 'b')

  return (
    <>
      <div className={`scrim${open ? ' scrim--open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        className={`drawer${open ? ' drawer--open' : ''}`}
        aria-label="Bảng điều khiển ván đấu"
        aria-hidden={!open}
        tabIndex={-1}
      >
        <div className="drawer__head">
          <strong>Ván đấu</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng">
            <Icon name="close" />
          </button>
        </div>

        <div className="drawer__body">
          <div className="drawer__actions">
            <button type="button" className="btn btn--primary" onClick={onNewGame}>
              <Icon name="new" /> Ván mới
            </button>
            <button type="button" className="btn" onClick={onUndo} disabled={!canUndo}>
              <Icon name="undo" /> Đi lại
            </button>
            <button
              type="button"
              className="btn"
              onClick={onHint}
              disabled={isOver || busy || hintsLeft <= 0}
              title={hintsLeft > 0 ? undefined : 'Hết gợi ý cho ván này'}
            >
              <Icon name="hint" /> Gợi ý <span className="pill">{hintsLeft}</span>
            </button>
            <button type="button" className="btn" onClick={onFlip}>
              <Icon name="flip" /> Lật bàn
            </button>
            <button type="button" className="btn btn--danger" onClick={onResign} disabled={isOver}>
              <Icon name="resign" /> Chịu thua
            </button>
          </div>

          <section className="drawer__section">
            <h3 className="drawer__title">
              <Icon name="captured" size={15} /> Đã ăn
            </h3>
            <div className="tray">
              <div className="tray__row">
                <span className="tray__label">Đỏ mất</span>
                <span className="tray__pieces tray__pieces--red">
                  {redLost.length ? redLost.join(' ') : '—'}
                </span>
              </div>
              <div className="tray__row">
                <span className="tray__label">Đen mất</span>
                <span className="tray__pieces tray__pieces--black">
                  {blackLost.length ? blackLost.join(' ') : '—'}
                </span>
              </div>
            </div>
          </section>

          {(info || difficultyLabel) && (
            <section className="drawer__section">
              <h3 className="drawer__title">
                <Icon name="engine" size={15} /> Máy
              </h3>
              <p className="muted">
                {difficultyLabel && <>Mức {difficultyLabel}</>}
                {info && (
                  <>
                    {difficultyLabel && ' · '}
                    {info.fromBook
                      ? 'nước vừa rồi theo bài bản'
                      : `nghĩ trước ${info.depth} nước`}
                  </>
                )}
              </p>
            </section>
          )}

          <section className="drawer__section">
            <h3 className="drawer__title">
              <Icon name="moves" size={15} /> Nước đi
            </h3>
            <MoveList moves={moves} />
          </section>

          <nav className="drawer__nav" aria-label="Đi tới">
            <NavLink to="/" end onClick={onClose}>
              Trang chủ
            </NavLink>
            <NavLink to="/history" onClick={onClose}>
              Lịch sử
            </NavLink>
            <NavLink to="/settings" onClick={onClose}>
              Cài đặt
            </NavLink>
            <NavLink to="/about" onClick={onClose}>
              Giới thiệu
            </NavLink>
          </nav>

          <p className="drawer__credit">Tác giả: Trần Bảo Cường</p>
        </div>
      </aside>
    </>
  )
}
