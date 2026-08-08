/**
 * What a screen shows when it breaks.
 *
 * Without one of these, react-router falls back to its own developer screen —
 * the white page reading "Unexpected Application Error!" over a minified React
 * error code and a stack trace of one-letter function names. That page is
 * exactly right for the person who wrote the app and useless to the person
 * playing it: it says nothing they can act on and offers no way out except the
 * browser's back button.
 *
 * This says what happened in a sentence, and gives the two things that actually
 * fix it: reload, or go back to the launcher. The technical detail is kept, but
 * folded away — it is the thing to paste into a bug report, not the thing to
 * read.
 */

import { Link, useRouteError } from 'react-router'
import { RotateCcw, TriangleAlert } from 'lucide-react'

import { Button } from '../components/ui/button'

function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Không rõ.'
  }
}

export function RouteError() {
  const error = useRouteError()
  const detail = describe(error)

  return (
    <div className="grid min-h-[60dvh] place-items-center p-6">
      <div className="w-full max-w-sm text-center">
        <span
          className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-ink-dim"
          aria-hidden="true"
        >
          <TriangleAlert size={26} />
        </span>
        <h1 className="mb-1 text-lg font-semibold">Màn hình này gặp trục trặc</h1>
        <p className="mb-4 text-sm text-ink-dim">
          Ván cờ đang chơi dở vẫn được lưu. Tải lại là chơi tiếp được.
        </p>

        <div className="grid gap-2">
          <Button variant="primary" className="w-full" onClick={() => window.location.reload()}>
            <RotateCcw size={17} /> Tải lại
          </Button>
          <Button asChild className="w-full">
            <Link to="/">Về trang chủ</Link>
          </Button>
        </div>

        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-sm text-ink-dim">Chi tiết lỗi</summary>
          <p className="mt-2 font-mono text-xs break-words text-ink-dim">{detail}</p>
        </details>
      </div>
    </div>
  )
}
