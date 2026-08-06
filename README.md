# Cờ Tướng

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
| Perft đầy đủ (độ sâu 5) | `cargo test -p xiangqi-engine --release --test perft -- --ignored` |
| Đo sức cờ | `cargo run -p xiangqi-engine --release --example bench` |

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
| `src/` | Giao diện React (React Router v8, `createHashRouter`) |

**Định dạng trao đổi.** Thế cờ dùng FEN cờ tướng; nước đi dùng toạ độ ICCS (`h2e2`). Một ván được lưu bằng *thế cờ xuất phát + danh sách nước đi*, không phải ảnh chụp bàn cờ — gọn hơn nhiều và không thể mâu thuẫn với luật, vì xem lại chính là phát lại qua engine.

## Luật đã cài đặt

- Cản mã, chân tượng, ngòi pháo, tốt qua sông mới đi ngang.
- **Luật tướng đối mặt** — hai tướng không được nhìn thẳng nhau qua cột trống.
- **Hết nước đi là thua**, không phải hòa như cờ vua.
- **Chiếu tướng liên hoàn → bên chiếu thua.**
- Hòa khi 60 nước không ăn quân, hoặc khi không bên nào đủ quân chiếu hết.

### Chưa cài đặt

- **Luật đuổi bắt liên hoàn (捉)** — phần phức tạp nhất của luật cờ tướng. Cài sai còn tệ hơn không cài, nên hiện tại chỉ có luật chiếu liên hoàn. Ván lặp nước mà không phải chiếu sẽ được xử hòa.

## Về quyền riêng tư

Ứng dụng không gửi dữ liệu đi đâu cả: không tài khoản, không theo dõi, không gọi mạng khi chơi. Ván đấu chỉ rời khỏi máy khi chính bạn bấm xuất ra tệp JSON.

Bản máy tính khoá CSP về `'self'` — kể cả khi có lỗi khi hiển thị một ván nhập từ ngoài, nó cũng không thể trở thành đường tải mã từ xa. (`'wasm-unsafe-eval'` là bắt buộc để khởi tạo module WebAssembly của engine.)

---

## Triển khai

**Bản web → Cloudflare Pages.** Site được build trong GitHub Actions rồi mới đẩy lên, **không** dùng build image của Cloudflare — image đó không có Rust/wasm-pack ổn định. Cần hai secret trong repo:

- `CLOUDFLARE_API_TOKEN` — quyền *Cloudflare Pages: Edit*
- `CLOUDFLARE_ACCOUNT_ID`

Và một project Pages tên `co-tuong`.

**Bản máy tính.** Đẩy tag `v*` để CI dựng đủ artifact cho ba hệ và tạo một GitHub Release ở dạng nháp.

> ⚠️ Bản cài đặt **chưa được ký số**. Lần mở đầu tiên: macOS → chuột phải → Open → Open; Windows → More info → Run anyway. Ký số cần tài khoản Apple Developer và chứng chỉ Windows.

## Dự định

- Luật đuổi bắt liên hoàn (捉).
- Tài khoản và đồng bộ đám mây — **chỉ khi cần chia sẻ ván đấu online**. Hiện tại xuất/nhập JSON đã đủ, và giữ ứng dụng hoàn toàn ngoại tuyến là điều đáng giá hơn.
- Bản Android/iOS native (crate engine và giao diện đã sẵn sàng; chỉ cần cài SDK và `tauri android init`).
- Đa luồng Lazy SMP cho bản native.

## Giấy phép

MIT — xem [LICENSE](LICENSE).
