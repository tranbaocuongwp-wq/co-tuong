/**
 * The three questions asked before a game, in one place at last.
 *
 * These pickers were the launcher, and the launcher was the app's front door
 * until the front door became a page you read. Rather than delete them with the
 * screen they lived on, they became this: a component with no opinion about
 * where it is drawn, used twice.
 *
 * * On the front page, as the last thing before the footer — choose, press, and
 *   the board opens already set up.
 * * Inside the game, behind **Ván mới** — because the reason anyone wants a new
 *   game mid-session is usually that the current mức khó was the wrong one, and
 *   the old flow answered that by starting an identical game.
 *
 * The component itself starts nothing. It writes the three settings and calls
 * `onStart`, and what that means is the caller's business: the page navigates,
 * the game resets the board. Putting the "what happens next" in here is how the
 * launcher ended up knowing about the autosave, which was never its business.
 */

import { Bot, Play, Users } from 'lucide-react'

import { Segmented } from './ui/segmented'
import { Button } from './ui/button'
import type { Difficulty, Side } from '../engine/types'
import { DIFFICULTY_ORDER, DIFFICULTY_PRESETS } from '../engine/types'
import type { GameMode } from '../game/useGame'
import { cn } from '../lib/utils'
import { useSettings } from '../settings'

const MODES = [
  { value: 'pve' as GameMode, label: 'Máy', icon: Bot },
  { value: 'pvp' as GameMode, label: 'Hai người', icon: Users },
]

const SIDES = [
  { value: 'r' as Side, label: 'Đỏ', glyph: '帥' },
  { value: 'b' as Side, label: 'Đen', glyph: '將' },
]

export interface NewGameChooserProps {
  /** What the button says. "Bắt đầu" on the page, "Ván mới" in the game. */
  action?: string
  /** The settings are already written when this runs. */
  onStart: () => void
  /**
   * Moves in the autosaved game, if there is one.
   *
   * Only ever passed by the front page. Someone who left a game half-played and
   * came back to the site is far more likely to want that game than a fresh
   * one, and the big button is unavoidably labelled for the fresh one.
   */
  resume?: { moves: number; onResume: () => void } | null
  className?: string
}

export function NewGameChooser({
  action = 'Bắt đầu',
  onStart,
  resume,
  className,
}: NewGameChooserProps) {
  const { settings, update } = useSettings()

  return (
    <div
      className={cn(
        'grid gap-4 rounded-3xl border border-border bg-surface p-4 min-[760px]:grid-cols-[1fr_1fr_1fr] min-[760px]:items-end min-[760px]:p-5',
        className
      )}
    >
      <Segmented
        label="Đối thủ"
        options={MODES}
        value={settings.mode}
        onChange={(mode) => update({ mode })}
      />

      {/*
        Both pickers vanish in two-player mode, and the grid closes up behind
        them rather than leaving two holes. There is no mức khó when the
        opponent is the person sitting opposite, and an empty greyed-out control
        invites the question of how to turn it on.
      */}
      {settings.mode === 'pve' && (
        <>
          <Segmented
            label="Mức khó"
            options={DIFFICULTY_ORDER.map((d: Difficulty) => ({
              value: d,
              label: DIFFICULTY_PRESETS[d].label,
            }))}
            value={settings.difficulty}
            onChange={(difficulty) => update({ difficulty })}
          />
          <Segmented
            label="Cầm quân"
            options={SIDES}
            value={settings.playerSide}
            onChange={(playerSide) => update({ playerSide, flipped: playerSide === 'b' })}
          />
        </>
      )}

      <div className="flex flex-col gap-2 min-[760px]:col-span-full">
        <Button
          variant="primary"
          size="lg"
          className="h-14 w-full rounded-2xl text-base shadow-[0_8px_24px_-8px_var(--accent)] active:translate-y-px"
          onClick={onStart}
        >
          <Play size={20} fill="currentColor" /> {action}
        </Button>

        {resume && (
          <button
            type="button"
            onClick={resume.onResume}
            className="min-h-11 cursor-pointer rounded-xl text-sm text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
          >
            hoặc chơi tiếp ván đang dở — {resume.moves} nước
          </button>
        )}
      </div>
    </div>
  )
}
