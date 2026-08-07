/**
 * The commentary as a feed, for when the sound is off.
 *
 * Turning the speaker off should not turn the *commentator* off. He is still
 * watching, he still has something to say about each move, and on a screen with
 * room beside the board there is no reason to throw that away — so his remarks
 * land here instead, newest at the top, the way a live chat reads.
 *
 * Two deliberate choices:
 *
 * **Newest first.** A transcript reads oldest-first; a live feed does not,
 * because the thing you want is the thing that just happened and you should not
 * have to scroll to it. Older remarks stay below for anyone who looks away and
 * comes back.
 *
 * **Paced, not dumped.** The lines arrive here through the same queue that would
 * have spoken them, so they appear one at a time at the speed they would have
 * been said. Emptying the whole queue into the list at once would technically
 * show the same words and would read like a log file.
 *
 * Only offered where there is genuinely spare room, which is the same place the
 * position chart lives. On a phone the board needs every pixel.
 */

import { useEffect, useRef } from 'react'

import { Icon } from './Icon'

export interface FeedEntry {
  /** Unique per arrival, not per line: the same remark can be made twice. */
  key: string
  text: string
  /** Move number when it was said, for anchoring a remark to the board. */
  ply: number
}

export interface CommentaryFeedProps {
  entries: FeedEntry[]
}

export function CommentaryFeed({ entries }: CommentaryFeedProps) {
  const listRef = useRef<HTMLOListElement>(null)

  // A reader who has scrolled back to something is reading it; yanking them to
  // the top because a new line arrived would be the app arguing with them.
  useEffect(() => {
    const list = listRef.current
    if (!list || list.scrollTop > 24) return
    list.scrollTop = 0
  }, [entries])

  return (
    <section className="feed" aria-label="Lời bình">
      <h2 className="feed__title">
        <Icon name="speaker" size={15} /> Lời bình
      </h2>
      {entries.length === 0 ? (
        <p className="muted feed__empty">Bình luận viên đang xem ván cờ…</p>
      ) : (
        <ol className="feed__list" ref={listRef}>
          {entries.map((entry) => (
            <li key={entry.key} className="feed__item">
              <span className="feed__ply">{entry.ply}</span>
              <span className="feed__text">{entry.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
