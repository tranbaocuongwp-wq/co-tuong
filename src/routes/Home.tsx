import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import type { Difficulty, Side } from '../engine/types'
import { DIFFICULTY_ORDER, DIFFICULTY_PRESETS } from '../engine/types'
import type { GameMode } from '../game/useGame'
import { useSettings } from '../settings'
import { getHistoryStore } from '../storage'
import type { GameRecord } from '../storage/types'

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

  return (
    <>
      <h1 className="page__title">Cờ Tướng</h1>
      <p className="page__lede">
        Chơi hoàn toàn ngoại tuyến. Engine viết bằng Rust, có chế độ siêu khó và tự học từ những
        ván bạn đã chơi.
      </p>

      {resumable && resumable.moveCount > 0 && (
        <div className="banner">
          Bạn còn một ván dở dang ({resumable.moveCount} nước).{' '}
          <Link to="/play">Chơi tiếp</Link>
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: 18 }}>
        <div>
          <div className="field__label">Chế độ</div>
          <div className="chips">
            {(
              [
                ['pve', 'Đấu với máy'],
                ['pvp', 'Hai người một máy'],
              ] as [GameMode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={settings.mode === value}
                onClick={() => update({ mode: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {settings.mode === 'pve' && (
          <>
            <div>
              <div className="field__label">Độ khó</div>
              <div className="chips">
                {DIFFICULTY_ORDER.map((d: Difficulty) => (
                  <button
                    key={d}
                    type="button"
                    className="chip"
                    aria-pressed={settings.difficulty === d}
                    onClick={() => update({ difficulty: d })}
                  >
                    {DIFFICULTY_PRESETS[d].label}
                  </button>
                ))}
              </div>
              <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
                {DIFFICULTY_PRESETS[settings.difficulty].blurb}
              </p>
            </div>

            <div>
              <div className="field__label">Bạn cầm quân</div>
              <div className="chips">
                {(
                  [
                    ['r', 'Đỏ (đi trước)'],
                    ['b', 'Đen'],
                  ] as [Side, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="chip"
                    aria-pressed={settings.playerSide === value}
                    onClick={() => update({ playerSide: value, flipped: value === 'b' })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => navigate('/play')}
          >
            Bắt đầu chơi
          </button>
          <Link className="btn" to="/history">
            Lịch sử ván đấu
          </Link>
        </div>
      </div>
    </>
  )
}
