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
  ],
  opening: [
    { id: 'open-01', text: 'Hai bên bày trận. Sát khí đã nổi.', speech: '[hào hùng] Hai bên bày trận. Sát khí đã nổi!' },
    { id: 'open-02', text: 'Khai cuộc định hình cả ván cờ. Cẩn thận từng nước.', speech: '[nghiêm nghị] Khai cuộc định hình cả ván cờ. Cẩn thận từng nước.' },
    { id: 'open-03', text: 'Pháo đã lên nòng, mã đã ra chuồng.', speech: '[hào hứng] Pháo đã lên nòng, mã đã ra chuồng.' },
    { id: 'open-04', text: 'Trận này ai làm chủ trung lộ, người đó nắm thế.', speech: '[giảng giải] Trận này ai làm chủ trung lộ, người đó nắm thế.' },
    { id: 'open-05', text: 'Màn mở đầu, ai cũng lịch sự. Chờ xem lát nữa.', speech: '[ranh mãnh] Màn mở đầu, ai cũng lịch sự. Chờ xem lát nữa.' },
  ],
  engineCapture: [
    { id: 'ecap-01', text: 'Quân đó ta nhận. Cảm ơn.', speech: '[đắc ý] Quân đó ta nhận. Cảm ơn!' },
    { id: 'ecap-02', text: 'Một mạng đổi một thế. Đáng.', speech: '[điềm tĩnh] Một mạng đổi một thế. Đáng.' },
    { id: 'ecap-03', text: 'Ngươi để hở rồi.', speech: '[cười khẩy] Ngươi để hở rồi.' },
    { id: 'ecap-04', text: 'Trên bàn cờ, sơ hở nào cũng phải trả giá.', speech: '[nghiêm nghị] Trên bàn cờ, sơ hở nào cũng phải trả giá.' },
    { id: 'ecap-05', text: 'Ta lấy quân này, ngươi lấy bài học.', speech: '[mỉa mai] Ta lấy quân này, ngươi lấy bài học.' },
    { id: 'ecap-06', text: 'Ít một quân, nặng một phần lo.', speech: '[trầm giọng] Ít một quân... nặng một phần lo.' },
  ],
  playerCapture: [
    { id: 'pcap-01', text: 'Được! Nước đó sắc bén.', speech: '[thán phục] Được! Nước đó sắc bén.' },
    { id: 'pcap-02', text: 'Ngươi ra tay không nương tình.', speech: '[nghiêm túc] Ngươi ra tay không nương tình.' },
    { id: 'pcap-03', text: 'Ta ghi nhớ món nợ này.', speech: '[lạnh lùng] Ta ghi nhớ món nợ này.' },
    { id: 'pcap-04', text: 'Hừ. Ta cho ngươi mượn tạm thôi.', speech: '[hậm hực] Hừ! Ta cho ngươi mượn tạm thôi.' },
    { id: 'pcap-05', text: 'Một quân đổi lấy sự cảnh giác của ta.', speech: '[điềm tĩnh] Một quân đổi lấy sự cảnh giác của ta.' },
  ],
  playerCheck: [
    { id: 'pchk-01', text: 'Chiếu tướng! Ngươi liệu đường mà lui.', speech: '[dõng dạc] Chiếu tướng! Ngươi liệu đường mà lui.' },
    { id: 'pchk-02', text: 'Tướng lộ diện là tướng lâm nguy.', speech: '[cảnh báo] Tướng lộ diện là tướng lâm nguy.' },
    { id: 'pchk-03', text: 'Đao đã kề cổ.', speech: '[thì thầm] Đao đã kề cổ.' },
    { id: 'pchk-04', text: 'Chạy đi. Nếu còn chỗ mà chạy.', speech: '[thách thức] Chạy đi. Nếu còn chỗ mà chạy.' },
    { id: 'pchk-05', text: 'Cẩn thận! Một nước sai là xong đời.', speech: '[gấp gáp] Cẩn thận! Một nước sai là xong đời.' },
  ],
  engineCheck: [
    { id: 'echk-01', text: 'Chiếu ta ư? Gan lớn đấy.', speech: '[cười khẩy] Chiếu ta ư? Gan lớn đấy.' },
    { id: 'echk-02', text: 'Được, ta lui một bước. Chỉ một bước thôi.', speech: '[bình thản] Được. Ta lui một bước. Chỉ một bước thôi.' },
    { id: 'echk-03', text: 'Ngươi dám đụng đến soái kỳ của ta.', speech: '[giận dữ] Ngươi dám đụng đến soái kỳ của ta!' },
    { id: 'echk-04', text: 'Nước này ép ta hơi rát.', speech: '[nhăn nhó] Nước này ép ta hơi rát.' },
  ],
  endgame: [
    { id: 'end-01', text: 'Quân đã thưa, giờ mới là lúc phân cao thấp.', speech: '[nghiêm nghị] Quân đã thưa. Giờ mới là lúc phân cao thấp.' },
    { id: 'end-02', text: 'Tàn cuộc. Từng nước một đều nặng như núi.', speech: '[trầm giọng] Tàn cuộc. Từng nước một đều nặng như núi.' },
    { id: 'end-03', text: 'Ít quân thì mỗi tốt đều quý như vàng.', speech: '[giảng giải] Ít quân thì mỗi tốt đều quý như vàng.' },
    { id: 'end-04', text: 'Đến đây, kẻ nào bình tĩnh hơn sẽ thắng.', speech: '[điềm tĩnh] Đến đây, kẻ nào bình tĩnh hơn sẽ thắng.' },
    { id: 'end-05', text: 'Bàn cờ trống trải, mà lòng người thì căng.', speech: '[trầm ngâm] Bàn cờ trống trải... mà lòng người thì căng.' },
  ],
  playerLosing: [
    { id: 'plose-01', text: 'Thế của ngươi đang bí rồi đó.', speech: '[thì thầm] Thế của ngươi... đang bí rồi đó.' },
    { id: 'plose-02', text: 'Còn đường nào không? Ta thì thấy rất ít.', speech: '[mỉa mai] Còn đường nào không? Ta thì thấy rất ít.' },
    { id: 'plose-03', text: 'Vây đã khép ba mặt.', speech: '[lạnh lùng] Vây đã khép ba mặt.' },
    { id: 'plose-04', text: 'Đây là lúc cần một nước cờ thần.', speech: '[căng thẳng] Đây là lúc cần một nước cờ thần.' },
    { id: 'plose-05', text: 'Bình tĩnh. Càng rối càng nhanh thua.', speech: '[khuyên nhủ] Bình tĩnh. Càng rối càng nhanh thua.' },
  ],
  engineLosing: [
    { id: 'elose-01', text: 'Ta đang ở thế hạ phong. Nhận là nhận.', speech: '[thẳng thắn] Ta đang ở thế hạ phong. Nhận là nhận.' },
    { id: 'elose-02', text: 'Ngươi đánh hay hơn ta tưởng nhiều.', speech: '[thán phục] Ngươi đánh hay hơn ta tưởng nhiều.' },
    { id: 'elose-03', text: 'Còn nước còn tát.', speech: '[kiên cường] Còn nước còn tát!' },
    { id: 'elose-04', text: 'Ván này ta phải liều thôi.', speech: '[quyết liệt] Ván này ta phải liều thôi.' },
  ],
  repetition: [
    { id: 'rep-01', text: 'Hai bên cứ đi tới đi lui thế này thì hòa mất.', speech: '[chán nản] Hai bên cứ đi tới đi lui thế này thì hòa mất.' },
    { id: 'rep-02', text: 'Lặp nước rồi. Ai chịu đổi trước đây?', speech: '[thúc giục] Lặp nước rồi. Ai chịu đổi trước đây?' },
    { id: 'rep-03', text: 'Đuổi mãi mà không bắt được, luật không cho đâu.', speech: '[giảng giải] Đuổi mãi mà không bắt được, luật không cho đâu.' },
    { id: 'rep-04', text: 'Vòng luẩn quẩn. Phải có kẻ đổi ý.', speech: '[sốt ruột] Vòng luẩn quẩn. Phải có kẻ đổi ý.' },
  ],
  playerWin: [
    { id: 'pwin-01', text: 'Ta thua. Ngươi xứng đáng.', speech: '[chân thành] Ta thua. Ngươi xứng đáng.' },
    { id: 'pwin-02', text: 'Hậu sinh khả úy! Ván này ngươi thắng đẹp.', speech: '[thán phục] Hậu sinh khả úy! Ván này ngươi thắng đẹp.' },
    { id: 'pwin-03', text: 'Ta đã khinh địch. Lần sau sẽ khác.', speech: '[tiếc nuối] Ta đã khinh địch. Lần sau sẽ khác.' },
    { id: 'pwin-04', text: 'Cao nhân tự có cao nhân trị. Bái phục.', speech: '[cung kính] Cao nhân tự có cao nhân trị. Bái phục!' },
  ],
  playerLose: [
    { id: 'plost-01', text: 'Sát cục! Ván này khép lại.', speech: '[dõng dạc] Sát cục! Ván này khép lại.' },
    { id: 'plost-02', text: 'Tướng đã cùng đường. Ta thắng.', speech: '[đắc ý] Tướng đã cùng đường. Ta thắng.' },
    { id: 'plost-03', text: 'Ngươi đánh không tệ, nhưng chưa đủ.', speech: '[điềm tĩnh] Ngươi đánh không tệ... nhưng chưa đủ.' },
    { id: 'plost-04', text: 'Về luyện thêm rồi tìm ta.', speech: '[cười khẩy] Về luyện thêm rồi tìm ta.' },
  ],
  draw: [
    { id: 'draw-01', text: 'Bất phân thắng bại. Kỳ phùng địch thủ.', speech: '[trang trọng] Bất phân thắng bại. Kỳ phùng địch thủ.' },
    { id: 'draw-02', text: 'Hòa. Cả hai đều không sai một nước nào đáng kể.', speech: '[điềm tĩnh] Hòa. Cả hai đều không sai một nước nào đáng kể.' },
    { id: 'draw-03', text: 'Ván này chia đôi. Hẹn ngươi lần sau.', speech: '[thân thiện] Ván này chia đôi. Hẹn ngươi lần sau.' },
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
