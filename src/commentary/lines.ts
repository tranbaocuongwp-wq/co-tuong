/**
 * The commentator's script.
 *
 * Written in the register of a wuxia storyteller: needling, theatrical, a
 * little funny. The computer is not a calculator here, it is an opponent with a
 * mouth — which is far better company through a five-second think than "depth
 * 11, −0.05".
 *
 * Every line carries a stable `id`. That id is the filename of its recording in
 * R2, so text and audio stay married even as lines are added; never renumber an
 * existing id, only append.
 */

export type Situation =
  /** Spoken once as a game begins - the commentator taking their seat. */
  | 'greeting'
  /** While the computer is choosing a move. */
  | 'thinking'
  /** Thinking, and the computer is comfortably ahead. */
  | 'thinkingAhead'
  /** Thinking, and the computer is worse off. */
  | 'thinkingBehind'
  /** Thinking, and it has spotted a forced mate. */
  | 'thinkingMate'
  /** First moves of the game. */
  | 'opening'
  /** The computer took a piece. */
  | 'engineCapture'
  /** The player took a piece. */
  | 'playerCapture'
  /** The player's king is in check. */
  | 'playerCheck'
  /** The computer's king is in check. */
  | 'engineCheck'
  /** Few pieces left. */
  | 'endgame'
  /** The player is in serious trouble. */
  | 'playerLosing'
  /** The computer is in serious trouble. */
  | 'engineLosing'
  /** Moves are repeating. */
  | 'repetition'
  /** The position has just swung; the commentator calls what is coming. */
  | 'prediction'
  /** A forced mate is on the board and the commentator has seen it. */
  | 'foreseeMate'
  /**
   * Filler while nothing is happening — an anecdote, a scrap of chess history,
   * a memory of a roadside chess house.
   *
   * This is what a broadcast does during a long think, and it is the reason
   * there is never dead air: the player can sit on a move for a minute and the
   * commentator keeps the room warm rather than falling silent.
   */
  | 'story'
  | 'playerWin'
  | 'playerLose'
  | 'draw'

export interface Line {
  /** Stable identifier, and the audio filename in R2. */
  id: string
  /** Shown on screen. Kept clean of markup. */
  text: string
  /**
   * Sent to text-to-speech instead of `text` when present.
   *
   * ElevenLabs v3 reads inline tags such as `[cười khẩy]` or `[thì thầm]` as
   * performance directions rather than speaking them, which is what turns a
   * flat reading into a character. The display text stays plain so the tags
   * never leak onto the screen.
   */
  speech?: string
}

/**
 * Lines per situation.
 *
 * Deliberately many: a commentator that repeats itself stops being a character
 * and becomes a notification.
 */
