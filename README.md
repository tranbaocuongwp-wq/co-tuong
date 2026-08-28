# Đệ Nhất Cờ Tướng

Ứng dụng cờ tướng **chạy hoàn toàn ngoại tuyến**, với engine viết bằng Rust, chế độ máy siêu khó, và lưu lịch sử ván đấu xem lại được. Chạy trên máy tính (macOS · Windows · Linux) qua Tauri v2, và trên trình duyệt/điện thoại dưới dạng PWA cài được.

> *An offline Xiangqi (Chinese chess) app with a strong Rust engine. Desktop via Tauri v2, plus an installable PWA. No account, no network, no tracking.*

---

## Có gì

- **Engine Rust mạnh** — alpha-beta đào sâu dần, bảng chuyển vị, PVS, cắt tỉa null-move, LMR, tìm kiếm tĩnh. Đạt **độ sâu 13–15** ở bản native và **10–13** ở bản WebAssembly với 5 giây mỗi nước.
- **Luật cờ tướng đúng, có kiểm chứng** — perft khớp chính xác tới độ sâu 5 (133.312.995 nút).
- **Máy tự học từ ván đã chơi** — ghi nhớ những nước dẫn tới thua và tránh chúng ở lần sau.
- **Bốn mức khó** từ Dễ (đi hụt như người mới) tới Siêu khó.
- **Lịch sử ván đấu** — xem lại từng nước, tua tiến/lùi, phát tự động.
- **Xuất/nhập JSON** — chia sẻ ván đấu bằng tệp, không cần tài khoản.
- **Biên bản tiếng Việt** — "Pháo 2 bình 5", "Mã 8 tiến 7".
- **Chơi tiếp ván dở** — đóng app giữa chừng, mở lại vẫn đúng thế cờ.
- **5 lượt gợi ý mỗi ván** — đủ để gỡ bí, không đủ để máy chơi thay bạn.
- **Tự cập nhật (bản web)** — tách riêng *giao diện* và *lõi engine*, không bao giờ cắt ngang ván đang chơi.

## Chạy thử

```bash
npm install
npm run tauri:dev
```

Chỉ chạy bản web:

```bash
npm run dev
```

Yêu cầu: Node 22+, Rust ổn định, target `wasm32-unknown-unknown`, và `wasm-pack`.

```bash
rustup target add wasm32-unknown-unknown && cargo install wasm-pack
```

## Đóng gói

| Việc | Lệnh |
|---|---|
| Bản cài đặt cho máy tính | `npm run tauri:build` |
| Trang web tĩnh (PWA) | `npm run build` → thư mục `dist/` |
| Kiểm thử engine | `npm run test:engine` |
| Perft đầy đủ (độ sâu 5) | `cargo test -p co-tuong-engine --release --test perft -- --ignored` |
| Đo sức cờ | `cargo run -p co-tuong-engine --release --example bench` |
| Dựng lại ảnh chụp cho trang chủ | `npm run gen:shots` |

---

## Kiến trúc

Nguyên tắc: **luật cờ chỉ được viết một lần, bằng Rust.** Giao diện không tự cài đặt lại luật đi quân — đó là cách hai nguồn sự thật lệch nhau và bàn cờ hiển thị một đằng, engine hiểu một nẻo.

```
┌──────────────── React (src/) ────────────────┐
│  Bàn cờ · Biên bản · Lịch sử · Cài đặt       │
│                                               │
│  luật cờ  → WASM ở luồng chính (tức thời)    │
│  tìm kiếm → Web Worker (web)                 │
│             hoặc Rust native (app Tauri)     │
│  lưu trữ  → IndexedDB (web) / SQLite (app)   │
└───────────────────────────────────────────────┘
                      ↓ dùng chung ↓
        crate `engine/` — Rust thuần, không I/O
```

Một crate Rust duy nhất phục vụ cả ba nơi: `engine-wasm` (WebAssembly), `src-tauri` (native), và bộ kiểm thử. Bản native **chỉ thay thế phần tìm kiếm** — nhanh hơn khoảng gấp đôi, đổi lại được thêm chừng một tầng độ sâu. Phần luật vẫn do WASM ở luồng chính trả lời để chạm vào quân là phản hồi ngay.

