/**
 * Past games.
 *
 * Only what a player wants: how it went, when, and a way to watch it again.
 * Backing up to a file is a maintenance job, not a game feature, so it lives in
 * Settings — JSON is how this app stores things, not something to hand someone
 * mid-browse.
 *
 * ## What changed and why
 *
 * Every row used to be a tall card headed "Đen thắng (chiếu bí)", with the date
 * and move count wrapping onto a second line, and two full-size buttons under
 * it. Four games filled a phone screen, and none of them could be told apart at
 * a glance because they all began with the same shape of grey sentence.
 *
 * Now the result is a coloured badge read from the *player's* side, the whole
 * row is the link to the replay, and delete is a small button at the end. The
 * strip at the top counts the badges up, which is the one thing a list of games
 * is actually asked to tell you.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Trash2 } from 'lucide-react'

import { ResultBadge, outcomeOf, type Outcome } from '../components/ResultBadge'
import { DIFFICULTY_PRESETS, describeResult } from '../engine/types'
import { getHistoryStore } from '../storage'
import type { GameRecord } from '../storage/types'

/** "19:47 · 7/8" — enough to find a game, short enough to stay on one line. */
function when(ms: number): string {
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())} · ${d.getDate()}/${d.getMonth() + 1}`
}

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

  const tally = useMemo(() => {
    const count: Record<Outcome, number> = {
      win: 0,
      loss: 0,
      draw: 0,
      unfinished: 0,
      other: 0,
    }
    for (const g of games ?? []) count[outcomeOf(g)]++
    return count
  }, [games])

  const decided = tally.win + tally.loss + tally.draw

  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-3 min-[700px]:max-w-[900px] min-[700px]:grid-cols-2 min-[700px]:gap-4 min-[1024px]:max-w-[1200px] min-[1024px]:grid-cols-3">

      {error && <div className="banner banner--error">{error}</div>}

      {decided > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['Thắng', tally.win, 'text-ok'],
              ['Thua', tally.loss, 'text-[color:var(--danger,#b3261e)]'],
              ['Hoà', tally.draw, 'text-ink-dim'],
            ] as const
          ).map(([label, n, tone]) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-surface px-3 py-2 text-center"
            >
              <div className={`text-2xl leading-tight font-bold tabular-nums ${tone}`}>{n}</div>
              <div className="text-xs text-ink-dim">{label}</div>
            </div>
          ))}
        </div>
      )}

      {games === null && <p className="text-sm text-ink-dim">Đang tải…</p>}

      {games && games.length === 0 && (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm">
          Chưa có ván nào.{' '}
          <Link to="/play" className="text-accent">
            Chơi một ván
          </Link>{' '}
          và nó sẽ xuất hiện ở đây.
        </div>
      )}

      {games && games.length > 0 && (
        <ul className="grid list-none gap-2 p-0">
          {games.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-2 rounded-2xl border border-border bg-surface pr-2"
            >
              {/* The whole row is the link. A "Xem lại" button beside it would
                  be a second target for the same thing. */}
              <Link
                to={`/review/${g.id}`}
                // `text-ink` on purpose: the stylesheet colours every link with the
                // accent, which is right for a link inside a sentence and wrong
                // for a whole row — it made every title red and the page loud.
                className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-ink no-underline"
              >
                <ResultBadge outcome={outcomeOf(g)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.92rem] leading-tight">
                    {describeResult(g.result === 'unfinished' ? 'playing' : g.result, g.reason)}
                  </span>
                  <span className="block truncate text-xs text-ink-dim">
                    {when(g.createdAt)} · {g.moveCount} nước
                    {g.difficulty ? ` · ${DIFFICULTY_PRESETS[g.difficulty].label}` : ''}
                    {g.mode === 'pvp' ? ' · hai người' : ''}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-ink-dim" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => void onDelete(g.id)}
                aria-label="Xoá ván này"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-dim transition-colors hover:bg-surface-2 hover:text-[color:var(--danger,#b3261e)]"
              >
                <Trash2 size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
