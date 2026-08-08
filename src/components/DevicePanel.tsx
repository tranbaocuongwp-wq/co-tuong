/**
 * What this device measured, and what it changed.
 *
 * The measurement exists so a difficulty level means the same strength on a
 * phone and on a laptop — but it does that by giving the phone a longer clock,
 * and a longer clock is something the player watches happen. Two people
 * comparing "Siêu khó" and finding one waits twenty seconds and the other sixty
 * will conclude the app is broken unless there is somewhere that says why.
 *
 * So this is the somewhere. It shows the rate, how that compares with the
 * machine the levels were tuned on, the cap each level ends up with here, and a
 * button to measure again — because the one failure mode of an automatic
 * measurement is a device that was busy when it was taken.
 */

import { useCallback, useEffect, useState } from 'react'
import { Gauge, RefreshCw } from 'lucide-react'

import {
  cachedProfile,
  ensureProfile,
  measureDevice,
  scaledCaps,
  slowdown,
  type DeviceProfile,
} from '../engine/calibration'
import { DIFFICULTY_ORDER, DIFFICULTY_PRESETS } from '../engine/types'
import { Button } from './ui/button'
import { Card, CardTitle } from './ui/card'

function millions(nps: number): string {
  return `${(nps / 1_000_000).toFixed(2)} triệu`
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s`
}

/** "nhanh gấp 1,4 lần" / "chậm 2,1 lần" / "ngang mức chuẩn". */
function comparison(profile: DeviceProfile): string {
  const factor = slowdown(profile)
  if (factor > 1.15) return `chậm hơn máy chuẩn ${factor.toFixed(1)} lần`
  if (factor < 0.87) return `nhanh hơn máy chuẩn ${(1 / factor).toFixed(1)} lần`
  return 'ngang máy chuẩn'
}

export function DevicePanel() {
  const [profile, setProfile] = useState<DeviceProfile | null>(() => cachedProfile())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // Measures only if there is no usable profile, so opening Settings on a
    // device that has already been measured costs nothing.
    void ensureProfile().then(setProfile)
  }, [])

  const remeasure = useCallback(async () => {
    setBusy(true)
    try {
      setProfile(await measureDevice())
    } finally {
      setBusy(false)
    }
  }, [])

  const caps = scaledCaps(profile)

  return (
    <Card>
      <CardTitle>
        <Gauge size={15} /> Tốc độ máy
      </CardTitle>

      {profile ? (
        <>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="font-semibold tabular-nums">{millions(profile.nps)} nước/giây</span>
            <span className="text-sm text-ink-dim">{comparison(profile)}</span>
          </div>
          <p className="mb-3 text-sm text-ink-dim">
            Máy chậm được cho thêm giờ để vẫn nghĩ đủ sâu. Độ sâu của từng mức không đổi.
          </p>

          <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {DIFFICULTY_ORDER.map((d) => (
              <div key={d} className="col-span-2 flex justify-between gap-2">
                <dt className="text-ink-dim">{DIFFICULTY_PRESETS[d].label}</dt>
                <dd className="tabular-nums">
                  tối đa {seconds(caps[d])} · sâu {DIFFICULTY_PRESETS[d].options.maxDepth}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="mb-3 text-sm text-ink-dim">Chưa đo được. Các mức dùng thời gian mặc định.</p>
      )}

      <Button className="w-full" disabled={busy} onClick={() => void remeasure()}>
        <RefreshCw size={17} /> {busy ? 'Đang đo…' : 'Đo lại'}
      </Button>
    </Card>
  )
}
