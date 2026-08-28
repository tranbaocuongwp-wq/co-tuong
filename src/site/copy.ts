/**
 * Everything the site says, in one file.
 *
 * ## Why this is data and not JSX
 *
 * Because the same facts appear in four places. The pillar "không cần mạng" is
 * on the front page, in the footer's summary, on the download page and in the
 * store listing; the version number is in the hero, in the release notes and in
 * the fact table. When those lived inside the components that drew them they
 * drifted — the launcher said five hints and the code gave ten, which is the
 * kind of thing nobody notices until a player counts.
 *
 * ## The rule for whoever edits this next
 *
 * **Every number here must be true of the code that ships beside it.** Not
 * aspirational, not rounded up, not a figure from a blog post about a different
 * engine. Where a claim comes from something checkable, the comment says where.
 * If a fact cannot be pointed at, it does not go on the page — an app whose
 * whole pitch is "it does not lie to you" cannot open with a number it made up.
 */

/** Where the source lives. Every "mã nguồn" link on the site points here. */
export const REPO = 'https://github.com/tranbaocuongwp-wq/co-tuong'

/** Built installers, per release. */
export const RELEASES_URL = `${REPO}/releases/latest`

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export interface SiteLink {
  to: string
  label: string
  external?: boolean
}

/**
 * The header's links.
 *
 * Four, and the fifth thing is a button. A header with seven links is a header
 * a visitor reads none of; the rest of the site is reachable from the footer,
 * which is where someone who has finished reading goes looking.
 */
export const SITE_NAV: SiteLink[] = [
  { to: '/', label: 'Trang chủ' },
  { to: '/huong-dan', label: 'Hướng dẫn' },
  { to: '/co-gi-moi', label: 'Có gì mới' },
  { to: '/gioi-thieu', label: 'Giới thiệu' },
]

export const SITE_FOOTER: { title: string; links: SiteLink[] }[] = [
  {
    title: 'Bắt đầu',
    links: [
      { to: '/play', label: 'Chơi ngay' },
      { to: '/tai-ve', label: 'Cài về máy' },
      { to: '/huong-dan', label: 'Cách chơi' },
      { to: '/settings', label: 'Cài đặt' },
    ],
  },
  {
    title: 'Tìm hiểu',
    links: [
      { to: '/gioi-thieu', label: 'Vì sao có ứng dụng này' },
      { to: '/huong-dan#luat', label: 'Luật cờ tướng' },
      { to: '/co-gi-moi', label: 'Lịch sử phiên bản' },
      { to: REPO, label: 'Mã nguồn', external: true },
    ],
  },
  {
    title: 'Ván của bạn',
    links: [
      { to: '/history', label: 'Lịch sử ván đấu' },
      { to: '/profile', label: 'Hồ sơ' },
      { to: `${REPO}/issues`, label: 'Báo lỗi', external: true },
    ],
  },
]

// ---------------------------------------------------------------------------
// The hero's four numbers
// ---------------------------------------------------------------------------

/**
 * Four facts, chosen because each answers a question someone asks before they
 * download anything: what does it cost, does it need my data plan, how hard
 * does it play, and where does my stuff go.
 */
export const STATS: { value: string; label: string }[] = [
  { value: '0đ', label: 'Giá trọn đời' },
  { value: 'Không', label: 'Cần mạng' },
  { value: '4', label: 'Mức khó' },
  { value: 'Trong máy', label: 'Dữ liệu' },
]

// ---------------------------------------------------------------------------
// Six reasons
// ---------------------------------------------------------------------------

export interface Pillar {
  title: string
  body: string
}

export const PILLARS: Pillar[] = [
  {
    title: 'Miễn phí trọn đời',
    body: 'Mở ra là chơi đủ. Không bản Pro, không quảng cáo, không giới hạn số ván, không có thứ gì phải mua thêm.',
  },
  {
    title: 'Không cần mạng',
    body: 'Máy chơi cờ nằm ngay trong máy bạn. Tàu xe, thang máy, hết dung lượng — bàn cờ vẫn mở, máy vẫn đi.',
  },
  {
    title: 'Máy đánh đàng hoàng',
    body: 'Không nhìn trộm, không được thêm quân, không đổi luật giữa chừng. Cùng bàn cờ với bạn, chỉ nghĩ nhanh hơn.',
  },
  {
    title: 'Bốn mức, thật sự khác nhau',
    body: 'Mức dễ đi hụt như người mới. Mức siêu khó nghĩ khoảng năm giây mỗi nước và tính trước hàng chục nước.',
  },
  {
    title: 'Có người bình cờ',
    body: 'Gọi tên từng quân, gọi tên thế trận, đoán trước vài nước. Tắt tiếng thì lời bình chạy thành chữ bên cạnh bàn cờ.',
  },
  {
    title: 'Không tài khoản, không theo dõi',
    body: 'Ván cờ nằm trong máy bạn và ở lại đó. Chỉ khi bạn tự bấm chia sẻ thì mới có một ván rời khỏi máy.',
  },
]

