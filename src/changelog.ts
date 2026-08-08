/**
 * What changed, written for the person playing rather than the person building.
 *
 * ## The rule for whoever edits this next
 *
 * **Every release adds an entry here, and the entry is in ordinary Vietnamese.**
 * Not "container queries", "service worker", "transposition table" or "cascade
 * layer" — a player has no way to know whether any of those is good news. Say
 * what they will notice:
 *
 * * not "adaptive time budget with measured branching factor"
 *   but "máy thôi ngồi nghĩ khi nước đã rõ"
 * * not "the service worker's activate sweep is prefix-scoped"
 *   but "gói tiếng nói không còn bị xoá mỗi lần cập nhật"
 * * not "board sized by container query units"
 *   but "bàn cờ không còn bị cắt mất hàng cuối"
 *
 * If a change cannot be written that way, it is probably a change nobody will
 * notice, and it does not need an entry.
 *
 * ## Bold, and the occasional link
 *
 * Each line takes `**đậm**` for the two or three words someone would search
 * for, and `[nhãn](/settings)` for a place in the app they can go and see the
 * thing. Release notes are read by someone scanning; an even wall of grey makes
 * them read all of it or none of it. See `RichText` for the whole syntax, which
 * is those two things and nothing else.
 *
 * Newest first. `date` is the day it went out, not the day it was written.
 */

export interface Release {
  version: string
  /** ISO date, so it can be formatted for the reader rather than stored formatted. */
  date: string
  /** One line. What this release was about, if someone reads nothing else. */
  headline: string
  /** Things that were not there before. */
  added?: string[]
  /** Things that were there and are better. */
  improved?: string[]
  /** Things that were broken. Said plainly; nobody is fooled by silence. */
  fixed?: string[]
}

