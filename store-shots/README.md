# Ảnh chụp cho cửa hàng ứng dụng

Dựng lại bất cứ lúc nào:

```bash
npm run build
npx vite preview --port 4211 --strictPort &
node scripts/store-shots.mjs
```

Ảnh chụp ở **đúng độ phân giải gốc** — Chrome dựng trang ở kích thước logic rồi
nhân với `deviceScaleFactor`, không có bước phóng to nào. Cả hai cửa hàng đều
từ chối ảnh thấy rõ là kéo giãn, nên đây là điểm quan trọng nhất.

**Không cắt gì cả.** Mỗi tấm là trọn một màn hình, đúng như người chơi thấy.

## Nộp vào đâu

| Thư mục ảnh | Kích thước | Dùng cho |
|---|---|---|
| `iphone-6.7__*` | 1290 × 2796 | App Store khe iPhone 6.7" · **và Google Play** (Play nhận 320–3840 với tỷ lệ hợp lý) |
| `ipad-12.9__*` | 2048 × 2732 | App Store khe iPad Pro 12.9" (dọc) |
| `ipad-ngang__*` | 2732 × 2048 | App Store iPad (ngang) |

Apple cần tối thiểu 3 ảnh mỗi khe, tối đa 10. Play cần tối thiểu 2, tối đa 8.

## Thứ tự đề nghị

Cửa hàng chỉ hiện 2–3 tấm đầu trước khi người ta phải vuốt, nên đặt thứ mạnh
nhất lên trước:

1. **`04-xem-truoc`** — gợi ý kèm mũi tên, ô cần chiếm và quân bị doạ khoanh đỏ.
   Đây là thứ không ứng dụng cờ tướng nào khác có.
2. **`02-ban-co`** — bàn cờ, lời bình viên, và bảng cục diện.
3. **`05-thang`** — chiếu bí, bảng kết quả.
4. `03-goi-y` — ba phương án kèm lý do.
5. `01-trang-chu` — màn hình mở.
6. `08-ho-so` / `07-lich-su` — huy hiệu thắng thua.
7. `11-ban-co-toi` — nền tối.
8. `09-cai-dat`, `10-gioi-thieu`, `06-menu` — phần còn lại.

Bản iPad ngang chỉ có `02` và `04`, vì cột bên chỉ xuất hiện khi cầm ngang —
đó cũng chính là điểm đáng khoe của khổ máy tính bảng.

## Các cảnh được dựng thế nào

Ván cờ được nạp sẵn vào bản lưu tự động chứ không đánh thật: đánh thật thì mỗi
tấm mất vài phút và lần sau ra khác. Engine, lời bình và giao diện vẫn chạy y
như thường.

Thế chiếu bí là thế thật, kiểm bằng luật chứ không bằng mắt — script thử mọi
nước đen, rồi mọi nước đỏ sau đó, và giữ lại nước nào engine báo là chiếu bí.
Kết quả: đen buộc phải đi `d9e9`, đỏ kết liễu bằng **Xe 9 tiến 1**.

## Nếu muốn thêm cảnh

Sửa mảng `SCENES` trong [`scripts/store-shots.mjs`](../scripts/store-shots.mjs).
Mỗi cảnh khai báo: đi tới đâu, dựng sẵn gì, **chờ điều kiện nào** rồi mới bấm
máy. Chờ theo điều kiện chứ không theo đồng hồ là lý do bộ ảnh này lặp lại được
— chụp sớm 200 mili giây là chụp trúng vòng xoay đang tải.