// ---------------------------------------------------------------------------
// What is in it
// ---------------------------------------------------------------------------

export interface Feature {
  title: string
  body: string
}

export const FEATURES: Feature[] = [
  {
    title: 'Đánh với máy hoặc hai người',
    body: 'Chọn cầm Đỏ hay Đen, hoặc gập máy xuống bàn và hai người thay nhau đi trên cùng một màn hình.',
  },
  {
    title: 'Gợi ý — xem trước rồi hẵng đi',
    body: 'Bí thì hỏi. Máy đưa vài phương án kèm lý do, vẽ mũi tên lên bàn cờ, và bạn xem xong mới quyết. Mười lượt mỗi ván.',
  },
  {
    title: 'Đi lại nước vừa rồi',
    body: 'Lỡ tay thì lấy lại, mười lượt mỗi ván — đủ để gỡ một sai lầm, không đủ để dò ra đáp án.',
  },
  {
    title: 'Xem lại cả ván, từng nước',
    body: 'Tua tiến, tua lùi, hoặc để nó tự chạy. Kèm biên bản tiếng Việt: "Pháo 2 bình 5", "Mã 8 tiến 7".',
  },
  {
    title: 'Lịch sử và hồ sơ',
    body: 'Mọi ván đã chơi đều được ghi lại, kèm thắng thua, số nước và mức khó. Hồ sơ cộng lại thành thành tích.',
  },
  {
    title: 'Đủ luật, không cắt bớt',
    body: 'Cản mã, chân tượng, ngòi pháo, tốt qua sông, hai Tướng không nhìn mặt nhau, và cả luật cấm chiếu đuổi liên hoàn.',
  },
  {
    title: 'Chơi tiếp ván dở',
    body: 'Đóng giữa chừng rồi mở lại vẫn đúng thế cờ đó, đúng lượt đó. Không cần bấm lưu.',
  },
  {
    title: 'Chia sẻ ván bằng một tệp',
    body: 'Xuất ván ra tệp và gửi cho người khác mở lên xem. Không tài khoản, không đường dẫn hết hạn.',
  },
  {
    title: 'Sáng và tối theo máy',
    body: 'Bàn cờ đổi màu theo hệ thống. Ban đêm là bàn gỗ tối và quân sáng, không phải một tờ giấy trắng chói mắt.',
  },
]

// ---------------------------------------------------------------------------
// The screenshot strip
// ---------------------------------------------------------------------------

export interface Shot {
  src: string
  alt: string
  caption: string
}

/**
 * Order matters: a strip is read left to right and most people stop after three.
 * So the three that go first are the three no other Vietnamese chess app has —
 * the preview of a suggested move, the board with live commentary, and a real
 * checkmate.
 *
 * Regenerate with `node scripts/site-shots.mjs` after `node scripts/store-shots.mjs`.
 */
export const SHOTS: Shot[] = [
  {
    src: '/shots/04-xem-truoc.webp',
    alt: 'Bàn cờ với mũi tên chỉ nước gợi ý, ô cần chiếm và quân đang bị doạ được khoanh đỏ',
    caption: 'Xem trước nước gợi ý',
  },
  {
    src: '/shots/02-ban-co.webp',
    alt: 'Bàn cờ đang chơi, có lời bình luận viên và bảng cục diện bên dưới',
    caption: 'Bàn cờ và lời bình',
  },
  {
    src: '/shots/05-thang.webp',
    alt: 'Thế chiếu bí và bảng kết quả ván đấu',
    caption: 'Chiếu bí',
  },
  {
    src: '/shots/03-goi-y.webp',
    alt: 'Ba phương án gợi ý, mỗi phương án kèm một câu giải thích',
    caption: 'Ba phương án, kèm lý do',
  },
  {
    src: '/shots/06-menu.webp',
    alt: 'Bảng điều khiển ván đấu với các nút ván mới, đi lại, gợi ý, lật bàn',
    caption: 'Điều khiển ván đấu',
  },
  {
    src: '/shots/07-lich-su.webp',
    alt: 'Danh sách các ván đã chơi kèm kết quả thắng thua',
    caption: 'Lịch sử ván đấu',
  },
  {
    src: '/shots/08-ho-so.webp',
    alt: 'Trang hồ sơ với số ván thắng, thua và hoà',
    caption: 'Hồ sơ thành tích',
  },
  {
    src: '/shots/11-ban-co-toi.webp',
    alt: 'Cùng bàn cờ ấy ở nền tối',
    caption: 'Nền tối',
  },
  {
    src: '/shots/09-cai-dat.webp',
    alt: 'Trang cài đặt với các lựa chọn âm thanh, luật và phiên bản',
    caption: 'Cài đặt',
  },
]

