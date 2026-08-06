import { useCallback, useEffect, useState } from 'react'

import { getEngineClient } from '../engine/client'
import { DIFFICULTY_ORDER, DIFFICULTY_PRESETS } from '../engine/types'
import { useSettings } from '../settings'
import { getHistoryStore } from '../storage'

const EXPERIENCE_KEY = 'engine.experience'

export function SettingsPage() {
  const { settings, update } = useSettings()
  const [storeKind, setStoreKind] = useState<string>('…')
  const [experienceSize, setExperienceSize] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void getHistoryStore().then((s) => setStoreKind(s.kind))
  }, [])

  const refreshExperience = useCallback(async () => {
    try {
      const text = await getEngineClient().experienceText()
      // The serialized form is one line per record, after a format header.
      const lines = text.split('\n').filter(Boolean)
      setExperienceSize(Math.max(0, lines.length - 1))
    } catch {
      setExperienceSize(null)
    }
  }, [])

  useEffect(() => {
    void refreshExperience()
  }, [refreshExperience])

  const clearExperience = useCallback(async () => {
    await getEngineClient().loadExperience('')
    const store = await getHistoryStore()
    await store.setState(EXPERIENCE_KEY, '')
    await refreshExperience()
    setNotice('Đã xóa những gì máy học được.')
  }, [refreshExperience])

  const clearHistory = useCallback(async () => {
    const store = await getHistoryStore()
    await store.clearGames()
    await store.saveInProgress(null)
    setNotice('Đã xóa toàn bộ lịch sử ván đấu.')
  }, [])

  const toggle = (key: 'sound' | 'showHints' | 'flipped' | 'learnFromGames', label: string, help: string) => (
    <div className="switch-row">
      <div>
        <div>{label}</div>
        <div className="muted">{help}</div>
      </div>
      <button
        type="button"
        className="chip"
        aria-pressed={settings[key]}
        onClick={() => update({ [key]: !settings[key] })}
      >
        {settings[key] ? 'Bật' : 'Tắt'}
      </button>
    </div>
  )

  return (
    <>
      <h1 className="page__title">Cài đặt</h1>
      <p className="page__lede">Mọi thiết lập và dữ liệu đều nằm trên máy này.</p>

      {notice && <div className="banner">{notice}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="field__label">Độ khó mặc định</div>
        <div className="chips">
          {DIFFICULTY_ORDER.map((d) => (
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

      <div className="card" style={{ marginBottom: 18 }}>
        {toggle('flipped', 'Lật bàn cờ', 'Đặt quân Đen ở phía dưới.')}
        {toggle('showHints', 'Hiện gợi ý', 'Tô sáng nước đi khi bấm nút Gợi ý.')}
        {toggle('sound', 'Âm thanh', 'Phát tiếng khi đi quân.')}
        {toggle(
          'learnFromGames',
          'Máy học từ ván đã chơi',
          'Sau mỗi ván, máy ghi nhớ những nước dẫn tới thua để lần sau tránh.'
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Dữ liệu</h2>
        <p className="muted">
          Lưu trữ đang dùng: <strong>{storeKind}</strong>
          {experienceSize !== null && (
            <>
              {' '}· máy đã ghi nhớ <strong>{experienceSize}</strong> nước đi từ các ván trước
            </>
          )}
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => void clearExperience()}>
            Xóa phần máy đã học
          </button>
          <button type="button" className="btn btn--danger" onClick={() => void clearHistory()}>
            Xóa toàn bộ lịch sử
          </button>
        </div>
      </div>
    </>
  )
}
