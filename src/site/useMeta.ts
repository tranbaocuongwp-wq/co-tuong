/**
 * The tab's name, and what a search engine reads.
 *
 * A single-page app has one `<title>` in `index.html` and never touches it
 * again, so every page of the site was called "Đệ Nhất Cờ Tướng — cờ tướng
 * ngoại tuyến, máy đánh thật". That is invisible right up until someone has
 * four tabs open, or bookmarks the guide and cannot find it again, or shares a
 * release note and the preview describes the front page.
 *
 * ## What this deliberately is not
 *
 * It is not server-side rendering, and it does not pretend to be. A crawler
 * that does not run JavaScript still sees only the HTML entry point. Google has
 * rendered JavaScript for years and this is enough for it; making the other
 * crawlers happy would mean prerendering the site at build time, which is a
 * different and much larger change than the one this file is part of.
 *
 * The description is written to `<meta name="description">` and to the OG tag,
 * because the two are read by different things and neither falls back to the
 * other.
 */

import { useEffect } from 'react'

const SUFFIX = 'Đệ Nhất Cờ Tướng'

function setMeta(selector: string, content: string): void {
  const tag = document.head.querySelector<HTMLMetaElement>(selector)
  if (tag) tag.content = content
}

export function useMeta(title: string, description?: string): void {
  useEffect(() => {
    /*
     * The front page passes its own full title rather than a section name, so
     * it does not come out as "Đệ Nhất Cờ Tướng — Đệ Nhất Cờ Tướng".
     */
    document.title = title.includes(SUFFIX) ? title : `${title} — ${SUFFIX}`
    setMeta('meta[property="og:title"]', document.title)
    if (description) {
      setMeta('meta[name="description"]', description)
      setMeta('meta[property="og:description"]', description)
    }
  }, [title, description])
}
