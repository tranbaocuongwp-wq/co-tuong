/**
 * A record of how the player has actually been doing.
 *
 * Everything here is counted from games already on the device — no account, no
 * upload, nothing new stored. The history was always there; it just had no page
 * that added it up, so a player could see thirty individual games and still not
 * know whether they were getting better.
 *
 * Unfinished games are excluded from the win rate and counted separately.
 * Folding an abandoned game into "losses" would flatter nobody and mislead
 * everybody.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { Icon } from '../components/Icon'
import { DIFFICULTY_PRESETS } from '../engine/types'
import type { Difficulty } from '../engine/types'
import { getHistoryStore } from '../storage'
import type { GameRecord } from '../storage/types'

interface Tally {
  played: number
  won: number
  lost: number
  drawn: number
  unfinished: number
  totalMs: number
  moves: number
  hints: number
  undos: number
  fastestWinMs: number | null
}

const EMPTY: Tally = {
  played: 0,
  won: 0,
  lost: 0,
  drawn: 0,
  unfinished: 0,
  totalMs: 0,
  moves: 0,
  hints: 0,
  undos: 0,
  fastestWinMs: null,
}

/** Which colour the human had, or null when both sides were human. */
function humanSide(game: GameRecord): 'r' | 'b' | null {
  if (game.redPlayer === 'human' && game.blackPlayer === 'human') return null
  return game.redPlayer === 'human' ? 'r' : 'b'
}

function tally(games: GameRecord[]): Tally {
  return games.reduce<Tally>((acc, game) => {
    const side = humanSide(game)
    const won =
      (side === 'r' && game.result === 'redWin') || (side === 'b' && game.result === 'blackWin')
    const lost =
      (side === 'r' && game.result === 'blackWin') || (side === 'b' && game.result === 'redWin')
    const finished = game.result !== 'unfinished'

    return {
      played: acc.played + (finished ? 1 : 0),
      won: acc.won + (won ? 1 : 0),
      lost: acc.lost + (lost ? 1 : 0),
      drawn: acc.drawn + (game.result === 'draw' ? 1 : 0),
      unfinished: acc.unfinished + (finished ? 0 : 1),
      totalMs: acc.totalMs + game.durationMs,
      moves: acc.moves + game.moveCount,
      hints: acc.hints + (game.assists?.filter((a) => a.kind === 'hint').length ?? 0),
      undos: acc.undos + (game.assists?.filter((a) => a.kind === 'undo').length ?? 0),
      fastestWinMs:
        won && (acc.fastestWinMs === null || game.durationMs < acc.fastestWinMs)
          ? game.durationMs
          : acc.fastestWinMs,
    }
  }, EMPTY)
}

/** Hours and minutes, because "8460000 ms" is not an amount of time to anyone. */
function duration(ms: number): string {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`
}

export function ProfilePage() {
  const [games, setGames] = useState<GameRecord[] | null>(null)

  useEffect(() => {
    void getHistoryStore()
      .then((store) => store.listGames())
      .then(setGames)
      .catch(() => setGames([]))
  }, [])

  const all = useMemo(() => tally(games ?? []), [games])
  const byDifficulty = useMemo(() => {
    const levels = Object.keys(DIFFICULTY_PRESETS) as Difficulty[]
    return levels
      .map((level) => ({
        level,
        stats: tally((games ?? []).filter((g) => g.difficulty === level)),
      }))
      .filter((row) => row.stats.played > 0)
  }, [games])

  if (games === null) return <p className="muted">Đang xem lại lịch sử…</p>

  if (all.played === 0 && all.unfinished === 0) {
    return (
      <>
        <h1 className="page__title">Hồ sơ</h1>
        <p className="page__lede">Chưa có ván nào để tổng kết.</p>
        <Link className="btn btn--primary" to="/">
          Chơi một ván
        </Link>
      </>
    )
  }

  const rate = all.played > 0 ? Math.round((all.won / all.played) * 100) : 0

  return (
    <>
      <h1 className="page__title">Hồ sơ</h1>
      <p className="page__lede">Tất cả tính từ những ván đã lưu trên máy này.</p>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="insight__row">
          <span className="insight__label">Tỷ lệ thắng</span>
          <span className="insight__value">
            {rate}% · {all.won} thắng / {all.played} ván
          </span>
        </div>
        <div className="insight__bar">
          <span className="insight__fill insight__fill--red" style={{ width: `${rate}%` }} />
        </div>

        <div className="stat-grid">
          <div className="stat">
            <span className="stat__value">{all.won}</span>
            <span className="stat__label">Thắng</span>
          </div>
          <div className="stat">
            <span className="stat__value">{all.lost}</span>
            <span className="stat__label">Thua</span>
          </div>
          <div className="stat">
            <span className="stat__value">{all.drawn}</span>
            <span className="stat__label">Hoà</span>
          </div>
          <div className="stat">
            <span className="stat__value">{all.unfinished}</span>
            <span className="stat__label">Bỏ dở</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Thời gian bên bàn cờ</h2>
        <div className="stat-grid">
          <div className="stat">
            <span className="stat__value">{duration(all.totalMs)}</span>
            <span className="stat__label">Tổng cộng</span>
          </div>
          <div className="stat">
            <span className="stat__value">{all.moves}</span>
            <span className="stat__label">Nước đã đi</span>
          </div>
          <div className="stat">
            <span className="stat__value">
              {all.fastestWinMs === null ? '—' : duration(all.fastestWinMs)}
            </span>
            <span className="stat__label">Thắng nhanh nhất</span>
          </div>
          <div className="stat">
            <span className="stat__value">
              {all.hints} · {all.undos}
            </span>
            <span className="stat__label">Gợi ý · Đi lại</span>
          </div>
        </div>
      </div>

      {byDifficulty.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Theo mức khó</h2>
          {byDifficulty.map(({ level, stats }) => {
            const share = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0
            return (
              <div key={level}>
                <div className="insight__row">
                  <span className="insight__label">{DIFFICULTY_PRESETS[level].label}</span>
                  <span className="insight__value">
                    {share}% · {stats.won}/{stats.played}
                  </span>
                </div>
                <div className="insight__bar">
                  <span
                    className="insight__fill insight__fill--red"
                    style={{ width: `${share}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Link className="btn" to="/history">
        <Icon name="history" /> Xem từng ván
      </Link>
    </>
  )
}
