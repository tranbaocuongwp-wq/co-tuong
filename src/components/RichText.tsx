/**
 * A sentence with a few words picked out, and the odd link.
 *
 * Release notes are read by someone scanning, not someone studying. A paragraph
 * of even grey text makes them read all of it or none of it; two or three words
 * in bold let them find the part that concerns them and move on. That is the
 * whole of the convention Telegram's own notes use, and it is worth copying.
 *
 * Deliberately two pieces of syntax and no more:
 *
 * * `**đậm**` — the phrase someone would search for.
 * * `[nhãn](/settings)` — a route in this app, or `https://…` for elsewhere.
 *
 * No italics, no headings, no lists inside a line. A full Markdown parser here
 * would be a dependency and a licence to write paragraphs, and the point of
 * these notes is that they are short.
 */

import { Fragment } from 'react'
import { Link } from 'react-router'

/** `**bold**` or `[label](target)`, whichever comes first. */
const TOKEN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g

export function RichText({ children }: { children: string }) {
  const parts: React.ReactNode[] = []
  let last = 0

  for (const m of children.matchAll(TOKEN)) {
    const at = m.index ?? 0
    if (at > last) parts.push(children.slice(last, at))

    if (m[1] !== undefined) {
      parts.push(
        <strong key={`b${at}`} className="font-semibold text-ink">
          {m[1]}
        </strong>
      )
    } else {
      const label = m[2]
      const target = m[3]
      const external = /^https?:/.test(target)
      parts.push(
        external ? (
          <a
            key={`a${at}`}
            href={target}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent underline underline-offset-2"
          >
            {label}
          </a>
        ) : (
          <Link
            key={`a${at}`}
            to={target}
            className="text-accent underline underline-offset-2"
          >
            {label}
          </Link>
        )
      )
    }
    last = at + m[0].length
  }

  if (last < children.length) parts.push(children.slice(last))

  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  )
}
