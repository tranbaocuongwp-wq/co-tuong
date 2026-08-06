import { useCallback, useEffect, useRef, useState } from 'react'

import { Icon } from '../components/Icon'
import { getEngineClient } from '../engine/client'
import { DIFFICULTY_ORDER, DIFFICULTY_PRESETS } from '../engine/types'
import { engineVersion } from '../engine/wasm'
import { useSettings } from '../settings'
import {
  deserializeGames,
  downloadJson,
  getHistoryStore,
  serializeGames,
  suggestedFilename,
} from '../storage'

const EXPERIENCE_KEY = 'engine.experience'

export function SettingsPage() {
  const { settings, update } = useSettings()
  const [storeKind, setStoreKind] = useState<string>('…')
  const [experienceSize, setExperienceSize] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getHistoryStore().then((s) =>
      setStoreKind(s.kind === 'sqlite' ? 'trong ứng dụng' : 'trong trình duyệt')
    )
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

  // Backup lives here rather than on the history page: it is maintenance, and
  // the file format is an implementation detail a player should not have to
  // think about while browsing their games.
  const exportAll = useCallback(async () => {
    const store = await getHistoryStore()
    const games = await store.listGames()
    if (games.length === 0) {
      setNotice('Chưa có ván nào để sao lưu.')
      return
    }
    downloadJson(suggestedFilename(), serializeGames(games, engineVersion()))
    setNotice(`Đã lưu ${games.length} ván ra tệp.`)
  }, [])

  const importFile = useCallback(async (file: File) => {
    setError(null)
    setNotice(null)
    try {
      const imported = deserializeGames(await file.text())
      const store = await getHistoryStore()
      for (const g of imported) await store.saveGame(g)
      setNotice(`Đã khôi phục ${imported.length} ván.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

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

      {error && <div className="banner banner--error">{error}</div>}
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
          'Máy rút kinh nghiệm',
          'Sau mỗi ván, máy nhớ những nước đã khiến nó thua để lần sau tránh.'
        )}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Sao lưu</h2>
        <p className="muted">
          Lưu toàn bộ ván đấu ra một tệp để giữ lại hoặc chuyển sang máy khác.
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => void exportAll()}>
            <Icon name="download" /> Lưu ra tệp
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Khôi phục từ tệp
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importFile(file)
              // Reset so choosing the same file twice still fires a change.
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Dữ liệu</h2>
        <p className="muted">
          Ván đấu được lưu <strong>{storeKind}</strong>, trên máy này.
          {experienceSize !== null && experienceSize > 0 && (
            <>
              {' '}Máy đã ghi nhớ <strong>{experienceSize}</strong> nước đi từ các ván trước.
            </>
          )}
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => void clearExperience()}>
            Xóa kinh nghiệm của máy
          </button>
          <button type="button" className="btn btn--danger" onClick={() => void clearHistory()}>
            Xóa toàn bộ lịch sử
          </button>
        </div>
      </div>
    </>
  )
}
