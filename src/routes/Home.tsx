/**
 * The launcher.
 *
 * A game's front door should look like a game, not like a settings form. The
 * previous version was three rows of grey pills; this one puts the choices on
 * cards you can read at a glance, and gives an unfinished game the top of the
 * screen — that is what someone returning actually came for.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import type { Difficulty, Side } from '../engine/types'
import { DIFFICULTY_ORDER, DIFFICULTY_PRESETS } from '../engine/types'
import type { GameMode } from '../game/useGame'
import { useSettings } from '../settings'
import { getHistoryStore } from '../storage'
import type { GameRecord } from '../storage/types'

const MODES: { value: GameMode; label: string; blurb: string; icon: IconName }[] = [
  { value: 'pve', label: 'Đấu với máy', blurb: 'Bốn mức, từ dễ tới siêu khó', icon: 'board' },
  { value: 'pvp', label: 'Hai người', blurb: 'Cùng chơi trên một máy', icon: 'people' },
]

const SIDES: { value: Side; label: string; blurb: string; glyph: string }[] = [
  { value: 'r', label: 'Quân Đỏ', blurb: 'Đi trước', glyph: '帥' },
  { value: 'b', label: 'Quân Đen', blurb: 'Đi sau', glyph: '將' },
]

const LINKS: { to: string; label: string; icon: IconName }[] = [
  { to: '/history', label: 'Lịch sử', icon: 'history' },
  { to: '/settings', label: 'Cài đặt', icon: 'settings' },
  { to: '/about', label: 'Giới thiệu', icon: 'info' },
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
    <div className="launcher">
      <header className="launcher__hero">
        <span className="launcher__crest" aria-hidden="true">
          帥
        </span>
        <h1 className="launcher__title">Đệ Nhất Cờ Tướng</h1>
        <p className="launcher__tagline">Chơi ngoại tuyến. Máy mạnh, và biết rút kinh nghiệm.</p>
      </header>

      {canResume && (
        <Link className="resume" to="/play">
          <span className="resume__icon" aria-hidden="true">
            <Icon name="play" size={22} />
          </span>
          <span className="resume__body">
            <strong className="resume__title">Chơi tiếp ván dở</strong>
            <span className="resume__meta">
              {resumable.moveCount} nước
              {resumable.difficulty ? ` · mức ${DIFFICULTY_PRESETS[resumable.difficulty].label}` : ''}
            </span>
          </span>
        </Link>
      )}

      <section className="launcher__section">
        <h2 className="launcher__label">Đối thủ</h2>
        <div className="pickers">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className="picker"
              aria-pressed={settings.mode === m.value}
              onClick={() => update({ mode: m.value })}
            >
              <span className="picker__icon" aria-hidden="true">
                <Icon name={m.icon} size={22} />
              </span>
              <span className="picker__label">{m.label}</span>
              <span className="picker__blurb">{m.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      {settings.mode === 'pve' && (
        <>
          <section className="launcher__section">
            <h2 className="launcher__label">Mức khó</h2>
            <div className="pickers pickers--grid">
              {DIFFICULTY_ORDER.map((d: Difficulty) => (
                <button
                  key={d}
                  type="button"
                  className="picker"
                  aria-pressed={settings.difficulty === d}
                  onClick={() => update({ difficulty: d })}
                >
                  <span className="picker__label">{DIFFICULTY_PRESETS[d].label}</span>
                  <span className="picker__blurb">{DIFFICULTY_PRESETS[d].blurb}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="launcher__section">
            <h2 className="launcher__label">Bạn cầm quân</h2>
            <div className="pickers">
              {SIDES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className="picker"
                  aria-pressed={settings.playerSide === s.value}
                  onClick={() => update({ playerSide: s.value, flipped: s.value === 'b' })}
                >
                  <span
                    className={`picker__piece picker__piece--${s.value === 'r' ? 'red' : 'black'}`}
                    aria-hidden="true"
                  >
                    {s.glyph}
                  </span>
                  <span className="picker__label">{s.label}</span>
                  <span className="picker__blurb">{s.blurb}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <button type="button" className="btn btn--primary launcher__start" onClick={startFresh}>
        <Icon name="play" size={20} /> {canResume ? 'Bắt đầu ván mới' : 'Bắt đầu'}
      </button>

      <nav className="tiles" aria-label="Các mục khác">
        {LINKS.map((l) => (
          <Link key={l.to} className="tile" to={l.to}>
            <Icon name={l.icon} size={20} />
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
