/**
 * The launcher.
 *
 * The version before this one explained itself: every option carried a sentence
 * of description, so starting a game meant reading a paragraph first — "Bốn
 * mức, từ dễ tới siêu khó", "Cùng chơi trên một máy", "Đi trước". None of that
 * tells anyone anything they did not already know from the label, and all of it
 * pushed the actual Start button below the fold on a phone.
 *
 * So: three rows of choices, one button, and nothing to read. The whole screen
 * fits above the fold on the smallest phone worth supporting, and the thing
 * someone opening the app came to do is the biggest thing on it.
 *
 * A game already in progress takes the top, because a returning player did not
 * come here to configure anything.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BookOpen, Bot, Info, Play, ScrollText, Users } from 'lucide-react'

import { Author } from '../components/Author'
import { Banner } from '../components/Banner'
import { Button } from '../components/ui/button'
import { Segmented } from '../components/ui/segmented'
import type { Difficulty, Side } from '../engine/types'
import { DIFFICULTY_ORDER, DIFFICULTY_PRESETS } from '../engine/types'
import type { GameMode } from '../game/useGame'
import { useSettings } from '../settings'
import { getHistoryStore } from '../storage'
import type { GameRecord } from '../storage/types'

const MODES = [
  { value: 'pve' as GameMode, label: 'Máy', icon: Bot },
  { value: 'pvp' as GameMode, label: 'Hai người', icon: Users },
]

const SIDES = [
  { value: 'r' as Side, label: 'Đỏ', glyph: '帥' },
  { value: 'b' as Side, label: 'Đen', glyph: '將' },
]


export function HomePage() {
  const { settings, update } = useSettings()
  const navigate = useNavigate()
  const [resumable, setResumable] = useState<GameRecord | null>(null)

  useEffect(() => {
    void getHistoryStore()
      .then((s) => s.getInProgress())
      .then(setResumable)
      .catch(() => setResumable(null))
  }, [])

  const startFresh = () => {
    // "Start" means start: drop the autosave, or the play screen resumes the
    // old game instead of beginning a new one.
    void getHistoryStore()
      .then((s) => s.saveInProgress(null))
      .finally(() => navigate('/play'))
  }

  const canResume = resumable !== null && resumable.moveCount > 0

  return (
    /*
     * One column on a phone, two from 700px up.
     *
     * A 448px strip in the middle of a 1280px desktop is what this was, and it
     * looked like a phone screenshot someone had forgotten to finish. The phone
     * layout is untouched — every reason in the comment block at the top of this
     * file still holds at that size — and the wide one simply stops pretending
     * the extra room is not there.
     *
     * The split is deliberate: everything you *do* on the left, everything you
     * *choose* on the right. Start is the thing this screen exists for, so it
     * keeps a whole column to itself rather than being pushed into a corner by
     * three rows of settings.
     */
    <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-4 min-[700px]:max-w-[900px] min-[700px]:grid-cols-2 min-[700px]:gap-6 min-[1024px]:max-w-[1040px]">
      <header className="flex items-center gap-3 pt-1 min-[700px]:col-span-2">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-2xl text-white"
          aria-hidden="true"
        >
          帥
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl leading-tight font-bold">Đệ Nhất Cờ Tướng</h1>
          <p className="text-sm text-ink-dim">Chơi ngoại tuyến</p>
        </div>
      </header>

      {/*
        A hero strip, at 2.5:1 rather than the 16:9 the promo images use.

        Shape is the whole decision here. The same artwork at 16:9 stands 252px
        tall at this column width and shoves the Start button most of a phone
        screen down the page — which is exactly the mistake the launcher was
        rewritten to undo. Wide and short, it reads as a banner and costs about
        70px of fold.

        Eager, not lazy: it is the first thing on screen, and a lazy image at
        the top of a page just means the player watches it pop in.

        It still disappears on a short screen, and that number is measured
        rather than chosen. On a 375x667 phone the banner costs 153px and puts
        Start 28px under the fold — 84px under it if there is a game to resume. A
        picture is worth less than the button, every time.

        Height *and* width, which the first version got wrong: a height-only rule
        also hid the hero on a 1024x768 tablet held sideways, where there is
        obviously room for it.
      */}
      <div className="flex flex-col gap-4">
        <Banner
          src="./banner/trang-chu.webp"
          alt="Mười hai triệu thế cờ cho mỗi nước bạn đi — ở ngay mức dễ nhất."
          ratio="2.5"
          priority
          maxWidth="max-w-full"
          className="[@media(max-height:759px)_and_(max-width:699px)]:hidden"
        />

      {canResume && (
        <Link
          to="/play"
          className="flex items-center gap-3 rounded-2xl border border-accent bg-accent-soft p-3 transition-[filter] hover:brightness-105"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-white">
            <Play size={18} fill="currentColor" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-[0.95rem] leading-tight">Chơi tiếp</strong>
            <span className="text-sm text-ink-dim">
              {resumable.moveCount} nước
              {resumable.difficulty
                ? ` · ${DIFFICULTY_PRESETS[resumable.difficulty].label}`
                : ''}
            </span>
          </span>
        </Link>
      )}

      </div>

      <div className="flex flex-col gap-4">
      <Segmented
        label="Đối thủ"
        options={MODES}
        value={settings.mode}
        onChange={(mode) => update({ mode })}
      />

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
            onChange={(playerSide) =>
              update({ playerSide, flipped: playerSide === 'b' })
            }
          />
        </>
      )}

      {/*
        The one thing this screen exists for.

        Taller than anything else on the page, full width, filled rather than
        outlined, and carrying a shadow so it sits above the cards instead of
        among them. On a launcher every control competes for the eye, and the
        way you win that competition is not by being clever — it is by being
        visibly bigger than everything around you.
      */}
      <Button
        variant="primary"
        size="lg"
        className="h-16 w-full rounded-2xl text-lg shadow-[0_8px_24px_-6px_var(--accent)] active:translate-y-px"
        onClick={startFresh}
      >
        <Play size={24} fill="currentColor" />
        {canResume ? 'Ván mới' : 'Bắt đầu'}
      </Button>

      </div>

      {/*
        One link, where there used to be four tiles.
        
        The tiles listed Hồ sơ, Lịch sử and Cài đặt — all three of which are now
        one tap away in the navigation that is on screen at the same time. A
        destination offered twice on one screen is not twice as reachable; it is
        one of them wondering which is the real one.
        
        Giới thiệu is the exception, and the reason it was left out of the
        primary navigation: it is read once and then never again, which does not
        earn a permanent slot beside the board.
      */}
      <div className="flex flex-wrap justify-center gap-1 min-[700px]:col-span-2">
        <Link
          to="/about"
          className="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm text-ink-dim no-underline transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Info size={16} /> Giới thiệu
        </Link>
        <Link
          to="/changelog"
          className="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm text-ink-dim no-underline transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ScrollText size={16} /> Có gì mới
        </Link>
      </div>

      {/*
        No second banner here.

        There used to be one at the foot of this page as well as the strip at
        the top, and two banners on one launcher is one banner too many — the
        eye reads the second as a repeat of the first and stops looking at
        either. The promotional set still appears in the game drawer, which is
        somewhere a player has chosen to be rather than somewhere they are
        passing through on the way to a game.
      */}
      <footer className="flex items-center justify-center gap-1 pt-1 pb-2 text-sm text-ink-dim min-[700px]:col-span-2">
        <BookOpen size={13} aria-hidden="true" />
        <Author />
      </footer>
    </div>
  )
}
