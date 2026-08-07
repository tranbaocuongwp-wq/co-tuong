# Logo & tài sản cho cửa hàng

## Nộp vào đâu

| Tệp | Kích thước | Bắt buộc cho |
|---|---|---|
| `icon-appstore-1024.png` | 1024 × 1024, **không kênh alpha**, **không bo góc** | App Store. Apple tự bo góc — nộp bản đã bo sẽ có 4 góc trong suốt và bị từ chối. |
| `icon-play-512.png` | 512 × 512, 32-bit có alpha | Google Play |
| `feature-graphic-1024x500.png` | 1024 × 500 | Google Play (ảnh bìa, bắt buộc) |
| `logo.svg` | vô hạn | Nguồn gốc. Dùng cho web, in ấn, mọi kích thước khác. |
| `logo-maskable.svg` | vô hạn | Bản Android xén tròn/squircle |
| `logo-master-2048.png` / `-4096.png` | 2048, 4096 | Bản in, ảnh bìa mạng xã hội, cần bao nhiêu cắt bấy nhiêu |

Bộ dùng trong ứng dụng (`public/`) sinh từ cùng một nguồn: 32, 180, 192, 512 và
maskable 512.

## Điều quan trọng nhất về tệp này

**Không có chữ nào là text, và không phụ thuộc font nào.** Bản trước dùng
`<text>` xin font Songti SC: đúng trên máy Mac có font đó, và sai ở mọi nơi
khác — bảng điều khiển cửa hàng, nhà in, công cụ thiết kế. Với một logo thì đó
là lỗi, không phải chi tiết nhỏ.

Nay chữ 帥 lấy đường vẽ từ Songti SC Bold, dòng "SIÊU KHÓ" lấy từ Arial Bold, cả
hai nhúng thẳng vào tệp dưới dạng `<path>`. Mở ở đâu cũng ra đúng một hình.

Chữ 帥 còn được căn theo **phần mực thật của nó** chứ không theo ô chữ, nên nó
nằm giữa về mặt thị giác chứ không chỉ giữa về mặt số học.

## Dựng lại

Sửa `public/icon.svg` rồi:

```bash
rsvg-convert -w 1024 -h 1024 public/icon.svg -o /tmp/a.png
magick /tmp/a.png -background '#962a15' -alpha remove -alpha off store-assets/icon-appstore-1024.png
for n in 512 192 180; do rsvg-convert -w $n -h $n public/icon.svg -o public/icon-$n.png; done
rsvg-convert -w 32 -h 32 public/icon.svg -o public/favicon-32.png
rsvg-convert -w 512 -h 512 public/icon-maskable.svg -o public/icon-maskable-512.png
```

Nhớ dựng bản App Store từ SVG **vuông** (bỏ `rx="112"`), không phải bản bo góc.