export const LINES: Record<Situation, Line[]> = {
  thinking: [
    { id: 'think-01', text: 'Để lão phu ngẫm một chút…', speech: '[trầm ngâm] Để lão phu... ngẫm một chút.' },
    { id: 'think-02', text: 'Nước này có mùi bẫy đây…', speech: '[nghi ngờ] Nước này... có mùi bẫy đây.' },
    { id: 'think-03', text: 'Hừm. Ngươi tưởng ta không thấy sao?', speech: '[cười khẩy] Hừm. Ngươi tưởng ta không thấy sao?' },
    { id: 'think-04', text: 'Cao thủ đi chậm, ngươi cứ từ từ.', speech: '[ung dung] Cao thủ đi chậm. Ngươi cứ từ từ.' },
    { id: 'think-05', text: 'Ta đang đếm xem ngươi còn mấy đường sống…', speech: '[thì thầm] Ta đang đếm xem ngươi còn mấy đường sống...' },
    { id: 'think-06', text: 'Bàn cờ này bắt đầu thú vị rồi đấy.', speech: '[hào hứng] Bàn cờ này bắt đầu thú vị rồi đấy!' },
    { id: 'think-07', text: 'Đừng nôn nóng, hay ho còn ở phía sau.', speech: '[ranh mãnh] Đừng nôn nóng. Hay ho còn ở phía sau.' },
    { id: 'think-08', text: 'Ta thấy ba nước. Chọn nước nào cho ngươi đau nhất đây?', speech: '[suy tính] Ta thấy ba nước. Chọn nước nào cho ngươi đau nhất đây?' },
    { id: 'think-09', text: 'Uống ngụm trà đã, ván này còn dài.', speech: '[thong thả] Uống ngụm trà đã. Ván này còn dài.' },
    { id: 'think-10', text: 'Ngươi vừa mở một cánh cửa. Ta đang xem nên bước vào không.', speech: '[tò mò] Ngươi vừa mở một cánh cửa. Ta đang xem... nên bước vào không.' },
    { id: 'think-11', text: 'Trên bàn cờ, kẻ vội là kẻ thua.', speech: '[nghiêm nghị] Trên bàn cờ, kẻ vội là kẻ thua.' },
    { id: 'think-12', text: 'Nước cờ của ngươi… can đảm đấy.', speech: '[mỉa mai] Nước cờ của ngươi... can đảm đấy.' },
    { id: 'think-13', text: 'Ta đang cân nhắc nên nhẹ tay hay không.', speech: '[cười nhẹ] Ta đang cân nhắc nên nhẹ tay hay không.' },
    { id: 'think-14', text: 'Im lặng. Sát khí đang tụ.', speech: '[thì thầm] Im lặng. Sát khí đang tụ.' },
    { id: 'think-15', text: 'Ngươi đi nhanh quá, ta theo không kịp… đùa thôi.', speech: '[cười lớn] Ngươi đi nhanh quá, ta theo không kịp... đùa thôi!' },
  ],
  thinkingAhead: [
    { id: 'ahead-01', text: 'Thế cờ đã nghiêng rồi, ngươi có thấy không?', speech: '[đắc ý] Thế cờ đã nghiêng rồi. Ngươi có thấy không?' },
    { id: 'ahead-02', text: 'Ta đang chọn cách thắng cho đẹp mắt.', speech: '[thong thả] Ta đang chọn cách thắng... cho đẹp mắt.' },
    { id: 'ahead-03', text: 'Đừng lo, ta sẽ kết thúc nhanh gọn thôi.', speech: '[nhẹ nhàng] Đừng lo. Ta sẽ kết thúc nhanh gọn thôi.' },
    { id: 'ahead-04', text: 'Gió đã đổi chiều. Ngươi ngửi thấy chứ?', speech: '[thì thầm] Gió đã đổi chiều. Ngươi ngửi thấy chứ?' },
    { id: 'ahead-05', text: 'Ta có thể ăn ngay, nhưng để ngươi hy vọng thêm chút nữa.', speech: '[cười khẩy] Ta có thể ăn ngay... nhưng để ngươi hy vọng thêm chút nữa.' },
    { id: 'ahead-06', text: 'Thành trì của ngươi đang nứt rồi đó.', speech: '[đắc ý] Thành trì của ngươi đang nứt rồi đó.' },
    { id: 'ahead-07', text: 'Bây giờ mới là lúc ta ra tay thật.', speech: '[nghiêm nghị] Bây giờ mới là lúc ta ra tay thật.' },
  ],
  thinkingBehind: [
    { id: 'behind-01', text: 'Hay! Nước đó ta không ngờ tới.', speech: '[kinh ngạc] Hay! Nước đó ta không ngờ tới.' },
    { id: 'behind-02', text: 'Ngươi ép ta phải nghĩ nghiêm túc rồi đấy.', speech: '[nghiêm túc] Ngươi ép ta phải nghĩ nghiêm túc rồi đấy.' },
    { id: 'behind-03', text: 'Đường lui đã hẹp… nhưng chưa tuyệt.', speech: '[căng thẳng] Đường lui đã hẹp... nhưng chưa tuyệt.' },
    { id: 'behind-04', text: 'Lão phu hơi bất cẩn. Chỉ hơi thôi.', speech: '[gượng gạo] Lão phu hơi bất cẩn. Chỉ hơi thôi.' },
    { id: 'behind-05', text: 'Kẻ mạnh không phải kẻ không ngã, mà là kẻ biết đứng dậy.', speech: '[kiên định] Kẻ mạnh không phải kẻ không ngã, mà là kẻ biết đứng dậy.' },
    { id: 'behind-06', text: 'Ngươi khá lắm. Nhưng ván cờ chưa tàn.', speech: '[thán phục] Ngươi khá lắm. Nhưng ván cờ chưa tàn.' },
    { id: 'behind-07', text: 'Ta phải tìm một tia sáng trong thế cùng này…', speech: '[trầm ngâm] Ta phải tìm một tia sáng trong thế cùng này...' },
  ],
  thinkingMate: [
    { id: 'mate-01', text: 'Ta đã thấy đường kết rồi.', speech: '[lạnh lùng] Ta đã thấy đường kết rồi.' },
    { id: 'mate-02', text: 'Lưới đã giăng xong. Ngươi chạy đi đâu?', speech: '[thì thầm] Lưới đã giăng xong. Ngươi chạy đi đâu?' },
    { id: 'mate-03', text: 'Đếm ngược thôi.', speech: '[lạnh lùng] Đếm ngược thôi.' },
    { id: 'mate-04', text: 'Cửa sinh đã khép.', speech: '[dứt khoát] Cửa sinh... đã khép.' },
    { id: 'mate-05', text: 'Xin lỗi. Từ đây trở đi chỉ còn một kết cục.', speech: '[điềm tĩnh] Xin lỗi. Từ đây trở đi chỉ còn một kết cục.' },
    {
      id: 'mate-06',
      text: 'Nó thấy đường rồi. Ngươi liệu mà chống.',
      speech:
        '[thì thầm] Nó thấy đường rồi. [nghiêm giọng] Ngươi liệu mà chống.',
    },
    {
      id: 'mate-07',
      text: 'Máy tính im lặng kiểu này là đã tính xong.',
      speech:
        '[trầm ngâm] Máy tính im lặng kiểu này... [lạnh lùng] là đã tính xong.',
    },
    {
      id: 'mate-08',
      text: 'Trong đầu nó, ván cờ đã kết thúc.',
      speech:
        '[thì thầm] Trong đầu nó... [chậm rãi] ván cờ đã kết thúc.',
    },
  ],
  opening: [
    { id: 'open-01', text: 'Hai bên bày trận. Sát khí đã nổi.', speech: '[hào hùng] Hai bên bày trận. Sát khí đã nổi!' },
    { id: 'open-02', text: 'Khai cuộc định hình cả ván cờ. Cẩn thận từng nước.', speech: '[nghiêm nghị] Khai cuộc định hình cả ván cờ. Cẩn thận từng nước.' },
    { id: 'open-03', text: 'Pháo đã lên nòng, mã đã ra chuồng.', speech: '[hào hứng] Pháo đã lên nòng, mã đã ra chuồng.' },
    { id: 'open-04', text: 'Trận này ai làm chủ trung lộ, người đó nắm thế.', speech: '[giảng giải] Trận này ai làm chủ trung lộ, người đó nắm thế.' },
    { id: 'open-05', text: 'Màn mở đầu, ai cũng lịch sự. Chờ xem lát nữa.', speech: '[ranh mãnh] Màn mở đầu, ai cũng lịch sự. Chờ xem lát nữa.' },
    {
      id: 'open-06',
      text: 'Khai cuộc còn nhẹ tay. Nhưng thế trận đã bắt đầu nhen lửa.',
      speech:
        '[điềm tĩnh] Khai cuộc còn nhẹ tay. [ranh mãnh] Nhưng thế trận... đã bắt đầu nhen lửa.',
    },
    {
      id: 'open-07',
      text: 'Mấy nước đầu chưa nói lên điều gì, mà cũng nói lên tất cả.',
      speech:
        '[trầm ngâm] Mấy nước đầu chưa nói lên điều gì... [nhấn mạnh] mà cũng nói lên tất cả.',
    },
    {
      id: 'open-08',
      text: 'Bày binh bố trận. Ai vội người ấy thiệt.',
      speech:
        '[dõng dạc] Bày binh bố trận. [cảnh báo] Ai vội... người ấy thiệt.',
    },
    {
      id: 'open-09',
      text: 'Pháo giữ giữa, mã giữ biên. Sách vở là vậy, còn người thì tùy.',
      speech:
        '[điềm tĩnh] Pháo giữ giữa, mã giữ biên. [cười nhẹ] Sách vở là vậy... còn người thì tùy.',
    },
    {
      id: 'open-10',
      text: 'Chưa chạm nhau, mà không khí đã đặc lại rồi.',
      speech:
        '[thì thầm] Chưa chạm nhau... [căng thẳng] mà không khí đã đặc lại rồi.',
    },
  ],
  engineCapture: [
    { id: 'ecap-01', text: 'Quân đó ta nhận. Cảm ơn.', speech: '[đắc ý] Quân đó ta nhận. Cảm ơn!' },
    { id: 'ecap-02', text: 'Một mạng đổi một thế. Đáng.', speech: '[điềm tĩnh] Một mạng đổi một thế. Đáng.' },
    { id: 'ecap-03', text: 'Ngươi để hở rồi.', speech: '[cười khẩy] Ngươi để hở rồi.' },
    { id: 'ecap-04', text: 'Trên bàn cờ, sơ hở nào cũng phải trả giá.', speech: '[nghiêm nghị] Trên bàn cờ, sơ hở nào cũng phải trả giá.' },
    { id: 'ecap-05', text: 'Ta lấy quân này, ngươi lấy bài học.', speech: '[mỉa mai] Ta lấy quân này, ngươi lấy bài học.' },
    { id: 'ecap-06', text: 'Ít một quân, nặng một phần lo.', speech: '[trầm giọng] Ít một quân... nặng một phần lo.' },
    {
      id: 'ecap-07',
      text: 'Mất một quân! Đối thủ ra tay không hề do dự.',
      speech:
        '[giật mình] Mất một quân! [lạnh lùng] Đối thủ ra tay... không hề do dự.',
    },
    {
      id: 'ecap-08',
      text: 'Đó là một nước ăn lạnh lùng. Không thừa nửa phân.',
      speech:
        '[lạnh lùng] Đó là một nước ăn lạnh lùng. [nhấn mạnh] Không thừa nửa phân.',
    },
    {
      id: 'ecap-09',
      text: 'Quân rơi khỏi bàn. Thế cờ đổi màu.',
      speech:
        '[trầm giọng] Quân rơi khỏi bàn. [chậm rãi] Thế cờ... đổi màu.',
    },
    {
      id: 'ecap-10',
      text: 'Máy tính chẳng thương ai. Thấy hở là lấy.',
      speech:
        '[cười khẩy] Máy tính chẳng thương ai. [dứt khoát] Thấy hở là lấy.',
    },
  ],
  playerCapture: [
    { id: 'pcap-01', text: 'Được! Nước đó sắc bén.', speech: '[thán phục] Được! Nước đó sắc bén.' },
    { id: 'pcap-02', text: 'Ngươi ra tay không nương tình.', speech: '[nghiêm túc] Ngươi ra tay không nương tình.' },
    { id: 'pcap-03', text: 'Ta ghi nhớ món nợ này.', speech: '[lạnh lùng] Ta ghi nhớ món nợ này.' },
    { id: 'pcap-04', text: 'Hừ. Ta cho ngươi mượn tạm thôi.', speech: '[hậm hực] Hừ! Ta cho ngươi mượn tạm thôi.' },
    { id: 'pcap-05', text: 'Một quân đổi lấy sự cảnh giác của ta.', speech: '[điềm tĩnh] Một quân đổi lấy sự cảnh giác của ta.' },
    {
      id: 'pcap-06',
      text: 'Hay! Nước ăn này có tính toán phía sau.',
      speech:
        '[phấn khích] Hay! [tán thưởng] Nước ăn này... có tính toán phía sau.',
    },
    {
      id: 'pcap-07',
      text: 'Ra tay dứt khoát. Lão phu thích cái khí đó.',
      speech:
        '[tán thưởng] Ra tay dứt khoát. [ấm áp] Lão phu thích cái khí đó.',
    },
    {
      id: 'pcap-08',
      text: 'Một quân đổi một thế. Đáng.',
      speech:
        '[điềm tĩnh] Một quân đổi một thế. [nhấn mạnh] Đáng.',
    },
    {
      id: 'pcap-09',
      text: 'Bắt được rồi! Đối thủ chắc không ngờ tới.',
      speech:
        '[phấn khích] Bắt được rồi! [ranh mãnh] Đối thủ chắc... không ngờ tới.',
    },
    {
      id: 'pcap-10',
      text: 'Chớp thời cơ đúng lúc. Đó là bản lĩnh.',
      speech:
        '[tán thưởng] Chớp thời cơ đúng lúc. [trang trọng] Đó là bản lĩnh.',
    },
  ],
  playerCheck: [
    { id: 'pchk-01', text: 'Chiếu tướng! Ngươi liệu đường mà lui.', speech: '[dõng dạc] Chiếu tướng! Ngươi liệu đường mà lui.' },
    { id: 'pchk-02', text: 'Tướng lộ diện là tướng lâm nguy.', speech: '[cảnh báo] Tướng lộ diện là tướng lâm nguy.' },
    { id: 'pchk-03', text: 'Đao đã kề cổ.', speech: '[thì thầm] Đao đã kề cổ.' },
    { id: 'pchk-04', text: 'Chạy đi. Nếu còn chỗ mà chạy.', speech: '[thách thức] Chạy đi. Nếu còn chỗ mà chạy.' },
    { id: 'pchk-05', text: 'Cẩn thận! Một nước sai là xong đời.', speech: '[gấp gáp] Cẩn thận! Một nước sai là xong đời.' },
    {
      id: 'pchk-06',
      text: 'Tướng ngươi bị chiếu! Đừng luống cuống.',
      speech:
        '[gấp gáp] Tướng ngươi bị chiếu! [trấn an] Đừng luống cuống.',
    },
    {
      id: 'pchk-07',
      text: 'Chiếu! Giờ mới là lúc thử gan.',
      speech:
        '[dõng dạc] Chiếu! [thì thầm] Giờ mới là lúc... thử gan.',
    },
    {
      id: 'pchk-08',
      text: 'Tướng lộ rồi. Che cho kín, kẻo hối không kịp.',
      speech:
        '[cảnh báo] Tướng lộ rồi. [gấp gáp] Che cho kín... kẻo hối không kịp.',
    },
    {
      id: 'pchk-09',
      text: 'Một tiếng chiếu vang lên. Cả bàn cờ nín thở.',
      speech:
        '[hào hùng] Một tiếng chiếu vang lên. [thì thầm] Cả bàn cờ... nín thở.',
    },
    {
      id: 'pchk-10',
      text: 'Nguy! Nhưng chưa chết. Bình tĩnh mà gỡ.',
      speech:
        '[gấp gáp] Nguy! [trấn an] Nhưng chưa chết. Bình tĩnh mà gỡ.',
    },
  ],
  engineCheck: [
    { id: 'echk-01', text: 'Chiếu ta ư? Gan lớn đấy.', speech: '[cười khẩy] Chiếu ta ư? Gan lớn đấy.' },
    { id: 'echk-02', text: 'Được, ta lui một bước. Chỉ một bước thôi.', speech: '[bình thản] Được. Ta lui một bước. Chỉ một bước thôi.' },
    { id: 'echk-03', text: 'Ngươi dám đụng đến soái kỳ của ta.', speech: '[giận dữ] Ngươi dám đụng đến soái kỳ của ta!' },
    { id: 'echk-04', text: 'Nước này ép ta hơi rát.', speech: '[nhăn nhó] Nước này ép ta hơi rát.' },
    {
      id: 'echk-05',
      text: 'Chiếu ngược lại! Đối thủ phải lo thân trước đã.',
      speech:
        '[phấn khích] Chiếu ngược lại! [ranh mãnh] Đối thủ phải lo thân trước đã.',
    },
    {
      id: 'echk-06',
      text: 'Đẹp! Một đòn chiếu đúng lúc, cả thế trận phải dừng lại.',
      speech:
        '[phấn khích] Đẹp! [tán thưởng] Một đòn chiếu đúng lúc... cả thế trận phải dừng lại.',
    },
    {
      id: 'echk-07',
      text: 'Tướng địch bị lôi ra ánh sáng rồi.',
      speech:
        '[hào hứng] Tướng địch... [nhấn mạnh] bị lôi ra ánh sáng rồi.',
    },
    {
      id: 'echk-08',
      text: 'Chiếu! Máy tính cũng phải cúi đầu tính lại.',
      speech:
        '[dõng dạc] Chiếu! [cười khẩy] Máy tính cũng phải cúi đầu tính lại.',
    },
    {
      id: 'echk-09',
      text: 'Đòn này bén. Đối phương hết đường thong thả.',
      speech:
        '[tán thưởng] Đòn này bén. [lạnh lùng] Đối phương... hết đường thong thả.',
    },
    {
      id: 'echk-10',
      text: 'Ngươi ép được nó rồi đấy. Giữ nhịp này.',
      speech:
        '[hào hứng] Ngươi ép được nó rồi đấy. [nghiêm giọng] Giữ nhịp này.',
    },
  ],
  endgame: [
    { id: 'end-01', text: 'Quân đã thưa, giờ mới là lúc phân cao thấp.', speech: '[nghiêm nghị] Quân đã thưa. Giờ mới là lúc phân cao thấp.' },
    { id: 'end-02', text: 'Tàn cuộc. Từng nước một đều nặng như núi.', speech: '[trầm giọng] Tàn cuộc. Từng nước một đều nặng như núi.' },
    { id: 'end-03', text: 'Ít quân thì mỗi tốt đều quý như vàng.', speech: '[giảng giải] Ít quân thì mỗi tốt đều quý như vàng.' },
    { id: 'end-04', text: 'Đến đây, kẻ nào bình tĩnh hơn sẽ thắng.', speech: '[điềm tĩnh] Đến đây, kẻ nào bình tĩnh hơn sẽ thắng.' },
    { id: 'end-05', text: 'Bàn cờ trống trải, mà lòng người thì căng.', speech: '[trầm ngâm] Bàn cờ trống trải... mà lòng người thì căng.' },
    {
      id: 'end-06',
      text: 'Quân đã thưa. Từ đây mỗi nước nặng bằng mười nước lúc đầu.',
      speech:
        '[trầm ngâm] Quân đã thưa. [nhấn mạnh] Từ đây... mỗi nước nặng bằng mười nước lúc đầu.',
    },
    {
      id: 'end-07',
      text: 'Tàn cuộc rồi. Không còn chỗ mà giấu sai lầm.',
      speech:
        '[trầm giọng] Tàn cuộc rồi. [nghiêm giọng] Không còn chỗ... mà giấu sai lầm.',
    },
    {
      id: 'end-08',
      text: 'Bàn cờ trống trải. Tướng bắt đầu phải tự đi.',
      speech:
        '[chậm rãi] Bàn cờ trống trải. [thì thầm] Tướng bắt đầu... phải tự đi.',
    },
    {
      id: 'end-09',
      text: 'Ít quân mà khó hơn nhiều quân. Đó là cái lạ của cờ tướng.',
      speech:
        '[trầm ngâm] Ít quân mà khó hơn nhiều quân. [ấm áp] Đó là cái lạ của cờ tướng.',
    },
    {
      id: 'end-10',
      text: 'Đến đoạn này, ai bình tĩnh hơn người ấy thắng.',
      speech:
        '[điềm tĩnh] Đến đoạn này... [nhấn mạnh] ai bình tĩnh hơn, người ấy thắng.',
    },
  ],
  playerLosing: [
    { id: 'plose-01', text: 'Thế của ngươi đang bí rồi đó.', speech: '[thì thầm] Thế của ngươi... đang bí rồi đó.' },
    { id: 'plose-02', text: 'Còn đường nào không? Ta thì thấy rất ít.', speech: '[mỉa mai] Còn đường nào không? Ta thì thấy rất ít.' },
    { id: 'plose-03', text: 'Vây đã khép ba mặt.', speech: '[lạnh lùng] Vây đã khép ba mặt.' },
    { id: 'plose-04', text: 'Đây là lúc cần một nước cờ thần.', speech: '[căng thẳng] Đây là lúc cần một nước cờ thần.' },
    { id: 'plose-05', text: 'Bình tĩnh. Càng rối càng nhanh thua.', speech: '[khuyên nhủ] Bình tĩnh. Càng rối càng nhanh thua.' },
    {
      id: 'plose-06',
      text: 'Thế ngươi đang xấu. Nhưng cờ chưa tàn thì chưa xong.',
      speech:
        '[nghiêm giọng] Thế ngươi đang xấu. [khích lệ] Nhưng cờ chưa tàn... thì chưa xong.',
    },
    {
      id: 'plose-07',
      text: 'Khó rồi. Tìm lấy một nước rối, may ra còn cửa.',
      speech:
        '[trầm giọng] Khó rồi. [thì thầm] Tìm lấy một nước rối... may ra còn cửa.',
    },
    {
      id: 'plose-08',
      text: 'Đối thủ đang siết dần. Phải phá thế, không thể ngồi im.',
      speech:
        '[căng thẳng] Đối thủ đang siết dần. [gấp gáp] Phải phá thế... không thể ngồi im.',
    },
    {
      id: 'plose-09',
      text: 'Lão phu nói thật, thế này mà gỡ được thì đáng nể.',
      speech:
        '[thẳng thắn] Lão phu nói thật... [nhấn mạnh] thế này mà gỡ được thì đáng nể.',
    },
    {
      id: 'plose-10',
      text: 'Đừng đổi quân nữa. Càng đổi càng thiệt.',
      speech:
        '[cảnh báo] Đừng đổi quân nữa. [dứt khoát] Càng đổi... càng thiệt.',
    },
  ],
  engineLosing: [
    { id: 'elose-01', text: 'Ta đang ở thế hạ phong. Nhận là nhận.', speech: '[thẳng thắn] Ta đang ở thế hạ phong. Nhận là nhận.' },
    { id: 'elose-02', text: 'Ngươi đánh hay hơn ta tưởng nhiều.', speech: '[thán phục] Ngươi đánh hay hơn ta tưởng nhiều.' },
    { id: 'elose-03', text: 'Còn nước còn tát.', speech: '[kiên cường] Còn nước còn tát!' },
    { id: 'elose-04', text: 'Ván này ta phải liều thôi.', speech: '[quyết liệt] Ván này ta phải liều thôi.' },
    {
      id: 'elose-05',
      text: 'Máy tính đang đuối! Cơ hội đây rồi.',
      speech:
        '[phấn khích] Máy tính đang đuối! [hào hứng] Cơ hội đây rồi.',
    },
    {
      id: 'elose-06',
      text: 'Thế của nó vỡ rồi. Ép tới, đừng nới tay.',
      speech:
        '[hào hứng] Thế của nó vỡ rồi. [dõng dạc] Ép tới... đừng nới tay.',
    },
    {
      id: 'elose-07',
      text: 'Hiếm lắm mới thấy nó lúng túng thế này.',
      speech:
        '[ngạc nhiên] Hiếm lắm... [cười nhẹ] mới thấy nó lúng túng thế này.',
    },
    {
      id: 'elose-08',
      text: 'Ngươi đang cầm đằng chuôi. Cẩn thận mà kết liễu.',
      speech:
        '[hào hứng] Ngươi đang cầm đằng chuôi. [nghiêm giọng] Cẩn thận... mà kết liễu.',
    },
    {
      id: 'elose-09',
      text: 'Đối thủ hết bài rồi. Giờ chỉ còn chống đỡ.',
      speech:
        '[lạnh lùng] Đối thủ hết bài rồi. [chậm rãi] Giờ chỉ còn chống đỡ.',
    },
    {
      id: 'elose-10',
      text: 'Đừng vội. Thế thắng dễ tuột nhất là lúc tưởng đã chắc.',
      speech:
        '[cảnh báo] Đừng vội. [nhấn mạnh] Thế thắng dễ tuột nhất... là lúc tưởng đã chắc.',
    },
  ],
  repetition: [
    { id: 'rep-01', text: 'Hai bên cứ đi tới đi lui thế này thì hòa mất.', speech: '[chán nản] Hai bên cứ đi tới đi lui thế này thì hòa mất.' },
    { id: 'rep-02', text: 'Lặp nước rồi. Ai chịu đổi trước đây?', speech: '[thúc giục] Lặp nước rồi. Ai chịu đổi trước đây?' },
    { id: 'rep-03', text: 'Đuổi mãi mà không bắt được, luật không cho đâu.', speech: '[giảng giải] Đuổi mãi mà không bắt được, luật không cho đâu.' },
    { id: 'rep-04', text: 'Vòng luẩn quẩn. Phải có kẻ đổi ý.', speech: '[sốt ruột] Vòng luẩn quẩn. Phải có kẻ đổi ý.' },
    {
      id: 'rep-05',
      text: 'Lại vẫn mấy nước ấy. Ai chán trước người ấy thua.',
      speech:
        '[cười khẩy] Lại vẫn mấy nước ấy. [ranh mãnh] Ai chán trước... người ấy thua.',
    },
    {
      id: 'rep-06',
      text: 'Cờ đang giẫm chân tại chỗ. Phải có kẻ đổi ý thôi.',
      speech:
        '[trầm ngâm] Cờ đang giẫm chân tại chỗ. [nhấn mạnh] Phải có kẻ đổi ý thôi.',
    },
    {
      id: 'rep-07',
      text: 'Đi tới đi lui mãi, luật cờ không cho phép đâu.',
      speech:
        '[nghiêm giọng] Đi tới đi lui mãi... [cảnh báo] luật cờ không cho phép đâu.',
    },
    {
      id: 'rep-08',
      text: 'Thế này là dò nhau. Chưa ai chịu xuống tay trước.',
      speech:
        '[thì thầm] Thế này là dò nhau. [căng thẳng] Chưa ai chịu xuống tay trước.',
    },
  ],
  playerWin: [
    { id: 'pwin-01', text: 'Ta thua. Ngươi xứng đáng.', speech: '[chân thành] Ta thua. Ngươi xứng đáng.' },
    { id: 'pwin-02', text: 'Hậu sinh khả úy! Ván này ngươi thắng đẹp.', speech: '[thán phục] Hậu sinh khả úy! Ván này ngươi thắng đẹp.' },
    { id: 'pwin-03', text: 'Ta đã khinh địch. Lần sau sẽ khác.', speech: '[tiếc nuối] Ta đã khinh địch. Lần sau sẽ khác.' },
    { id: 'pwin-04', text: 'Cao nhân tự có cao nhân trị. Bái phục.', speech: '[cung kính] Cao nhân tự có cao nhân trị. Bái phục!' },
    {
      id: 'pwin-05',
      text: 'Thắng! Ngươi hạ được nó thật rồi.',
      speech:
        '[phấn khích] Thắng! [hào hứng] Ngươi hạ được nó thật rồi.',
    },
    {
      id: 'pwin-06',
      text: 'Một ván đẹp. Lão phu bình mà cũng thấy sướng.',
      speech:
        '[ấm áp] Một ván đẹp. [cười vui] Lão phu bình... mà cũng thấy sướng.',
    },
    {
      id: 'pwin-07',
      text: 'Chúc mừng! Cái máy này không dễ thắng đâu.',
      speech:
        '[hào hứng] Chúc mừng! [nhấn mạnh] Cái máy này... không dễ thắng đâu.',
    },
    {
      id: 'pwin-08',
      text: 'Kết thúc gọn gàng. Xứng đáng.',
      speech:
        '[tán thưởng] Kết thúc gọn gàng. [trang trọng] Xứng đáng.',
    },
    {
      id: 'pwin-09',
      text: 'Ngươi thắng, và thắng bằng thực lực, không phải may.',
      speech:
        '[trang trọng] Ngươi thắng. [nhấn mạnh] Và thắng bằng thực lực... không phải may.',
    },
  ],
  playerLose: [
    { id: 'plost-01', text: 'Sát cục! Ván này khép lại.', speech: '[dõng dạc] Sát cục! Ván này khép lại.' },
    { id: 'plost-02', text: 'Tướng đã cùng đường. Ta thắng.', speech: '[đắc ý] Tướng đã cùng đường. Ta thắng.' },
    { id: 'plost-03', text: 'Ngươi đánh không tệ, nhưng chưa đủ.', speech: '[điềm tĩnh] Ngươi đánh không tệ... nhưng chưa đủ.' },
    { id: 'plost-04', text: 'Về luyện thêm rồi tìm ta.', speech: '[cười khẩy] Về luyện thêm rồi tìm ta.' },
    {
      id: 'plost-05',
      text: 'Thua rồi. Nhưng thua ván này, học được ván sau.',
      speech:
        '[trầm giọng] Thua rồi. [ấm áp] Nhưng thua ván này... học được ván sau.',
    },
    {
      id: 'plost-06',
      text: 'Kết cục đã định. Ngươi có mấy nước rất khá đấy.',
      speech:
        '[điềm tĩnh] Kết cục đã định. [ấm áp] Ngươi có mấy nước... rất khá đấy.',
    },
    {
      id: 'plost-07',
      text: 'Bại trận không nhục. Ngồi lại xem mình sai chỗ nào.',
      speech:
        '[trang trọng] Bại trận không nhục. [nghiêm giọng] Ngồi lại... xem mình sai chỗ nào.',
    },
    {
      id: 'plost-08',
      text: 'Nó thắng. Lần sau đừng để mất tiên như vậy.',
      speech:
        '[trầm giọng] Nó thắng. [nhấn mạnh] Lần sau... đừng để mất tiên như vậy.',
    },
    {
      id: 'plost-09',
      text: 'Hết ván. Đứng lên, bày lại bàn cờ.',
      speech:
        '[chậm rãi] Hết ván. [khích lệ] Đứng lên... bày lại bàn cờ.',
    },
  ],
  draw: [
    { id: 'draw-01', text: 'Bất phân thắng bại. Kỳ phùng địch thủ.', speech: '[trang trọng] Bất phân thắng bại. Kỳ phùng địch thủ.' },
    { id: 'draw-02', text: 'Hòa. Cả hai đều không sai một nước nào đáng kể.', speech: '[điềm tĩnh] Hòa. Cả hai đều không sai một nước nào đáng kể.' },
    { id: 'draw-03', text: 'Ván này chia đôi. Hẹn ngươi lần sau.', speech: '[thân thiện] Ván này chia đôi. Hẹn ngươi lần sau.' },
    {
      id: 'draw-04',
      text: 'Hòa cờ. Hai bên đều không cho nhau một khe hở.',
      speech:
        '[trang trọng] Hòa cờ. [nhấn mạnh] Hai bên đều không cho nhau... một khe hở.',
    },
    {
      id: 'draw-05',
      text: 'Không ai thắng. Mà cũng chẳng ai đáng thua.',
      speech:
        '[điềm tĩnh] Không ai thắng. [ấm áp] Mà cũng chẳng ai... đáng thua.',
    },
    {
      id: 'draw-06',
      text: 'Ván này khép lại ở thế cân bằng.',
      speech:
        '[chậm rãi] Ván này... [trang trọng] khép lại ở thế cân bằng.',
    },
    {
      id: 'draw-07',
      text: 'Hòa. Đôi khi đó mới là kết quả trung thực nhất.',
      speech:
        '[trầm ngâm] Hòa. [nhấn mạnh] Đôi khi đó mới là... kết quả trung thực nhất.',
    },
    {
      id: 'draw-08',
      text: 'Cân tài cân sức. Hẹn ván sau phân cao thấp.',
      speech:
        '[hào hùng] Cân tài cân sức. [ấm áp] Hẹn ván sau... phân cao thấp.',
    },
  ],
  greeting: [
    {
      id: 'hello-01',
      text: 'Kính chào chư vị! Lão phu xin làm người dẫn ván cờ hôm nay.',
      speech:
        '[trang trọng] Kính chào chư vị! [ấm áp] Lão phu... xin làm người dẫn ván cờ hôm nay.',
    },
    {
      id: 'hello-02',
      text: 'Bàn cờ đã bày. Mời hai bên nhập cuộc!',
      speech:
        '[hào hùng] Bàn cờ đã bày. [dõng dạc] Mời hai bên... nhập cuộc!',
    },
    {
      id: 'hello-03',
      text: 'Lại một ván nữa. Xem hôm nay ai hơn ai nào.',
      speech:
        '[ranh mãnh] Lại một ván nữa. [tò mò] Xem hôm nay... ai hơn ai nào.',
    },
    {
      id: 'hello-04',
      text: 'Xin mời! Cờ tướng một ván, thắng bại một đời.',
      speech:
        '[trang trọng] Xin mời! [ngâm nga] Cờ tướng một ván... thắng bại một đời.',
    },
    {
      id: 'hello-05',
      text: 'Ta ngồi đây bình cờ. Ngươi cứ đánh, đừng để ý tới ta.',
      speech:
        '[cười nhẹ] Ta ngồi đây bình cờ. [ranh mãnh] Ngươi cứ đánh, đừng để ý tới ta.',
    },
    {
      id: 'hello-06',
      text: 'Quân đã vào vị trí. Từ giờ mỗi nước đều tính.',
      speech:
        '[trang trọng] Quân đã vào vị trí. [nhấn mạnh] Từ giờ... mỗi nước đều tính.',
    },
    {
      id: 'hello-07',
      text: 'Chư vị ngồi cho vững. Ván này lão phu ngửi thấy mùi thuốc súng.',
      speech:
        '[hào hứng] Chư vị ngồi cho vững. [thì thầm] Ván này... lão phu ngửi thấy mùi thuốc súng.',
    },
    {
      id: 'hello-08',
      text: 'Trà đã rót, quân đã bày. Xin bắt đầu.',
      speech:
        '[ấm áp] Trà đã rót, quân đã bày. [trang trọng] Xin... bắt đầu.',
    },
    {
      id: 'hello-09',
      text: 'Ba mươi hai quân, một bàn cờ, không có chỗ cho may rủi.',
      speech:
        '[trang trọng] Ba mươi hai quân, một bàn cờ... [nhấn mạnh] không có chỗ cho may rủi.',
    },
    {
      id: 'hello-10',
      text: 'Lão phu bình cờ đã bốn mươi năm. Mời ngươi cho lão phu xem cái mới.',
      speech:
        '[điềm tĩnh] Lão phu bình cờ đã bốn mươi năm. [tò mò] Mời ngươi... cho lão phu xem cái mới.',
    },
  ],
  prediction: [
    {
      id: 'pred-01',
      text: 'Theo lão phu, chỉ vài nước nữa là ngã ngũ.',
      speech:
        '[trầm ngâm] Theo lão phu... chỉ vài nước nữa là ngã ngũ.',
    },
    {
      id: 'pred-02',
      text: 'Thế cờ vừa đổi chiều. Ai giữ được trung lộ, người đó thắng.',
      speech:
        '[nghiêm nghị] Thế cờ vừa đổi chiều. [dứt khoát] Ai giữ được trung lộ, người đó thắng.',
    },
    {
      id: 'pred-03',
      text: 'Ta ngờ rằng bên kia đang giăng bẫy. Hãy dè chừng.',
      speech:
        '[nghi ngờ] Ta ngờ rằng... bên kia đang giăng bẫy. [cảnh báo] Hãy dè chừng.',
    },
    {
      id: 'pred-04',
      text: 'Nếu con xe kia xuống được đáy, ván này khó gỡ.',
      speech:
        '[căng thẳng] Nếu con xe kia xuống được đáy... [trầm giọng] ván này khó gỡ.',
    },
    {
      id: 'pred-05',
      text: 'Đây là bước ngoặt. Nước tiếp theo quyết định tất cả.',
      speech:
        '[gấp gáp] Đây là bước ngoặt! [nhấn mạnh] Nước tiếp theo quyết định tất cả.',
    },
    {
      id: 'pred-06',
      text: 'Cứ đà này, ba nước nữa sẽ có kẻ mất quân lớn.',
      speech:
        '[suy tính] Cứ đà này... ba nước nữa sẽ có kẻ mất quân lớn.',
    },
    {
      id: 'pred-07',
      text: 'Ta thấy một đòn phối hợp đang thành hình.',
      speech:
        '[hào hứng] Ta thấy... một đòn phối hợp đang thành hình!',
    },
    {
      id: 'pred-08',
      text: 'Bên yếu thế nên tính đường đổi quân, kẻo càng đánh càng thiệt.',
      speech:
        '[giảng giải] Bên yếu thế nên tính đường đổi quân... kẻo càng đánh càng thiệt.',
    },
    {
      id: 'pred-09',
      text: 'Thế trận đã căng như dây đàn. Chỉ chờ một nước sai.',
      speech:
        '[thì thầm] Thế trận đã căng như dây đàn... [nhấn mạnh] chỉ chờ một nước sai.',
    },
    {
      id: 'pred-10',
      text: 'Nước vừa rồi mở toang cửa. Cẩn thận đấy!',
      speech:
        '[kinh ngạc] Nước vừa rồi mở toang cửa! [cảnh báo] Cẩn thận đấy!',
    },
  ],
  foreseeMate: [
    {
      id: 'fmate-01',
      text: 'Lão phu đã thấy đường sát cục rồi. Chỉ còn đếm nước thôi.',
      speech:
        '[lạnh lùng] Lão phu đã thấy đường sát cục rồi. [dứt khoát] Chỉ còn đếm nước thôi.',
    },
    {
      id: 'fmate-02',
      text: 'Sát cục đã hiện. Bên kia hết đường lui.',
      speech:
        '[nghiêm trọng] Sát cục đã hiện. [trầm giọng] Bên kia... hết đường lui.',
    },
    {
      id: 'fmate-03',
      text: 'Chư vị chú ý! Ván cờ sắp kết thúc bằng một đòn chiếu hết.',
      speech:
        '[dõng dạc] Chư vị chú ý! [gấp gáp] Ván cờ sắp kết thúc bằng một đòn chiếu hết!',
    },
    {
      id: 'fmate-04',
      text: 'Lưới đã giăng kín. Không còn lối thoát nào nữa.',
      speech:
        '[lạnh lùng] Lưới đã giăng kín. [thì thầm] Không còn lối thoát nào nữa.',
    },
    {
      id: 'fmate-05',
      text: 'Xong rồi! Đường sát cục đã mở, không lấp được nữa.',
      speech:
        '[phấn khích] Xong rồi! [dõng dạc] Đường sát cục đã mở... không lấp được nữa.',
    },
    {
      id: 'fmate-06',
      text: 'Lão phu đếm được nước chiếu bí. Chỉ còn là thủ tục.',
      speech:
        '[lạnh lùng] Lão phu đếm được nước chiếu bí. [chậm rãi] Chỉ còn... là thủ tục.',
    },
    {
      id: 'fmate-07',
      text: 'Từ đây tới hết ván, mọi nước đều đã định.',
      speech:
        '[trang trọng] Từ đây tới hết ván... [nhấn mạnh] mọi nước đều đã định.',
    },
    {
      id: 'fmate-08',
      text: 'Bí lối rồi! Tướng chạy đâu cũng gặp lưới.',
      speech:
        '[hào hùng] Bí lối rồi! [lạnh lùng] Tướng chạy đâu... cũng gặp lưới.',
    },
  ],
  story: [
    {
      id: 'story-01',
      text: 'Cờ tướng có từ đời Đường, đời Tống đã thành hình như bây giờ. Ngàn năm rồi mà bàn cờ chẳng đổi.',
      speech:
        '[trầm ngâm] Cờ tướng có từ đời Đường... [trang trọng] đời Tống đã thành hình như bây giờ. [chậm rãi] Ngàn năm rồi... mà bàn cờ chẳng đổi.',
    },
    {
      id: 'story-02',
      text: 'Quất Trung Bí, Mai Hoa Phổ, mấy quyển cổ phổ ấy người xưa chép tay truyền nhau.',
      speech:
        '[kể chuyện] Quất Trung Bí... Mai Hoa Phổ... [ấm áp] mấy quyển cổ phổ ấy, người xưa chép tay truyền nhau.',
    },
    {
      id: 'story-03',
      text: 'Lão phu từng thấy một quán cờ đầu ngõ, cái bàn gỗ mòn lõm cả mặt. Bao nhiêu ván đã đi qua đó.',
      speech:
        '[kể chuyện] Lão phu từng thấy một quán cờ đầu ngõ... [trầm ngâm] cái bàn gỗ mòn lõm cả mặt. [thì thầm] Bao nhiêu ván... đã đi qua đó.',
    },
    {
      id: 'story-04',
      text: 'Ở quán cờ, người đứng xem bao giờ cũng đông hơn người ngồi đánh. Mà nói thì to hơn cả.',
      speech:
        '[cười nhẹ] Ở quán cờ, người đứng xem bao giờ cũng đông hơn người ngồi đánh. [cười khẩy] Mà nói thì... to hơn cả.',
    },
    {
      id: 'story-05',
      text: 'Người xưa dạy: cờ tàn học trước, khai cuộc học sau. Ít ai nghe.',
      speech:
        '[trang trọng] Người xưa dạy... [nhấn mạnh] cờ tàn học trước, khai cuộc học sau. [cười nhẹ] Ít ai nghe.',
    },
    {
      id: 'story-06',
      text: 'Có kỳ thủ đánh cả đời chỉ một thế pháo đầu. Vậy mà chẳng ai phá nổi.',
      speech:
        '[kể chuyện] Có kỳ thủ đánh cả đời... chỉ một thế pháo đầu. [ngạc nhiên] Vậy mà chẳng ai phá nổi.',
    },
    {
      id: 'story-07',
      text: 'Bàn cờ có sông. Sông ấy tên là Sở Hà Hán Giới, chia đôi thiên hạ một thời.',
      speech:
        '[trang trọng] Bàn cờ có sông. [ngâm nga] Sông ấy tên là... Sở Hà Hán Giới. [trầm giọng] Chia đôi thiên hạ một thời.',
    },
    {
      id: 'story-08',
      text: 'Tướng không được rời cung, sĩ không được rời tướng. Luật đặt ra để dạy người ta chữ phận.',
      speech:
        '[trang trọng] Tướng không được rời cung... sĩ không được rời tướng. [trầm ngâm] Luật đặt ra... để dạy người ta chữ phận.',
    },
    {
      id: 'story-09',
      text: 'Tốt qua sông thì không lùi được nữa. Đời người cũng có mấy con sông như thế.',
      speech:
        '[chậm rãi] Tốt qua sông thì không lùi được nữa. [thì thầm] Đời người... cũng có mấy con sông như thế.',
    },
    {
      id: 'story-10',
      text: 'Lão phu nhớ có ông cụ trong quán, thua thì cười, thắng cũng cười. Hỏi ra mới biết cụ đánh cờ để quên chuyện nhà.',
      speech:
        '[kể chuyện] Lão phu nhớ có ông cụ trong quán... thua thì cười, thắng cũng cười. [trầm giọng] Hỏi ra mới biết... cụ đánh cờ để quên chuyện nhà.',
    },
    {
      id: 'story-11',
      text: 'Người ta bảo xem một ván cờ là đọc được tính một người. Lão phu thấy cũng đúng.',
      speech:
        '[trầm ngâm] Người ta bảo... xem một ván cờ là đọc được tính một người. [ấm áp] Lão phu thấy cũng đúng.',
    },
    {
      id: 'story-12',
      text: 'Pháo phải có ngòi mới bắn được. Cái gì mạnh cũng cần chỗ dựa cả.',
      speech:
        '[điềm tĩnh] Pháo phải có ngòi mới bắn được. [nhấn mạnh] Cái gì mạnh... cũng cần chỗ dựa cả.',
    },
    {
      id: 'story-13',
      text: 'Mã sợ chân, tượng sợ mắt. Con nào cũng có chỗ yếu, chỉ xem ai nhìn ra trước.',
      speech:
        '[điềm tĩnh] Mã sợ chân, tượng sợ mắt. [thì thầm] Con nào cũng có chỗ yếu... chỉ xem ai nhìn ra trước.',
    },
    {
      id: 'story-14',
      text: 'Ngày trước đánh cờ ngoài vỉa hè, che cái ô, uống trà đá. Vui hơn bây giờ nhiều.',
      speech:
        '[kể chuyện] Ngày trước đánh cờ ngoài vỉa hè... che cái ô, uống trà đá. [ấm áp] Vui hơn bây giờ nhiều.',
    },
    {
      id: 'story-15',
      text: 'Có ván đánh ba ngày chưa xong, hai bên cứ để đó rồi mai đánh tiếp. Chẳng ai vội.',
      speech:
        '[kể chuyện] Có ván đánh ba ngày chưa xong... [cười nhẹ] hai bên cứ để đó rồi mai đánh tiếp. [ấm áp] Chẳng ai vội.',
    },
    {
      id: 'story-16',
      text: 'Đánh cờ mà nóng là thua. Lão phu học được điều ấy sau chừng một ngàn ván.',
      speech:
        '[trầm ngâm] Đánh cờ mà nóng là thua. [cười khẩy] Lão phu học được điều ấy... sau chừng một ngàn ván.',
    },
    {
      id: 'story-17',
      text: 'Bàn cờ chín đường dọc, mười đường ngang. Bấy nhiêu thôi mà cả đời không đi hết.',
      speech:
        '[trang trọng] Bàn cờ chín đường dọc, mười đường ngang. [thì thầm] Bấy nhiêu thôi... mà cả đời không đi hết.',
    },
    {
      id: 'story-18',
      text: 'Cứ thong thả. Cờ là chuyện của cái đầu, không phải chuyện của cái đồng hồ.',
      speech:
        '[ấm áp] Cứ thong thả. [điềm tĩnh] Cờ là chuyện của cái đầu... không phải chuyện của cái đồng hồ.',
    },
    {
      id: 'story-19',
      text: 'Người mới học hay tiếc quân. Đánh lâu rồi mới biết có lúc phải cho đi mới lấy được.',
      speech:
        '[trầm ngâm] Người mới học hay tiếc quân. [nhấn mạnh] Đánh lâu rồi mới biết... có lúc phải cho đi mới lấy được.',
    },
    {
      id: 'story-20',
      text: 'Trong quán cờ chẳng ai hỏi nhau làm nghề gì. Ngồi xuống là ngang nhau cả.',
      speech:
        '[ấm áp] Trong quán cờ chẳng ai hỏi nhau làm nghề gì. [trang trọng] Ngồi xuống... là ngang nhau cả.',
    },
  ],
}

/** Every line in the script, for pre-generating the audio. */
export function allLines(): Line[] {
  return Object.values(LINES).flat()
}

/**
 * Picks a line, avoiding the ids in `recent`.
 *
 * The commentator must not repeat itself while a player is still listening, so
 * recently used lines are excluded until the pool would otherwise run dry.
 */
export function pickLine(situation: Situation, recent: readonly string[]): Line | null {
  const pool = LINES[situation]
  if (!pool || pool.length === 0) return null
  const fresh = pool.filter((l) => !recent.includes(l.id))
  const from = fresh.length > 0 ? fresh : pool
  return from[Math.floor(Math.random() * from.length)]
}
