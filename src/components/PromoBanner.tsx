/**
 * A 16:9 banner, served from R2 rather than from the app.
 *
 * These are the promotional images, and they are the one kind of asset that has
 * no business inside the bundle: five of them is 145 KB that every player would
 * download on first open, to look at art. Off in a bucket they cost the app
 * nothing, and swapping them is an upload rather than a release.
 *
 * The trade is that they need the network, which for this app matters more than
 * usual — playing offline is the whole promise. So the banner is built to be
 * *absent* gracefully rather than to be reliable: a failed fetch removes it
 * outright, leaving no empty box and no broken-image icon, and it loads at the
 * lowest priority the browser offers so it never competes with the engine
 * binary.
 *
 * There is no fade-in, and that is deliberate. The first version faded from
 * transparent on load, and the transition was measured stalling at zero — a
 * loaded, laid-out, permanently invisible banner. A decoration that can fail
 * closed is worse than no decoration, and it was buying half a second of
 * prettiness.
 *
 * One image per mount, chosen at random, so the launcher is not the same picture
 * every single time someone opens the app.
 *
 * Note: the URL below is an `r2.dev` development address. Cloudflare rate-limits
 * those and says plainly they are not for production traffic. If this app ever
 * gets real numbers, put a custom domain on the `co-tuong-anh` bucket and change
 * `BASE` — nothing else here needs to move.
 */

import { useState } from 'react'

import { Banner } from './Banner'

const BASE = 'https://pub-e385dba0fb714f4a823e2e2956ef52f6.r2.dev/banner'

const BANNERS: { file: string; alt: string }[] = [
  {
    file: 'ngang-1-muoi-trieu',
    alt: 'Mười hai triệu thế cờ được cân nhắc trước khi máy nhấc một quân.',
  },
  {
    file: 'ngang-2-ba-gio-sang',
    alt: 'Ba giờ sáng nó vẫn ngồi đó — mở máy ra là có đối thủ.',
  },
  {
    file: 'ngang-3-xem-lai',
    alt: 'Thua rồi vẫn còn dùng được: tua lại từng nước, xem mình hỏng ở đâu.',
  },
  {
    file: 'ngang-4-tien-bo',
    alt: 'Bạn đang khá lên hay chỉ đang chơi nhiều? Máy đếm giúp bạn.',
  },
  {
    file: 'ngang-5-nghin-nam',
    alt: 'Bàn cờ nghìn năm tuổi, đối thủ của ngày mai.',
  },
]

export interface PromoBannerProps {
  className?: string
}

export function PromoBanner({ className }: PromoBannerProps) {
  // Chosen once per mount rather than per render, or it would flicker through
  // all five every time anything else on the page changed.
  const [pick] = useState(() => BANNERS[Math.floor(Math.random() * BANNERS.length)])

  // Removing itself on a failed load is `Banner`'s job now, which is the only
  // place it needs doing.
  return (
    <Banner
      src={`${BASE}/${pick.file}.webp`}
      alt={pick.alt}
      ratio="16 / 9"
      // Capped rather than filled. A 16:9 banner across a 1280px pane stands
      // 720px tall and swallows the launcher whole.
      maxWidth="max-w-[520px]"
      className={className}
    />
  )
}
