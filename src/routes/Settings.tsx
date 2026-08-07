/**
 * Settings, cut down to settings.
 *
 * The previous version explained every switch in a full sentence and a half —
 * what the perpetual-check rule does, what the commentator says when it is
 * bored, what happens to the voice when the network drops. All of it true, all
 * of it three screens of reading on a phone, and none of it what someone came
 * to this page for. They came to flip something.
 *
 * So each row is now a name, at most one short clause, and a switch. The
 * explanations moved to the About page, which is the page whose job is
 * explaining.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, HardDrive, Save, Trash2, Upload } from 'lucide-react'

import { downloadVoicePack } from '../audio/pack'
import { Button } from '../components/ui/button'
import { Card, CardTitle } from '../components/ui/card'
import { Segmented } from '../components/ui/segmented'
import { Switch } from '../components/ui/switch'
import { getEngineClient } from '../engine/client'
import type { Difficulty } from '../engine/types'
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

/** Short enough to fit beside a switch on a 375px screen. */
const SHORT: Partial<Record<Difficulty, string>> = {
  easy: 'Dễ',
  medium: 'Vừa',
  hard: 'Khó',
  master: 'Siêu khó',
}

const SWITCHES: {
  key: 'flipped' | 'showHints' | 'sound' | 'voice' | 'perpetualRule' | 'learnFromGames'
  label: string
  hint?: string
}[] = [
  { key: 'flipped', label: 'Lật bàn cờ', hint: 'Đen ở phía dưới' },
  { key: 'showHints', label: 'Tô sáng nước gợi ý' },
  { key: 'sound', label: 'Âm thanh' },
  { key: 'voice', label: 'Bình luận viên', hint: 'Cần mạng để có tiếng' },
  { key: 'perpetualRule', label: 'Xử thua khi chiếu lặp', hint: 'Lặp 5 lần' },
  { key: 'learnFromGames', label: 'Máy rút kinh nghiệm' },
]

export function SettingsPage() {
  const { settings, update } = useSettings()

  const [packBusy, setPackBusy] = useState(false)
  const [packPercent, setPackPercent] = useState(0)
  const [packNote, setPackNote] = useState<string | null>(null)
  const [storeKind, setStoreKind] = useState('…')
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

  const onDownloadPack = useCallback(async () => {
    setPackBusy(true)
    setPackPercent(0)
    setPackNote(null)
    try {
      const result = await downloadVoicePack(({ done, total }) =>
        setPackPercent(Math.round((done / total) * 100))
      )
      setPackNote(
        result.failed > 0
          ? `${result.fetched + result.already}/${result.total} câu đã tải. ${result.failed} câu chưa có bản ghi.`
          : `Xong — ${result.total} câu đã nằm trong máy.`
      )
    } catch (e) {
      setPackNote(e instanceof Error ? e.message : 'Không tải được.')
    } finally {
      setPackBusy(false)
    }
  }, [])

  const clearExperience = useCallback(async () => {
    await getEngineClient().loadExperience('')
    const store = await getHistoryStore()
    await store.setState(EXPERIENCE_KEY, '')
    await refreshExperience()
    setNotice('Đã xoá kinh nghiệm của máy.')
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
    setNotice('Đã xoá toàn bộ lịch sử.')
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <h1 className="pt-1 text-xl font-bold">Cài đặt</h1>

      {error && <div className="banner banner--error">{error}</div>}
      {notice && <div className="banner">{notice}</div>}

      <Segmented
        label="Độ khó mặc định"
        options={DIFFICULTY_ORDER.map((d) => ({
          value: d,
          label: SHORT[d] ?? DIFFICULTY_PRESETS[d].label,
        }))}
        value={settings.difficulty}
        onChange={(difficulty) => update({ difficulty })}
      />

      <Card className="divide-y divide-border py-1">
        {SWITCHES.map(({ key, label, hint }) => (
          <Switch
            key={key}
            label={label}
            hint={hint}
            checked={settings[key]}
            onChange={(next) => update({ [key]: next })}
          />
        ))}
      </Card>

      <Card>
        <CardTitle>
          <Download size={15} /> Tiếng nói ngoại tuyến
        </CardTitle>
        {packBusy && (
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full origin-left bg-accent transition-transform"
              style={{ transform: `scaleX(${packPercent / 100})` }}
            />
          </div>
        )}
        {packNote && <p className="mb-2 text-sm text-ink-dim">{packNote}</p>}
        <Button className="w-full" onClick={() => void onDownloadPack()} disabled={packBusy}>
          <Download size={17} /> {packBusy ? `Đang tải ${packPercent}%` : 'Tải về máy'}
        </Button>
      </Card>

      <Card>
        <CardTitle>
          <Save size={15} /> Sao lưu
        </CardTitle>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => void exportAll()}>
            <Download size={17} /> Lưu tệp
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={17} /> Khôi phục
          </Button>
        </div>
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
      </Card>

      <Card>
        <CardTitle>
          <HardDrive size={15} /> Dữ liệu
        </CardTitle>
        <p className="mb-3 text-sm text-ink-dim">
          Lưu {storeKind}
          {experienceSize !== null && experienceSize > 0 && ` · máy nhớ ${experienceSize} nước`}
        </p>
        <div className="grid gap-2">
          <Button onClick={() => void clearExperience()}>Xoá kinh nghiệm của máy</Button>
          <Button variant="danger" onClick={() => void clearHistory()}>
            <Trash2 size={17} /> Xoá toàn bộ lịch sử
          </Button>
        </div>
      </Card>
    </div>
  )
}