// ---------------------------------------------------------------------------
// The long sections, each with one picture
// ---------------------------------------------------------------------------

export interface Deep {
  title: string
  body: string
  shot: string
  alt: string
}

export const DEEP: Deep[] = [
  {
    title: 'Bí quá thì hỏi — nhưng xem trước đã',
    body:
      'Bấm gợi ý, máy đưa ra vài phương án và nói vì sao: nước này chiếm ngã tư, nước kia cứu con Mã đang bị doạ. Mũi tên vẽ thẳng lên bàn cờ, ô đáng chiếm sáng lên, quân đang nguy được khoanh lại. Bạn xem xong rồi mới quyết có đi hay không — nên nó là chỗ để học, không phải chỗ để máy chơi thay bạn.',
    shot: '/shots/04-xem-truoc.webp',
    alt: 'Nước gợi ý được vẽ bằng mũi tên trên bàn cờ, kèm khung giải thích bên dưới',
  },
  {
    title: 'Có người ngồi cạnh, bình từng nước',
    body:
      'Bình luận viên gọi tên quân và gọi tên thế trận theo suốt ván, đoán trước vài nước, và lúc rảnh thì kể chuyện quán cờ. Nghe được bằng tiếng, và nếu bạn đang ở chỗ không tiện bật loa thì mọi câu ấy chạy thành chữ trong khung bên cạnh bàn cờ.',
    shot: '/shots/02-ban-co.webp',
    alt: 'Bàn cờ đang chơi kèm khung lời bình bên dưới',
  },
  {
    title: 'Thua rồi thì biết mình thua ở nước nào',
    body:
      'Mọi ván đã chơi đều nằm trong Lịch sử, mở ra xem lại được từng nước một: tua tiến, tua lùi, hay để nó tự chạy như xem lại một trận đấu. Biên bản viết bằng tiếng Việt, nên đọc "Pháo 2 bình 5" chứ không phải đọc mã ô cờ.',
    shot: '/shots/07-lich-su.webp',
    alt: 'Danh sách các ván đã chơi với huy hiệu thắng thua',
  },
  {
    title: 'Càng chơi, máy càng khó thắng',
    body:
      'Sau mỗi ván, máy ghi lại những nước đã dẫn nó tới chỗ thua và lần sau tránh đi. Nó không tải gì về và không gửi gì đi — cuốn sổ ấy nằm trong máy bạn, và nó là của riêng ván cờ giữa bạn với nó.',
    shot: '/shots/05-thang.webp',
    alt: 'Bảng kết quả cuối ván',
  },
]

// ---------------------------------------------------------------------------
// The fact table
// ---------------------------------------------------------------------------

export interface Fact {
  term: string
  value: string
}

/**
 * The version and the date are not here: they come from `changelog.ts` at
 * render time, so a release cannot ship with the front page still naming the
 * one before it.
 */
export const FACTS: Fact[] = [
  { term: 'Thể loại', value: 'Cờ tướng · một người hoặc hai người một máy' },
  { term: 'Ngôn ngữ', value: 'Tiếng Việt' },
  { term: 'Giá', value: 'Miễn phí, không mua thêm gì trong ứng dụng' },
  { term: 'Cần mạng', value: 'Không — chỉ cần mạng lần đầu để tải về' },
  { term: 'Tài khoản', value: 'Không' },
  { term: 'Quảng cáo', value: 'Không' },
  { term: 'Dữ liệu thu thập', value: 'Không thu thập gì' },
  { term: 'Chạy trên', value: 'Trình duyệt · macOS · Windows · Linux · Android (cài từ trình duyệt)' },
  { term: 'Giấy phép', value: 'MIT — mã nguồn mở, ai cũng đọc và sửa được' },
]