| Thư mục | Vai trò |
|---|---|
| `engine/` | Luật, sinh nước đi, lượng giá, tìm kiếm, sách khai cuộc, sách kinh nghiệm |
| `engine-wasm/` | Lớp `wasm-bindgen` cho trình duyệt |
| `src-tauri/` | Vỏ ứng dụng máy tính + lệnh tìm kiếm native + SQLite |
| `src/` | Giao diện React (React Router v8) |
| `src/site/` | Trang chủ và các trang tĩnh — phần **đọc** của sản phẩm |

**Định dạng trao đổi.** Thế cờ dùng FEN cờ tướng; nước đi dùng toạ độ ICCS (`h2e2`). Một ván được lưu bằng *thế cờ xuất phát + danh sách nước đi*, không phải ảnh chụp bàn cờ — gọn hơn nhiều và không thể mâu thuẫn với luật, vì xem lại chính là phát lại qua engine.

## Luật đã cài đặt

- Cản mã, chân tượng, ngòi pháo, tốt qua sông mới đi ngang.
- **Luật tướng đối mặt** — hai tướng không được nhìn thẳng nhau qua cột trống.
- **Hết nước đi là thua**, không phải hòa như cờ vua.
- Hòa khi 60 nước không ăn quân, hoặc khi không bên nào đủ quân chiếu hết.

### Luật lặp nước

Khi một thế cờ lặp lại, engine phân loại từng nước trong chu kỳ thành **将** (chiếu), **捉** (đuổi bắt) hay **闲** (nhàn), rồi áp bảng phán quyết:

| Tình huống | Kết quả |
|---|---|
| Một bên toàn chiếu / toàn đuổi, bên kia có nước nhàn | Bên ép thua |
| Cả hai cùng chiếu, hoặc cùng đuổi | Hòa |
| Một bên chiếu, bên kia đuổi | Bên chiếu thua |
| Không bên nào ép | Hòa |

Một nước chỉ tính là **đuổi** khi quân đuổi không phải Tướng/Tốt, quân bị đuổi không phải Tốt chưa qua sông, đòn dọa là **mới xuất hiện**, và ăn được thì **thực sự lợi quân** — điều cuối được xác định bằng bộ đánh giá đổi quân chơi thử cả chuỗi ăn trên bàn cờ, nên đúng cả với ngòi pháo.

**Nguyên tắc thiết kế:** khi không đủ chắc chắn thì xử **hòa**. Chu kỳ quá dài, hoặc chuỗi nước không phát lại được, đều rơi về hòa. Nghĩa là luật có thể *bỏ sót* một ván đáng xử thua, nhưng không bao giờ xử thua oan.

### Chưa cài đặt

- **兑** (đổi quân) và **献** (thí quân) không cần luật riêng ở đây: phép thử lợi quân đã tự loại chúng, vì đổi ngang hay thí quân đều không cho kết quả dương.
- Chưa phân biệt **拦** (chặn đường) và **跟** (bám theo) như luật thi đấu. Nếu một nước bám theo tình cờ tạo ra đòn dọa lợi quân mới, engine vẫn xếp nó là "đuổi" — nghiêm hơn luật một chút. Ràng buộc "đòn dọa phải mới xuất hiện" khiến trường hợp này hiếm, nhưng nó có tồn tại.
- Chưa xét trường hợp quân bị đuổi **không thể chạy** (theo luật, đuổi một quân đã bị trói chặt được xét khác).

## Về quyền riêng tư

Ứng dụng không gửi dữ liệu đi đâu cả: không tài khoản, không theo dõi, không gọi mạng khi chơi. Ván đấu chỉ rời khỏi máy khi chính bạn bấm xuất ra tệp JSON.

Bản máy tính khoá CSP về `'self'` — kể cả khi có lỗi khi hiển thị một ván nhập từ ngoài, nó cũng không thể trở thành đường tải mã từ xa. (`'wasm-unsafe-eval'` là bắt buộc để khởi tạo module WebAssembly của engine.)

---

## Hai nửa: trang web và ứng dụng

Địa chỉ tách hẳn thứ người ta **đọc** khỏi thứ người ta **chơi**, vì hai thứ ấy muốn hai bố cục ngược nhau — một bên là cột nội dung cuộn từ trên xuống, một bên là bàn cờ chiếm trọn cửa sổ và không bao giờ cuộn ngang.

