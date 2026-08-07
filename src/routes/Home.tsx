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
import {
  BookOpen,
  Bot,
  History,
  Info,
  Play,
  Settings,
  UserRound,
  Users,
} from 'lucide-react'

import { Author } from '../components/Author'
import { PromoBanner } from '../components/PromoBanner'
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

const LINKS = [
  { to: '/profile', label: 'Hồ sơ', icon: UserRound },
  { to: '/history', label: 'Lịch sử', icon: History },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
  { to: '/about', label: 'Giới thiệu', icon: Info },
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
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
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

        It still disappears below 760px of viewport height, and that number is
        measured rather than chosen. On a 375x667 phone the banner costs 153px
        and puts Start 28px under the fold — 84px under it if there is a game to
        resume. A picture is worth less than the button, every time, so on a
        short screen the picture is what goes.
      */}
      <img
        src="./banner/trang-chu.webp"
        alt="Mười hai triệu thế cờ cho mỗi nước bạn đi — ở ngay mức dễ nhất."
        width={1280}
        height={512}
        decoding="async"
        className="w-full rounded-xl [@media(max-height:759px)]:hidden"
        style={{ aspectRatio: '2.5' }}
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

      <nav className="grid grid-cols-4 gap-2" aria-label="Các mục khác">
        {LINKS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface text-xs text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>

      {/*
        Under every control on the page, on purpose. The strip at the top is
        part of the launcher; this is an advertisement, and an advertisement
        that pushes the Start button down is a bad trade at any size.
      */}
      <PromoBanner />

      <footer className="flex items-center justify-center gap-1 pt-1 pb-2 text-sm text-ink-dim">
        <BookOpen size={13} aria-hidden="true" />
        <Author />
      </footer>
    </div>
  )
}
