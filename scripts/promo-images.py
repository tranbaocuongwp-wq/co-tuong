# -*- coding: utf-8 -*-
"""Ten promotional images. No two say the same thing.

Every headline is about what the opponent *does* — sees further, remembers,
never looks away — and none of them names a single piece of machinery. A
shopper does not know what a search depth is and should not have to.
"""
import base64, os, subprocess

ROOT = '/Users/tranbaocuong/Co-tuong-opensource'
ICON = base64.b64encode(open(f'{ROOT}/public/icon.svg', 'rb').read()).decode()
ICON_URI = f'data:image/svg+xml;base64,{ICON}'


import json as _json
_M = _json.load(open('/tmp/metrics.json'))
_M = {k: {int(c): w for c, w in v.items()} for k, v in _M.items()}

def measure(text, size, bold=True):
    """Width of a string in Arial at `size`, from the font's own advance table."""
    t = _M['bold' if bold else 'regular']
    return sum(t.get(ord(ch), 0.55) for ch in text) * size

def fit(lines, size, box, bold=True):
    """Shrink until the widest line fits. Beats guessing, which cut a headline in half."""
    while size > 12 and max(measure(l, size, bold) for l in lines) > box:
        size -= 1
    return size

INK   = '#f4ece0'
DIM   = '#a4917c'
RED   = '#c33f26'
GOLD  = '#e0a83c'
OK    = '#4a9d6a'
FONT  = "'Helvetica Neue', Helvetica, Arial, sans-serif"