| Địa chỉ | Khung | Là gì |
|---|---|---|
| `/` | `site/SiteLayout` | Trang chủ: giới thiệu, ảnh chụp, lý do, bảng thông tin |
| `/huong-dan` · `/gioi-thieu` · `/tai-ve` · `/co-gi-moi` | `site/SiteLayout` | Các trang tĩnh |
| `/play` · `/profile` · `/history` · `/review/:id` · `/settings` | `App` → `AppShell` | Ứng dụng |

**Định tuyến bằng đường dẫn thật, trừ trong Tauri.** Trang giới thiệu cần địa chỉ đọc được và chia sẻ được, nên bản web dùng `createBrowserRouter`; Cloudflare Pages trả `index.html` cho mọi đường dẫn chưa khớp (xem `public/_redirects`). Bản máy tính vẫn dùng `createHashRouter`: giao thức riêng của Tauri không có bước dự phòng ấy, nên một lần tải lại ở `/play` sẽ ra cửa sổ trắng. Cùng lý do, `base` của Vite là `/` và `index.html` có `<base href="/">` — mọi URL dựng bằng `new URL(x, document.baseURI)` nhờ đó vẫn đúng ở `/review/<id>`.

Trong bản máy tính, `/` chuyển thẳng tới `/play`: người đã cài về máy thì không cần đọc một trang thuyết phục họ cài về máy nữa.

**Ảnh chụp trên trang chủ** nằm ở `public/shots/`, dựng lại bằng `npm run gen:shots` sau khi đã chạy `node scripts/store-shots.mjs`. Chúng có hạng mục riêng trong `assets.json` (`site`) nên **không** bị tải sẵn cùng âm thanh và banner — người vào chơi không phải trả dung lượng cho ảnh quảng cáo.

---

## Triển khai

**Bản web → Cloudflare Pages.** Site được build trong GitHub Actions rồi mới đẩy lên, **không** dùng build image của Cloudflare — image đó không có Rust/wasm-pack ổn định. Cần hai secret trong repo:

- `CLOUDFLARE_API_TOKEN` — quyền *Cloudflare Pages: Edit*
- `CLOUDFLARE_ACCOUNT_ID`

Và một project Pages tên `co-tuong`.

**Bản máy tính.** Đẩy tag `v*` để CI dựng đủ artifact cho ba hệ và tạo một GitHub Release ở dạng nháp.

> ⚠️ Bản cài đặt **chưa được ký số**. Lần mở đầu tiên: macOS → chuột phải → Open → Open; Windows → More info → Run anyway. Ký số cần tài khoản Apple Developer và chứng chỉ Windows.

## Tự cập nhật (bản web)

Mỗi lần build sinh ra `version.json` với **hai** danh tính lấy từ mã băm nội dung:

| Phần | Là gì | Đổi khi |
|---|---|---|
| `app` | Giao diện | Gần như mỗi lần triển khai; tải lại là xong |
| `core` | Nhị phân WebAssembly của engine | Hiếm; là tệp tải nặng nhất |

Ứng dụng đọc tệp này lúc khởi động và kiểm tra lại định kỳ (cũng như mỗi khi bạn quay lại tab). Vì cả hai danh tính đều dựa trên nội dung, build lại mà không sửa gì thì máy khách **không** thấy bản cập nhật nào.

Bản cập nhật **không bao giờ tự tải lại giữa ván**. Nó chỉ áp dụng khi ván đã kết thúc, chưa bắt đầu, hoặc đang tới lượt bạn và máy không tính toán. Vì mỗi nước đi đều được tự lưu, sau khi tải lại bạn về màn hình chính và bấm **Chơi tiếp** là chơi tiếp đúng thế cờ.

Bản máy tính không dùng cơ chế này — nó cập nhật qua bản cài đặt của hệ điều hành.

## Dự định

- Tài khoản và đồng bộ đám mây — **chỉ khi cần chia sẻ ván đấu online**. Hiện tại xuất/nhập JSON đã đủ, và giữ ứng dụng hoàn toàn ngoại tuyến là điều đáng giá hơn.
- Bản Android/iOS native (crate engine và giao diện đã sẵn sàng; chỉ cần cài SDK và `tauri android init`).
- Đa luồng Lazy SMP cho bản native.

## Giấy phép

MIT — xem [LICENSE](LICENSE).
