/**
 * "Vì sao máy tôi không ra tiếng."
 *
 * ## Why this exists
 *
 * Because every part of the audio layer can succeed and the phone can still be
 * silent, and nothing on screen says which. The lines download, the buffers
 * decode, `ctx.state` reads `running`, every call returns without error — and
 * an iPhone with the switch on the side flipped plays none of it, because Web
 * Audio lands in the *ambient* session unless something claims a playback one.
 * From inside the app that failure is indistinguishable from success.
 *
 * So the question gets asked out loud instead: press a button, hear a knock or
 * do not, and read back what the audio layer actually thinks its state is.
 * Reported by a player as "không thấy phát âm thanh", which is a sentence no
 * amount of logging on someone else's machine can resolve.
 *
 * ## Why the button plays the sound itself
 *
 * The test has to run *inside* the tap. iOS will resume a suspended context or
 * start a media element only from within a genuine gesture handler, so a test
 * that fired from a timer would fail for reasons that have nothing to do with
 * the player's device — and would then accuse it of being broken.
 *
 * ## What it deliberately does not do
 *
 * It does not try to fix anything, and it does not guess. `session: 'failed'`
 * is reported as the specific thing it is; a `suspended` context is reported as
 * "chưa được phép", not as an error. The advice below each state is the shortest
 * true thing a person can act on, and where the app genuinely cannot tell —
 * volume, the mute switch, a Bluetooth speaker in another room — it says the
 * sound was sent and stops there rather than inventing a diagnosis.
 */

import { useState } from 'react'
import { CircleCheck, TriangleAlert, Volume2 } from 'lucide-react'

import { playTestSound, soundReport, type SoundReport } from '../audio/sfx'
import { Button } from './ui/button'
import { Card, CardTitle } from './ui/card'

/** What the player should read, given what the audio layer reports. */
function verdict(r: SoundReport): { tone: 'ok' | 'warn'; headline: string; body: string } {
  if (!r.supported) {
    return {
      tone: 'warn',
      headline: 'Trình duyệt này không phát được tiếng',
      body: 'Máy không có Web Audio. Thử mở bằng Safari (iPhone) hoặc Chrome (Android) thay vì trình duyệt trong ứng dụng Facebook hay Zalo — mấy trình duyệt lồng trong ứng dụng khác hay bị chặn tiếng.',
    }
  }
  if (!r.enabled) {
    return {
      tone: 'warn',
      headline: 'Âm thanh đang tắt trong Cài đặt',
      body: 'Bật lại công tắc "Âm thanh" ở trên rồi thử lại.',
    }
  }
  if (r.state === 'suspended' || r.state === 'chưa mở') {
    return {
      tone: 'warn',
      headline: 'Máy chưa cho phép phát tiếng',
      body: 'Trình duyệt chỉ mở loa sau khi bạn chạm vào trang. Bấm nút thử thêm một lần nữa; nếu vẫn vậy thì tải lại trang rồi chạm vào bàn cờ trước.',
    }
  }
  if (r.session === 'failed') {
    return {
      tone: 'warn',
      headline: 'Nút gạt im lặng đang tắt tiếng',
      body: 'Ứng dụng không giành được quyền phát nhạc, nên iPhone xếp tiếng game vào loại "tiếng nền" — và nút gạt nhỏ ở cạnh máy sẽ tắt hết loại đó. Gạt nút ấy về phía không thấy vạch cam, rồi thử lại.',
    }
  }
  return {
    tone: 'ok',
    headline: 'Đã phát ra loa',
    body: 'Nếu vẫn không nghe thấy: vặn to âm lượng khi đang mở game (âm lượng nhạc khác âm lượng chuông), kiểm tra nút gạt im lặng ở cạnh iPhone, và xem máy có đang nối tai nghe hay loa Bluetooth nào không.',
  }
}

/** Plain Vietnamese for each thing the report knows. */
function rows(r: SoundReport): { label: string; value: string }[] {
  return [
    {
      label: 'Loa của trang',
      value:
        r.state === 'running'
          ? 'đang mở'
          : r.state === 'suspended'
            ? 'chưa được phép'
            : r.state === 'chưa mở'
              ? 'chưa mở'
              : 'đã đóng',
    },
    {
      label: 'Quyền phát nhạc',
      value:
        r.session === 'audioSession'
          ? 'đã xin được'
          : r.session === 'silentLoop'
            ? 'đã xin được (cách cũ)'
            : r.session === 'failed'
              ? 'không xin được'
              : 'chưa cần xin',
    },
    {
      label: 'Tiếng quân cờ',
      // Named by what it means rather than by the fraction, because the
      // fraction on its own invites the reader to worry about a number that is
      // still climbing.
      value: r.samples >= 13 ? 'đủ cả 13' : `đang tải, ${r.samples}/13`,
    },
  ]
}

export function SoundCheck() {
  const [report, setReport] = useState<SoundReport | null>(null)

  return (
    <Card>
      <CardTitle>
        <Volume2 size={15} /> Kiểm tra âm thanh
      </CardTitle>
      <p className="mb-3 text-sm text-ink-dim">
        Không nghe thấy gì khi chơi? Bấm nút này, máy sẽ gõ một tiếng như lúc đi quân.
      </p>

      <Button
        variant="primary"
        className="w-full"
        onClick={() => {
          /*
           * Play first, read second — and read after a beat.
           *
           * `playTestSound` resumes the context, and the resume is a promise:
           * asked in the same tick it would still report `suspended` and tell
           * the player their device is broken while the sound was playing.
           */
          playTestSound()
          /*
           * Twice: once for the verdict, once for the count.
           *
           * The context resumes within a frame or two, so 400ms is plenty to
           * say whether sound came out. Decoding thirteen samples off a cold
           * cache is not done by then, and a report that says "2/13" while they
           * are still arriving reads as a fault. The second look lets the
           * number settle.
           */
          window.setTimeout(() => setReport(soundReport()), 400)
          window.setTimeout(() => setReport(soundReport()), 2200)
        }}
      >
        <Volume2 size={17} /> Phát thử một tiếng
      </Button>

      {report && (
        <div className="mt-4">
          {(() => {
            const v = verdict(report)
            const Icon = v.tone === 'ok' ? CircleCheck : TriangleAlert
            return (
              <div
                className={
                  v.tone === 'ok'
                    ? 'flex gap-2.5 rounded-xl border border-border bg-surface-2 p-3'
                    : 'flex gap-2.5 rounded-xl border border-accent bg-accent-soft p-3'
                }
              >
                <Icon
                  size={17}
                  className={v.tone === 'ok' ? 'mt-0.5 shrink-0 text-ok' : 'mt-0.5 shrink-0 text-accent'}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <strong className="block text-[0.92rem] leading-snug">{v.headline}</strong>
                  <p className="mt-1 text-sm leading-relaxed text-ink-dim">{v.body}</p>
                </div>
              </div>
            )
          })()}

          <dl className="mt-3 grid gap-0 border-t border-border">
            {rows(report).map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap gap-x-4 border-b border-border py-2 text-sm"
              >
                <dt className="text-ink-dim">{row.label}</dt>
                <dd className="ml-auto">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Card>
  )
}