export const RELEASES: Release[] = [
  {
    version: '0.7.1',
    date: '2026-08-09',
    headline: 'Xem trước nước gợi ý thôi bị cắt ngang.',
    fixed: [
      'Khi **xem trước một nước gợi ý**, khung phía dưới bị cắt mất nửa dòng và để lại một mảng trắng. Giờ nó chỉ hiện đúng nước đang xem, kèm hai nút **Xem phương án khác** và **Đi nước này**.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-08-09',
    headline: 'Có trang **Có gì mới**, và chuyển trang thôi đứng hình.',
    added: [
      'Trang [**Có gì mới**](/changelog) — danh sách mọi bản đã phát hành, bấm vào một bản để xem chi tiết. Vào được từ trang chủ, từ menu, và từ mục phiên bản trong [Cài đặt](/settings).',
      'Khi một màn hình gặp trục trặc, giờ có **trang báo lỗi tử tế** với nút tải lại và nút về trang chủ, thay vì một trang trắng đầy chữ kỹ thuật.',
      'Có **vạch báo đang chuyển trang** ở mép trên, để biết ứng dụng đã nhận cú chạm.',
    ],
    fixed: [
      '**Chuyển trang từ màn chơi bị đứng hẳn** — bấm sang Cài đặt hay Lịch sử thì địa chỉ đổi mà màn hình không đổi.',
      'Thanh menu dưới **đội cao bất thường** trên iPhone, để lại một dải trống.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-08-08',
    headline: 'Giao diện mới cho cả ứng dụng, và máy biết tiếc thời gian của bạn.',
    added: [
      '**Giao diện mới dùng chung cho mọi màn hình**: menu dọc bên trái trên máy tính, thanh dưới trên điện thoại, và một cột bình luận cạnh bàn cờ khi màn hình đủ rộng.',
      'Lần đầu mở game có **màn chuẩn bị kèm thanh tiến độ**, cho biết còn phải tải bao nhiêu. Những lần sau mở là vào thẳng.',
      '[Cài đặt](/settings) hiện **tốc độ máy của bạn** và thời gian nghĩ tối đa của từng mức khó, kèm nút đo lại.',
      'Trang nhật ký cập nhật — chính là trang bạn đang đọc.',
    ],
    improved: [
      '**Máy dừng nghĩ khi nước đã rõ** thay vì đốt hết giờ. Trên một thế cờ thật, vẫn ra đúng nước ấy nhưng **nhanh gấp bốn lần**.',
      '**Máy chậm được cho thêm giờ** để vẫn nghĩ đủ sâu, nên một mức khó có cùng sức mạnh trên điện thoại và trên máy tính.',
      'Rời màn chơi hoặc chuyển sang ứng dụng khác thì **ván tự dừng**, đỡ nóng máy và đỡ tốn pin.',
      '**Bàn cờ to hơn hẳn** và nằm sát mép trên, rõ nhất là trên điện thoại.',
      'Menu bên trái thu gọn được, và nhớ lựa chọn của bạn.',
      'Khi đang thua, máy tìm đường chống đỡ lâu nhất thay vì buông xuôi cho nhanh.',
    ],
    fixed: [
      '**Gói tiếng nói đã tải không còn bị xoá mất** mỗi lần ứng dụng cập nhật.',
      '**Chơi khi không có mạng** đã chạy lại được.',
      'Sau khi xem trước một nước gợi ý thì không bấm được menu nào nữa.',
      'Chuyển trang từ màn chơi bị đứng hẳn.',
      'Trên iPhone, thanh menu dưới che mất hàng nút cuối trang Cài đặt.',
      'Cùng một câu bình luận hiện ở hai chỗ cùng lúc.',
      'Ván cờ tự dựng lại khi máy gặp trục trặc, thay vì đứng im cho tới lúc tải lại trang.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-07',
    headline: 'Bàn cờ không bao giờ bị cắt, ở bất kỳ khổ màn hình nào.',
    improved: [
      '**Bàn cờ luôn hiện đủ mười hàng**, dù cầm dọc hay ngang, trên điện thoại hay máy tính bảng.',
      'Menu trong ván thành ngăn kéo trượt từ cạnh, không còn che bàn cờ.',
      'Bảng cục diện thu gọn còn hai dòng, mở ra khi bạn muốn xem kỹ.',
      'Bảng phiên bản dọn từ trang Giới thiệu sang Cài đặt, nơi có nút để làm gì đó với nó.',
    ],
    fixed: [
      'Bàn cờ trượt lên xuống dưới ngón tay khi có gì đó quanh nó đổi kích thước.',
      'Hộp thoại bị cắt mất phần dưới khi xoay ngang máy.',
      'Chạm hai ngón vô tình làm phóng to bàn cờ và không biết đường về.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-08-07',
    headline: 'Diện mạo mới, và máy đánh cờ khó hơn hẳn.',
    added: [
      '**Quản lý gói tiếng nói ngoại tuyến** trong [Cài đặt](/settings): thấy đã tải bao nhiêu phần trăm, tạm dừng và tải tiếp khi mạng yếu.',
      'Logo và bộ biểu tượng mới.',
    ],
    improved: [
      '**Nâng cả thang độ khó**: mức Dễ bây giờ mạnh đúng bằng mức **Siêu khó** của bản trước.',
      'Mỗi mức khó là một độ sâu suy nghĩ kèm trần thời gian, nên thế cờ đơn giản được trả lời ngay.',
      'Giao diện gọn lại, ít chữ hơn, thân thiện với ngón tay hơn.',
    ],
    fixed: [
      'Nút xác nhận trong hộp thoại bị thanh địa chỉ của Safari che mất.',
      'Thắng rồi mà vẫn được mời đi lại nước vừa rồi.',
      'Màn chơi giật khi có gì đó thêm vào giao diện.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-08-06',
    headline: 'Bản đầu tiên: chơi được trọn vẹn, không cần mạng.',
    added: [
      'Đánh với máy hoặc hai người trên cùng một thiết bị, **hoàn toàn ngoại tuyến**.',
      '**Bình luận viên** kể chuyện ván cờ theo giọng kiếm hiệp, gọi tên thế trận và thỉnh thoảng mách nước.',
      '**Gợi ý ba phương án** kèm lý do cho từng phương án, xem trước được trên bàn cờ.',
      '[Lịch sử ván đấu](/history) và xem lại từng nước một.',
      'Âm thanh riêng cho từng loại quân.',
      'Cài lên máy như một ứng dụng, chơi được khi mất mạng.',
    ],
  },
]