def frame(w, h, body, bg_from='#241d16', bg_to='#12100d'):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
    <stop offset="0%" stop-color="{bg_from}"/><stop offset="100%" stop-color="{bg_to}"/>
  </linearGradient>
  <linearGradient id="seal" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#c33f26"/><stop offset="100%" stop-color="#962a15"/>
  </linearGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="{RED}" stop-opacity="0.30"/>
    <stop offset="100%" stop-color="{RED}" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="{w}" height="{h}" fill="url(#bg)"/>
{body}
</svg>'''

def grid(x, y, cols, rows, step, op=0.07):
    """A faint board lattice, used as texture rather than as a diagram."""
    v = ''.join(f'M{x+i*step} {y}v{rows*step}' for i in range(cols + 1))
    hh = ''.join(f'M{x} {y+j*step}h{cols*step}' for j in range(rows + 1))
    return f'<path d="{v}{hh}" stroke="{INK}" stroke-opacity="{op}" stroke-width="2" fill="none"/>'

def disc(cx, cy, r, ch, red=True, op=1.0):
    fill = '#f6ecd8'
    col = '#b3301c' if red else '#1f2933'
    return (f'<g opacity="{op}"><circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r-4}" fill="none" stroke="{col}" stroke-opacity="0.5" stroke-width="2"/>'
            f'<text x="{cx}" y="{cy}" text-anchor="middle" dominant-baseline="central" '
            f'font-family="Songti SC, serif" font-size="{r*1.15:.0f}" font-weight="700" fill="{col}">{ch}</text></g>')

def head(x, y, lines, size, fill=INK, weight='700', anchor='start', lh=1.18, box=None):
    if box:
        size = fit(lines, size, box, weight == '700')
    out = []
    for i, ln in enumerate(lines):
        out.append(f'<text x="{x}" y="{y + i*size*lh:.0f}" text-anchor="{anchor}" font-family="{FONT}" '
                   f'font-size="{size}" font-weight="{weight}" fill="{fill}">{ln}</text>')
    return ''.join(out)

def sub(x, y, text, size=30, fill=DIM, anchor='start', box=None):
    if box:
        size = fit([text], size, box, False)
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="{FONT}" '
            f'font-size="{size}" fill="{fill}">{text}</text>')

def logo(x, y, s):
    return f'<image href="{ICON_URI}" x="{x}" y="{y}" width="{s}" height="{s}"/>'

def brand(w, h, light=False):
    c = DIM if not light else '#6d6154'
    return (f'{logo(72, h-150, 78)}'
            f'<text x="172" y="{h-104}" font-family="{FONT}" font-size="30" font-weight="700" '
            f'fill="{INK if not light else "#241d16"}">Đệ Nhất Cờ Tướng</text>'
            f'<text x="172" y="{h-68}" font-family="{FONT}" font-size="24" fill="{c}">Trần Bảo Cường</text>')

S = 1200            # square
W, H = 1600, 1200   # 4:3
images = {}

# ---------------------------------------------------------------- square 1
body = (
  f'<circle cx="600" cy="470" r="430" fill="url(#glow)"/>'
  + grid(230, 120, 8, 8, 90, 0.05)
  + f'<text x="600" y="500" text-anchor="middle" font-family="{FONT}" font-size="340" '
    f'font-weight="800" fill="{INK}">20</text>'
  + sub(600, 580, 'NƯỚC', 46, GOLD, 'middle')
  + head(600, 760, ['Nó đã nhìn thấy', 'ván cờ này kết thúc'], 62, INK, '700', 'middle', box=1000)
  + sub(600, 900, 'trước khi bạn chạm vào quân đầu tiên.', 34, DIM, 'middle', box=1000)
  + brand(S, S)
)
images['vuong-1-nhin-truoc'] = (S, S, frame(S, S, body))

# ---------------------------------------------------------------- square 2
lost = ''.join(disc(250 + i*160, 560, 52, ch, red=True, op=0.25 + i*0.18)
               for i, ch in enumerate(['俥', '傌', '炮', '兵', '相']))
body = (
  grid(120, 120, 10, 3, 96, 0.05)
  + head(100, 260, ['Bạn thắng nó một lần.'], 66, box=1000)
  + head(100, 350, ['Lần sau đừng mong', 'thắng kiểu đó nữa.'], 66, GOLD, box=1000)
  + lost
  + sub(100, 720, 'Mỗi ván thua, nó ghi lại nước đã khiến nó thua.', 34, box=1000)
  + sub(100, 772, 'Càng chơi lâu, càng khó lừa.', 34)
  + f'<rect x="100" y="840" width="420" height="4" fill="{RED}"/>'
  + brand(S, S)
)
images['vuong-2-rut-kinh-nghiem'] = (S, S, frame(S, S, body))

# ---------------------------------------------------------------- square 3
body = (
  f'<circle cx="600" cy="430" r="330" fill="url(#glow)"/>'
  + grid(180, 180, 9, 6, 105, 0.05)
  + disc(420, 430, 62, '炮', True)
  + f'<path d="M496 430h230" stroke="{OK}" stroke-width="6" stroke-dasharray="18 12" fill="none"/>'
  + f'<path d="M726 430l-26-16v32z" fill="{OK}"/>'
  + f'<circle cx="790" cy="430" r="56" fill="none" stroke="{OK}" stroke-width="5" stroke-dasharray="14 10"/>'
  + head(600, 700, ['Bạn còn đang phân vân.'], 60, DIM, '400', 'middle', box=1000)
  + head(600, 790, ['Nó đã biết bạn', 'sẽ đi vào đâu.'], 68, INK, '700', 'middle', box=1000)
  + brand(S, S)
)
images['vuong-3-doan-truoc'] = (S, S, frame(S, S, body))

# ---------------------------------------------------------------- square 4
bars = ''
for i, (name, pct) in enumerate([('Dễ', 0.62), ('Vừa', 0.74), ('Khó', 0.86), ('Siêu khó', 1.0)]):
    y = 420 + i*118
    bars += (f'<text x="100" y="{y+8}" font-family="{FONT}" font-size="38" font-weight="700" fill="{INK}">{name}</text>'
             f'<rect x="330" y="{y-26}" width="{770}" height="36" rx="18" fill="{INK}" fill-opacity="0.07"/>'
             f'<rect x="330" y="{y-26}" width="{770*pct:.0f}" height="36" rx="18" fill="{RED if i<3 else GOLD}"/>')
body = (
  grid(700, 90, 5, 3, 100, 0.05)
  + head(100, 250, ['Bốn mức chơi.'], 72)
  + head(100, 335, ['Mức thấp nhất đã đủ làm bạn toát mồ hôi.'], 34, DIM, '400', box=1000)
  + bars
  + sub(100, 960, 'Không có mức nào để bạn thắng cho vui.', 34, GOLD, box=1000)
  + brand(S, S)
)
images['vuong-4-bon-muc'] = (S, S, frame(S, S, body))

# ---------------------------------------------------------------- square 5
body = (
  f'<circle cx="600" cy="420" r="360" fill="url(#glow)"/>'
  + grid(150, 150, 9, 5, 100, 0.05)
  + disc(600, 400, 96, '帥', True)
  + head(600, 660, ['Nó không nhìn trộm.'], 62, INK, '700', 'middle')
  + head(600, 745, ['Không được ưu ái.'], 62, INK, '700', 'middle')
  + head(600, 850, ['Chỉ đơn giản là giỏi hơn.'], 52, GOLD, '700', 'middle', box=1000)
  + sub(600, 930, 'Cùng một luật, cùng một bàn cờ, cùng số quân.', 30, DIM, 'middle', box=1040)
  + brand(S, S)
)
images['vuong-5-cong-bang'] = (S, S, frame(S, S, body))

# ------------------------------------------------------------------ 4:3 #1
bubble = (f'<rect x="820" y="250" width="700" height="230" rx="34" fill="{INK}" fill-opacity="0.06" '
          f'stroke="{INK}" stroke-opacity="0.14"/>'
          f'<path d="M820 400l-46 46 8-62z" fill="{INK}" fill-opacity="0.06"/>')
body = (
  grid(90, 150, 6, 8, 96, 0.05)
  + disc(300, 420, 78, '砲', False)
  + disc(470, 560, 78, '俥', True)
  + bubble
  + f'<text x="860" y="330" font-family="{FONT}" font-size="34" fill="{INK}">“Xe Đỏ vừa chĩa thẳng vào</text>'
  + f'<text x="860" y="382" font-family="{FONT}" font-size="34" fill="{INK}">Pháo Đen. Nước sau không gỡ</text>'
  + f'<text x="860" y="434" font-family="{FONT}" font-size="34" fill="{INK}">là mất quân.”</text>'
  + head(820, 610, ['Có người ngồi cạnh,'], 62, box=700)
  + head(820, 690, ['bình từng nước cho bạn nghe.'], 62, GOLD, box=700)
  + sub(820, 780, 'Gọi tên từng quân, đoán trước vài nước,', 32, box=700)
  + sub(820, 828, 'và lúc rảnh thì kể chuyện quán cờ.', 32, box=700)
  + brand(W, H)
)
images['bon-ba-1-binh-luan'] = (W, H, frame(W, H, body))

# ------------------------------------------------------------------ 4:3 #2
cards = ''
for i, (mv, why, tone) in enumerate([
    ('Pháo 2 bình 5', 'Ăn đứt Mã bên kia', GOLD),
    ('Xe 9 tiến 1', 'Chiếu tướng ngay', INK),
    ('Mã 8 tiến 7', 'Giữ thế, không hở sườn', DIM)]):
    y = 330 + i*180
    cards += (f'<rect x="820" y="{y}" width="700" height="140" rx="26" fill="{INK}" fill-opacity="0.06" '
              f'stroke="{tone}" stroke-opacity="0.45" stroke-width="2"/>'
              f'<circle cx="890" cy="{y+70}" r="30" fill="{tone}" fill-opacity="0.9"/>'
              f'<text x="890" y="{y+70}" text-anchor="middle" dominant-baseline="central" '
              f'font-family="{FONT}" font-size="30" font-weight="700" fill="#241d16">{i+1}</text>'
              f'<text x="950" y="{y+58}" font-family="{FONT}" font-size="38" font-weight="700" fill="{INK}">{mv}</text>'
              f'<text x="950" y="{y+104}" font-family="{FONT}" font-size="28" fill="{DIM}">{why}</text>')
body = (
  grid(90, 200, 6, 7, 96, 0.05)
  + disc(320, 560, 74, '炮', True)
  + f'<path d="M394 560h210" stroke="{OK}" stroke-width="6" stroke-dasharray="18 12"/>'
  + f'<path d="M604 560l-26-16v32z" fill="{OK}"/>'
  + head(90, 220, ['Bí quá?'], 76)
  + sub(90, 810, 'Nó chỉ ba đường đi —', 36, INK, box=680)
  + sub(90, 862, 'và nói thẳng vì sao chọn đường đó.', 36, box=680)
  + cards
  + brand(W, H)
)
images['bon-ba-2-goi-y'] = (W, H, frame(W, H, body))

# ------------------------------------------------------------------ 4:3 #3
body = (
  grid(950, 160, 6, 8, 96, 0.05)
  + head(110, 300, ['Bạn vừa bày ra một thế cờ.'], 58, DIM, '400', box=900)
  + head(110, 400, ['Nó gọi đúng tên,'], 74, box=900)
  + head(110, 490, ['và biết bạn định làm gì.'], 74, GOLD, box=900)
  + f'<rect x="110" y="580" width="640" height="4" fill="{RED}"/>'
  + head(110, 680, ['“Pháo đầu đối bình phong mã.'], 36, INK, '400', box=880)
  + head(110, 740, ['Thế trận kinh điển nhất của cờ tướng,'], 36, INK, '400', box=880)
  + head(110, 800, ['mấy trăm năm chưa ai kết luận', 'được bên nào hơn.”'], 36, INK, '400', box=880)
  + disc(1120, 420, 82, '炮', True)
  + disc(1290, 560, 82, '馬', False)
  + disc(1120, 700, 82, '馬', False)
  + brand(W, H)
)
images['bon-ba-3-goi-ten-the'] = (W, H, frame(W, H, body))

# ------------------------------------------------------------------ 4:3 #4
body = (
  grid(880, 120, 7, 9, 96, 0.04)
  + head(110, 340, ['Không sóng.'], 84, box=820)
  + head(110, 440, ['Không tài khoản.'], 84, box=820)
  + head(110, 540, ['Vẫn có đối thủ.'], 84, GOLD, box=820)
  + sub(110, 660, 'Cả bộ óc ấy nằm sẵn trong máy bạn.', 36, box=880)
  + sub(110, 712, 'Tàu điện ngầm, thang máy, giữa rừng — mở là chơi.', 36, box=880)
  + f'<g opacity="0.9">{disc(1230, 480, 110, "帥", True)}</g>'
  + f'<circle cx="1230" cy="480" r="170" fill="none" stroke="{GOLD}" stroke-opacity="0.35" stroke-width="3" stroke-dasharray="16 14"/>'
  + f'<circle cx="1230" cy="480" r="230" fill="none" stroke="{GOLD}" stroke-opacity="0.15" stroke-width="3" stroke-dasharray="16 14"/>'
  + brand(W, H)
)
images['bon-ba-4-ngoai-tuyen'] = (W, H, frame(W, H, body))

# ------------------------------------------------------------------ 4:3 #5
rows = [('Lực lượng', 0.72, 0.55), ('Chiếm đóng', 0.86, 0.30),
        ('Áp sát cung', 0.64, 0.18), ('An toàn Tướng', 0.40, 0.88)]
meters = ''
for i, (name, r, b) in enumerate(rows):
    y = 360 + i*140
    meters += (f'<text x="880" y="{y}" font-family="{FONT}" font-size="32" fill="{INK}">{name}</text>'
               f'<rect x="880" y="{y+22}" width="600" height="16" rx="8" fill="{INK}" fill-opacity="0.08"/>'
               f'<rect x="880" y="{y+22}" width="{600*r:.0f}" height="16" rx="8" fill="{RED}"/>'
               f'<rect x="880" y="{y+50}" width="600" height="16" rx="8" fill="{INK}" fill-opacity="0.08"/>'
               f'<rect x="880" y="{y+50}" width="{600*b:.0f}" height="16" rx="8" fill="{DIM}"/>')
body = (
  grid(90, 140, 7, 8, 96, 0.05)
  + head(110, 300, ['Nó không chỉ nhìn'], 66, box=720)
  + head(110, 385, ['nước bạn vừa đi.'], 66, box=720)
  + head(110, 490, ['Nó đọc cả ván.'], 66, GOLD, box=720)
  + sub(110, 590, 'Ai đang mạnh hơn, mạnh ở đâu,', 34, box=720)
  + sub(110, 638, 'và chỗ nào sắp vỡ.', 34)
  + meters
  + brand(W, H)
)
images['bon-ba-5-doc-van-co'] = (W, H, frame(W, H, body))

os.makedirs(f'{ROOT}/promo', exist_ok=True)
for name, (w, h, svg) in images.items():
    p = f'/tmp/{name}.svg'
    open(p, 'w').write(svg)
    out = f'{ROOT}/promo/{name}.png'
    subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(h), p, '-o', out], check=True)
    print(f'  {name}.png  {w}x{h}')
