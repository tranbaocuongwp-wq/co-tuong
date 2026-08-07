# -*- coding: utf-8 -*-
"""The strip across the top of the launcher.

Deliberately *not* one of the promo images. Those are 16:9 and 4:3, shapes made
for a feed, and dropping one onto the home screen would push the Start button
down by a quarter of a phone. A hero on a launcher has to be wide and short —
this is 2.5:1, about 180px tall at the width the page actually gets — so it
reads as a banner rather than as a slab of content standing between the player
and the game.

It also carries no logo and no author line, unlike the promo set. The header
sits directly above it and already says both. Saying them twice, forty pixels
apart, is the sort of thing that makes a screen look unconsidered.

    python3 scripts/home-banner.py

Needs /tmp/metrics.json (Arial advance widths, written by the promo script) so
the headline can be shrunk to fit instead of guessed at — guessing is what
sliced a headline off the right edge the first time round.
"""
import json, subprocess

ROOT = '/Users/tranbaocuong/Co-tuong-opensource'
OUT = f'{ROOT}/public/banner/trang-chu.webp'

_M = json.load(open('/tmp/metrics.json'))
_M = {k: {int(c): w for c, w in v.items()} for k, v in _M.items()}

INK, DIM, GOLD, RED = '#f4ece0', '#a4917c', '#e0a83c', '#c33f26'
FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

W, H = 1600, 640


def measure(text, size, bold=True):
    t = _M['bold' if bold else 'regular']
    return sum(t.get(ord(ch), 0.55) for ch in text) * size


def fit(lines, size, box, bold=True):
    while size > 12 and max(measure(l, size, bold) for l in lines) > box:
        size -= 1
    return size


def head(x, y, lines, size, fill=INK, weight='700', lh=1.16, box=None):
    if box:
        size = fit(lines, size, box, weight == '700')
    return ''.join(
        f'<text x="{x}" y="{y + i * size * lh:.0f}" font-family="{FONT}" font-size="{size}" '
        f'font-weight="{weight}" fill="{fill}">{ln}</text>'
        for i, ln in enumerate(lines)
    )


def disc(cx, cy, r, ch, red=True, op=1.0):
    col = '#b3301c' if red else '#1f2933'
    return (
        f'<g opacity="{op}"><circle cx="{cx}" cy="{cy}" r="{r}" fill="#f6ecd8"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r - 4}" fill="none" stroke="{col}" '
        f'stroke-opacity="0.5" stroke-width="2"/>'
        f'<text x="{cx}" y="{cy}" text-anchor="middle" dominant-baseline="central" '
        f'font-family="Songti SC, serif" font-size="{r * 1.15:.0f}" font-weight="700" '
        f'fill="{col}">{ch}</text></g>'
    )


def grid(x, y, cols, rows, step, op=0.06):
    v = ''.join(f'M{x + i * step} {y}v{rows * step}' for i in range(cols + 1))
    h = ''.join(f'M{x} {y + j * step}h{cols * step}' for j in range(rows + 1))
    return f'<path d="{v}{h}" stroke="{INK}" stroke-opacity="{op}" stroke-width="2" fill="none"/>'


# The two kings face each other down the open file, which is the one shape in
# xiangqi that every player recognises on sight — and the headline sits in the
# gap between them rather than beside them, so the eye lands on the words.
pieces = (
    disc(1180, 320, 74, '將', red=False)
    + disc(1420, 320, 74, '帥', red=True)
    + f'<path d="M1262 320h76" stroke="{GOLD}" stroke-opacity="0.55" stroke-width="4" '
      f'stroke-dasharray="10 12" stroke-linecap="round"/>'
)

body = (
    f'<ellipse cx="1300" cy="320" rx="420" ry="300" fill="url(#glow)"/>'
    + grid(1040, 80, 6, 5, 96)
    + head(96, 250, ['Mười hai triệu thế cờ'], 78, INK, box=880)
    + head(96, 344, ['cho mỗi nước bạn đi.'], 78, GOLD, box=880)
    + f'<rect x="96" y="400" width="120" height="4" fill="{RED}"/>'
    + f'<text x="96" y="480" font-family="{FONT}" font-size="34" fill="{DIM}">'
      f'Ở ngay mức dễ nhất.</text>'
    + pieces
)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0.7" y2="1">
    <stop offset="0%" stop-color="#241d16"/><stop offset="100%" stop-color="#12100d"/>
  </linearGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="{RED}" stop-opacity="0.28"/>
    <stop offset="100%" stop-color="{RED}" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="{W}" height="{H}" fill="url(#bg)"/>
{body}
</svg>'''

src = '/tmp/home-banner.svg'
png = '/tmp/home-banner.png'
open(src, 'w').write(svg)
# 1280 wide covers a 2x phone and a 1x tablet; past that the strip is decoration
# and nobody is going to count its pixels.
subprocess.run(['rsvg-convert', '-w', '1280', src, '-o', png], check=True)
subprocess.run(['cwebp', '-q', '82', '-quiet', png, '-o', OUT], check=True)
print(OUT, __import__('os').path.getsize(OUT), 'bytes')
