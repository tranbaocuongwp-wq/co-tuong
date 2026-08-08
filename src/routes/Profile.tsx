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
 *
 * The record reads as one number and one bar. A grid of four equal tiles —
 * thắng, thua, hoà, bỏ dở — gives all four the same weight, and they do not
 * have the same weight: the question is "am I winning", and everything else is
 * the working.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Clock, History, Lightbulb, Swords, Timer, TrendingUp } from 'lucide-react'

import { ResultBadge } from '../components/ResultBadge'
import { Button } from '../components/ui/button'
import { Card, CardTitle } from '../components/ui/card'
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
  if (minutes < 60) return `${minutes}p`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}g` : `${hours}g${rest}`
}

function Stat({
  icon: Glyph,
  value,
  label,
}: {
  icon: typeof Clock
  value: string | number
  label: string
}) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-1 py-2.5 text-center">
      <Glyph size={15} className="mx-auto mb-1 text-ink-dim" aria-hidden="true" />
      <div className="text-sm leading-tight font-semibold tabular-nums">{value}</div>
      <div className="text-[0.68rem] text-ink-dim">{label}</div>
    </div>
  )
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

  if (games === null) return <p className="text-sm text-ink-dim">Đang xem lại lịch sử…</p>

  if (all.played === 0 && all.unfinished === 0) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        <p className="text-sm text-ink-dim">Chưa có ván nào để tổng kết.</p>
        <Button asChild variant="primary" size="lg" className="w-full">
          <Link to="/">Chơi một ván</Link>
        </Button>
      </div>
    )
  }

  const rate = all.played > 0 ? Math.round((all.won / all.played) * 100) : 0
  const of = (n: number) => `${(n / (all.played || 1)) * 100}%`

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">

      <Card>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-4xl leading-none font-bold tabular-nums">{rate}%</div>
            <div className="mt-1 text-sm text-ink-dim">tỷ lệ thắng · {all.played} ván</div>
          </div>
          <ResultBadge outcome={rate >= 50 ? 'win' : 'loss'} />
        </div>

        {/* One bar in three parts: the whole record on a single line. */}
        <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
          <span className="bg-ok" style={{ width: of(all.won) }} />
          <span className="bg-[color:var(--danger,#b3261e)]" style={{ width: of(all.lost) }} />
          <span className="bg-ink-dim" style={{ width: of(all.drawn) }} />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-xs">
          <span className="text-ok">{all.won} thắng</span>
          <span className="text-[color:var(--danger,#b3261e)]">{all.lost} thua</span>
          <span className="text-ink-dim">{all.drawn} hoà</span>
          {all.unfinished > 0 && <span className="text-ink-dim">{all.unfinished} bỏ dở</span>}
        </div>
      </Card>

      <Card>
        <CardTitle>
          <Clock size={15} /> Bên bàn cờ
        </CardTitle>
        <div className="grid grid-cols-4 gap-2">
          <Stat icon={Clock} value={duration(all.totalMs)} label="Tổng" />
          <Stat icon={Swords} value={all.moves} label="Nước đi" />
          <Stat
            icon={Timer}
            value={all.fastestWinMs === null ? '—' : duration(all.fastestWinMs)}
            label="Kỷ lục"
          />
          <Stat icon={Lightbulb} value={`${all.hints}·${all.undos}`} label="Gợi ý·Lại" />
        </div>
      </Card>

      {byDifficulty.length > 0 && (
        <Card>
          <CardTitle>
            <TrendingUp size={15} /> Theo mức khó
          </CardTitle>
          <div className="grid gap-2.5">
            {byDifficulty.map(({ level, stats }) => {
              const share = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0
              return (
                <div key={level}>
                  <div className="mb-1 flex justify-between text-[0.85rem]">
                    <span>{DIFFICULTY_PRESETS[level].label}</span>
                    <span className="text-ink-dim tabular-nums">
                      {share}% · {stats.won}/{stats.played}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-500"
                      style={{ transform: `scaleX(${share / 100})` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Button asChild className="w-full">
        <Link to="/history">
          <History size={17} /> Xem từng ván
        </Link>
      </Button>
    </div>
  )
}
