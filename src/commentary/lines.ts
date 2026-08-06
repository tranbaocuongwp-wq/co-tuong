/**
 * The commentator's script.
 *
 * He is not in the game. He is someone who wandered up to the table, knows
 * chess, and is telling whoever is standing next to him what he sees. That is
 * the whole rule this file follows, and the earlier version broke it: it spoke
 * *to* the player — "ngươi liệu mà chống", "chúc mừng" — which made him sound
 * like the opponent needling from across the board rather than an onlooker.
 *
 * So nothing here addresses anyone. Sides are named by colour, never by who is
 * sitting where, and the commentator has no stake in either. He does not know
 * which colour the player has picked and does not need to.
 *
 * These are the *reactions*. The concrete "Đỏ dùng Xe ăn Pháo" lines are next
 * door in `facts.ts`, generated from the engine's report of the move. The queue
 * plays a fact and then a reaction back to back, which is how a real broadcast
 * sounds: the move called, then what to make of it.
 *
 * Lines are short on purpose. They appear as a caption under the board, and a
 * four-line paragraph there is a wall, not a remark.
 */

import { lineId } from './id'

export type Situation =
  /** Spoken once as a game begins. */
  | 'greeting'
  /** First moves. */
  | 'opening'
  /** Nothing decisive has happened; a read of the position. */
  | 'thinking'
  /** Red stands clearly better. */
  | 'redAhead'
  /** Black stands clearly better. */
  | 'blackAhead'
  /** Neither side has anything. */
  | 'balanced'
  /** Few pieces left. */
  | 'endgame'
  /** Moves are repeating. */
  | 'repetition'
  /** The assessment has just swung; what it points to. */
  | 'prediction'
  /** A forced mate is on the board. */
  | 'foreseeMate'
  | 'redWin'
  | 'blackWin'
  | 'draw'
  /**
   * Filler for a long silence: an anecdote, a scrap of chess history.
   *
   * A player can sit on one move for a minute, and a minute of dead air is a
   * broadcast that sounds switched off.
   */
  | 'story'

export interface Line {
  /** Name for humans reading the script. Unique across the whole script. */
  key: string
  /** Shown on screen. Kept clean of markup. */
  text: string
  /**
   * Sent to text-to-speech instead of `text`.
   *
   * ElevenLabs v3 reads inline tags such as `[cười khẩy]` as performance
   * directions rather than speaking them, which is what turns a flat reading
   * into a person. The display text stays plain so the tags never leak on screen.
   */
  speech?: string
  /** Where the audio lives. Derived from the words; never written by hand. */
  id: string
}

type Draft = [key: string, text: string, speech: string]

function build(drafts: Draft[]): Line[] {
  return drafts.map(([key, text, speech]) => ({ key, text, speech, id: lineId(key, speech) }))
}

const DRAFTS: Record<Situation, Draft[]> = {
  greeting: [
    ['hello-01', 'Bàn cờ đã bày, hai bên đã vào trận. Xin mời!', '[trang trọng] Bàn cờ đã bày, hai bên đã vào trận. [hào hùng] Xin mời!'],
    ['hello-02', 'Đỏ trấn phía nam, Đen giữ phía bắc. Trận này bắt đầu.', '[trang trọng] Đỏ trấn phía nam... Đen giữ phía bắc. [dõng dạc] Trận này bắt đầu.'],
    ['hello-03', 'Ba mươi hai quân, một dải Sở Hà. Cuộc so tài mở màn.', '[ngâm nga] Ba mươi hai quân, một dải Sở Hà... [trang trọng] Cuộc so tài mở màn.'],
    ['hello-04', 'Chiêng đã điểm. Đỏ và Đen cùng bước vào cuộc.', '[hào hùng] Chiêng đã điểm. [dõng dạc] Đỏ và Đen... cùng bước vào cuộc.'],
    ['hello-05', 'Hai bên chắp tay chào nhau. Rồi đây sẽ không ai nhường ai.', '[ấm áp] Hai bên chắp tay chào nhau. [ranh mãnh] Rồi đây... sẽ không ai nhường ai.'],
    ['hello-06', 'Sông Hán ngăn đôi, quân hai bên đã dàn xong thế trận.', '[trang trọng] Sông Hán ngăn đôi... [dõng dạc] quân hai bên đã dàn xong thế trận.'],
  ],

  opening: [
    ['open-01', 'Khai cuộc. Hai bên còn thăm dò, chưa ai lộ sát chiêu.', '[điềm tĩnh] Khai cuộc. [thì thầm] Hai bên còn thăm dò... chưa ai lộ sát chiêu.'],
    ['open-02', 'Quân vừa rời trại. Thế trận hai bên đang thành hình.', '[trầm ngâm] Quân vừa rời trại. [nhấn mạnh] Thế trận hai bên đang thành hình.'],
    ['open-03', 'Đỏ bày binh, Đen bố trận. Chưa bên nào ra đòn.', '[dõng dạc] Đỏ bày binh, Đen bố trận. [thì thầm] Chưa bên nào ra đòn.'],
    ['open-04', 'Mấy nước mở màn bao giờ cũng nhẹ tay, mà đầy ẩn ý.', '[trầm ngâm] Mấy nước mở màn bao giờ cũng nhẹ tay... [nhấn mạnh] mà đầy ẩn ý.'],
    ['open-05', 'Chưa chạm binh khí, sát khí đã lởn vởn quanh bàn.', '[thì thầm] Chưa chạm binh khí... [căng thẳng] sát khí đã lởn vởn quanh bàn.'],
    ['open-06', 'Hai bên còn giữ thế thủ, chờ đối phương hở sườn.', '[điềm tĩnh] Hai bên còn giữ thế thủ... [thì thầm] chờ đối phương hở sườn.'],
  ],

  thinking: [
    ['think-01', 'Hai bên giằng co giữa bàn, chưa ai chịu lui.', '[căng thẳng] Hai bên giằng co giữa bàn... [nhấn mạnh] chưa ai chịu lui.'],
    ['think-02', 'Đỏ và Đen cùng nín thở, chờ một kẽ hở.', '[thì thầm] Đỏ và Đen cùng nín thở... [căng thẳng] chờ một kẽ hở.'],
    ['think-03', 'Nước này tính lâu. Thế cờ hẳn có chỗ hiểm.', '[trầm ngâm] Nước này tính lâu. [nghiêm giọng] Thế cờ hẳn có chỗ hiểm.'],
    ['think-04', 'Bàn cờ lặng như tờ, mà bên dưới là sóng ngầm.', '[thì thầm] Bàn cờ lặng như tờ... [căng thẳng] mà bên dưới là sóng ngầm.'],
    ['think-05', 'Cả hai đều đang tính đường đổi quân.', '[trầm ngâm] Cả hai... [chậm rãi] đều đang tính đường đổi quân.'],
    ['think-06', 'Thế trận còn rộng, đường đi hãy còn nhiều.', '[điềm tĩnh] Thế trận còn rộng... [nhấn mạnh] đường đi hãy còn nhiều.'],
    ['think-07', 'Chưa bên nào để lộ sơ hở đáng kể.', '[trang trọng] Chưa bên nào... [chậm rãi] để lộ sơ hở đáng kể.'],
    ['think-08', 'Trung cuộc đã tới. Đây là lúc phân cao thấp.', '[nghiêm giọng] Trung cuộc đã tới. [dõng dạc] Đây là lúc phân cao thấp.'],
  ],

  redAhead: [
    ['red-01', 'Đỏ đang chiếm thượng phong, Đen phải lui về thủ.', '[dõng dạc] Đỏ đang chiếm thượng phong... [trầm giọng] Đen phải lui về thủ.'],
    ['red-02', 'Thế trận nghiêng về Đỏ. Đen chống đỡ khá vất vả.', '[nhấn mạnh] Thế trận nghiêng về Đỏ. [căng thẳng] Đen chống đỡ khá vất vả.'],
    ['red-03', 'Đỏ hơn quân lại thoáng đường. Đen đang bí.', '[hào hứng] Đỏ hơn quân lại thoáng đường. [trầm giọng] Đen đang bí.'],
    ['red-04', 'Quân Đỏ ép sát, Đen co cụm quanh cung.', '[dõng dạc] Quân Đỏ ép sát... [căng thẳng] Đen co cụm quanh cung.'],
    ['red-05', 'Đỏ nắm thế chủ động, Đen chỉ còn chống chọi.', '[nhấn mạnh] Đỏ nắm thế chủ động... [trầm giọng] Đen chỉ còn chống chọi.'],
    ['red-06', 'Phòng tuyến bên Đen đã rạn vài chỗ.', '[nghiêm giọng] Phòng tuyến bên Đen... [trầm giọng] đã rạn vài chỗ.'],
  ],

  blackAhead: [
    ['black-01', 'Đen đang chiếm thượng phong, Đỏ phải lui về thủ.', '[dõng dạc] Đen đang chiếm thượng phong... [trầm giọng] Đỏ phải lui về thủ.'],
    ['black-02', 'Thế trận nghiêng về Đen. Đỏ chống đỡ khá vất vả.', '[nhấn mạnh] Thế trận nghiêng về Đen. [căng thẳng] Đỏ chống đỡ khá vất vả.'],
    ['black-03', 'Đen hơn quân lại thoáng đường. Đỏ đang bí.', '[hào hứng] Đen hơn quân lại thoáng đường. [trầm giọng] Đỏ đang bí.'],
    ['black-04', 'Quân Đen ép sát, Đỏ co cụm quanh cung.', '[dõng dạc] Quân Đen ép sát... [căng thẳng] Đỏ co cụm quanh cung.'],
    ['black-05', 'Đen nắm thế chủ động, Đỏ chỉ còn chống chọi.', '[nhấn mạnh] Đen nắm thế chủ động... [trầm giọng] Đỏ chỉ còn chống chọi.'],
    ['black-06', 'Phòng tuyến bên Đỏ đã rạn vài chỗ.', '[nghiêm giọng] Phòng tuyến bên Đỏ... [trầm giọng] đã rạn vài chỗ.'],
  ],

  balanced: [
    ['bal-01', 'Đỏ Đen cân sức, chưa ai lấy được gì của ai.', '[điềm tĩnh] Đỏ Đen cân sức... [nhấn mạnh] chưa ai lấy được gì của ai.'],
    ['bal-02', 'Thế trận cân bằng như hai lưỡi kiếm chạm nhau.', '[trang trọng] Thế trận cân bằng... [ngâm nga] như hai lưỡi kiếm chạm nhau.'],
    ['bal-03', 'Đổi qua đổi lại, cán cân vẫn không nghiêng.', '[trầm ngâm] Đổi qua đổi lại... [nhấn mạnh] cán cân vẫn không nghiêng.'],
    ['bal-04', 'Hai bên ngang tài. Ván này còn dài.', '[điềm tĩnh] Hai bên ngang tài. [chậm rãi] Ván này còn dài.'],
    ['bal-05', 'Một nước lỡ tay là đủ phân thắng bại.', '[thì thầm] Một nước lỡ tay... [nghiêm giọng] là đủ phân thắng bại.'],
  ],

  endgame: [
    ['end-01', 'Tàn cuộc. Quân hai bên đã thưa hẳn.', '[trầm giọng] Tàn cuộc. [chậm rãi] Quân hai bên đã thưa hẳn.'],
    ['end-02', 'Đến đoạn này, mỗi nước nặng như một đời người.', '[nghiêm giọng] Đến đoạn này... [ngâm nga] mỗi nước nặng như một đời người.'],
    ['end-03', 'Bàn cờ trống trải, Tướng hai bên phải tự thân.', '[chậm rãi] Bàn cờ trống trải... [thì thầm] Tướng hai bên phải tự thân.'],
    ['end-04', 'Ít quân mà khó hơn nhiều quân. Cờ tàn là vậy.', '[trầm ngâm] Ít quân mà khó hơn nhiều quân. [nhấn mạnh] Cờ tàn là vậy.'],
    ['end-05', 'Tốt qua sông lúc này đáng giá ngàn vàng.', '[nhấn mạnh] Tốt qua sông lúc này... [dõng dạc] đáng giá ngàn vàng.'],
    ['end-06', 'Cờ tàn không che giấu được sơ hở nào.', '[nghiêm giọng] Cờ tàn... [chậm rãi] không che giấu được sơ hở nào.'],
  ],

  repetition: [
    ['rep-01', 'Đỏ Đen quần nhau mãi mấy nước ấy.', '[cười khẩy] Đỏ Đen... [trầm ngâm] quần nhau mãi mấy nước ấy.'],
    ['rep-02', 'Hai bên đi tới đi lui, chưa ai chịu đổi thế.', '[trầm ngâm] Hai bên đi tới đi lui... [nhấn mạnh] chưa ai chịu đổi thế.'],
    ['rep-03', 'Cứ lặp thế này, luật cờ sẽ lên tiếng.', '[nghiêm giọng] Cứ lặp thế này... [cảnh báo] luật cờ sẽ lên tiếng.'],
    ['rep-04', 'Đôi bên dò nhau, chưa ai dám xuống tay trước.', '[thì thầm] Đôi bên dò nhau... [căng thẳng] chưa ai dám xuống tay trước.'],
  ],

  prediction: [
    ['pred-01', 'Nước vừa rồi mở ra một đường sát mới.', '[hào hứng] Nước vừa rồi... [nhấn mạnh] mở ra một đường sát mới.'],
    ['pred-02', 'Thế cờ vừa xoay chiều. Đáng chú ý lắm.', '[ngạc nhiên] Thế cờ vừa xoay chiều. [nhấn mạnh] Đáng chú ý lắm.'],
    ['pred-03', 'Nếu bên kia không gỡ kịp, ắt phải mất quân.', '[cảnh báo] Nếu bên kia không gỡ kịp... [nghiêm giọng] ắt phải mất quân.'],
    ['pred-04', 'Đòn này còn dư âm ở vài nước nữa.', '[thì thầm] Đòn này... [nhấn mạnh] còn dư âm ở vài nước nữa.'],
    ['pred-05', 'Sắp có một trận đổi quân lớn ngay đây.', '[căng thẳng] Sắp có... [dõng dạc] một trận đổi quân lớn ngay đây.'],
    ['pred-06', 'Cục diện vừa nghiêng hẳn về một phía.', '[nhấn mạnh] Cục diện vừa nghiêng... [trầm giọng] hẳn về một phía.'],
    ['pred-07', 'Một sơ hở nhỏ là ván cờ đổi chủ.', '[cảnh báo] Một sơ hở nhỏ... [nghiêm giọng] là ván cờ đổi chủ.'],
    ['pred-08', 'Bên bị ép buộc phải tìm nước phá vây.', '[nghiêm giọng] Bên bị ép... [nhấn mạnh] buộc phải tìm nước phá vây.'],
  ],

  foreseeMate: [
    ['fmate-01', 'Đường sát cục đã mở. Không lấp nổi nữa.', '[dõng dạc] Đường sát cục đã mở. [lạnh lùng] Không lấp nổi nữa.'],
    ['fmate-02', 'Đã thấy nước chiếu bí. Ván cờ coi như định.', '[lạnh lùng] Đã thấy nước chiếu bí. [chậm rãi] Ván cờ coi như định.'],
    ['fmate-03', 'Tướng chạy hướng nào cũng vướng thiên la địa võng.', '[hào hùng] Tướng chạy hướng nào... [lạnh lùng] cũng vướng thiên la địa võng.'],
    ['fmate-04', 'Từ đây tới hết ván, mọi nước đã an bài.', '[trang trọng] Từ đây tới hết ván... [nhấn mạnh] mọi nước đã an bài.'],
  ],

  redWin: [
    ['rwin-01', 'Bên Đỏ thắng. Đen đã hết đường xoay xở.', '[hào hùng] Bên Đỏ thắng. [trầm giọng] Đen đã hết đường xoay xở.'],
    ['rwin-02', 'Đỏ hạ được Tướng Đen. Ván cờ khép lại.', '[dõng dạc] Đỏ hạ được Tướng Đen. [trang trọng] Ván cờ khép lại.'],
    ['rwin-03', 'Phần thắng thuộc về Đỏ. Một trận đáng xem.', '[trang trọng] Phần thắng thuộc về Đỏ. [ấm áp] Một trận đáng xem.'],
    ['rwin-04', 'Đen buông kiếm. Đỏ thắng ván này.', '[trầm giọng] Đen buông kiếm. [dõng dạc] Đỏ thắng ván này.'],
  ],

  blackWin: [
    ['bwin-01', 'Bên Đen thắng. Đỏ đã hết đường xoay xở.', '[hào hùng] Bên Đen thắng. [trầm giọng] Đỏ đã hết đường xoay xở.'],
    ['bwin-02', 'Đen hạ được Tướng Đỏ. Ván cờ khép lại.', '[dõng dạc] Đen hạ được Tướng Đỏ. [trang trọng] Ván cờ khép lại.'],
    ['bwin-03', 'Phần thắng thuộc về Đen. Một trận đáng xem.', '[trang trọng] Phần thắng thuộc về Đen. [ấm áp] Một trận đáng xem.'],
    ['bwin-04', 'Đỏ buông kiếm. Đen thắng ván này.', '[trầm giọng] Đỏ buông kiếm. [dõng dạc] Đen thắng ván này.'],
  ],

  draw: [
    ['draw-01', 'Hòa. Đỏ Đen không ai cho ai một khe hở.', '[trang trọng] Hòa. [nhấn mạnh] Đỏ Đen không ai cho ai một khe hở.'],
    ['draw-02', 'Bất phân thắng bại. Đúng là kỳ phùng địch thủ.', '[trang trọng] Bất phân thắng bại. [ấm áp] Đúng là kỳ phùng địch thủ.'],
    ['draw-03', 'Hai bên cùng lui. Ván này chia đôi.', '[chậm rãi] Hai bên cùng lui. [trang trọng] Ván này chia đôi.'],
    ['draw-04', 'Không ai thắng, mà cũng chẳng ai đáng thua.', '[điềm tĩnh] Không ai thắng... [ấm áp] mà cũng chẳng ai đáng thua.'],
  ],

  story: [
    ['story-01', 'Cờ tướng có từ đời Đường, ngàn năm nay chưa đổi.', '[trầm ngâm] Cờ tướng có từ đời Đường... [trang trọng] ngàn năm nay chưa đổi.'],
    ['story-02', 'Quất Trung Bí, Mai Hoa Phổ, cổ phổ chép tay truyền nhau.', '[kể chuyện] Quất Trung Bí... Mai Hoa Phổ... [ấm áp] cổ phổ chép tay truyền nhau.'],
    ['story-03', 'Quán cờ đầu ngõ, mặt bàn gỗ mòn lõm cả xuống.', '[kể chuyện] Quán cờ đầu ngõ... [trầm ngâm] mặt bàn gỗ mòn lõm cả xuống.'],
    ['story-04', 'Ở quán cờ, kẻ đứng xem bao giờ cũng nói to hơn người đánh.', '[cười nhẹ] Ở quán cờ... [cười khẩy] kẻ đứng xem bao giờ cũng nói to hơn người đánh.'],
    ['story-05', 'Người xưa dạy: cờ tàn học trước, khai cuộc học sau.', '[trang trọng] Người xưa dạy... [nhấn mạnh] cờ tàn học trước, khai cuộc học sau.'],
    ['story-06', 'Con sông giữa bàn tên là Sở Hà Hán Giới.', '[ngâm nga] Con sông giữa bàn... [trang trọng] tên là Sở Hà Hán Giới.'],
    ['story-07', 'Tướng chẳng rời cung, Sĩ chẳng rời Tướng. Đó là phận.', '[trang trọng] Tướng chẳng rời cung, Sĩ chẳng rời Tướng. [trầm ngâm] Đó là phận.'],
    ['story-08', 'Tốt qua sông rồi thì không còn đường lui.', '[chậm rãi] Tốt qua sông rồi... [nhấn mạnh] thì không còn đường lui.'],
    ['story-09', 'Pháo phải có ngòi mới nổ được. Kẻ mạnh cũng cần chỗ dựa.', '[điềm tĩnh] Pháo phải có ngòi mới nổ được. [nhấn mạnh] Kẻ mạnh cũng cần chỗ dựa.'],
    ['story-10', 'Mã sợ chân, Tượng sợ mắt. Quân nào cũng có tử huyệt.', '[điềm tĩnh] Mã sợ chân, Tượng sợ mắt. [thì thầm] Quân nào cũng có tử huyệt.'],
    ['story-11', 'Ngày trước đánh cờ vỉa hè, che cái ô, uống trà đá.', '[kể chuyện] Ngày trước đánh cờ vỉa hè... [ấm áp] che cái ô, uống trà đá.'],
    ['story-12', 'Có ván đánh ba ngày chưa xong. Thời ấy chẳng ai vội.', '[kể chuyện] Có ván đánh ba ngày chưa xong. [ấm áp] Thời ấy chẳng ai vội.'],
    ['story-13', 'Đánh cờ mà nóng là thua. Xưa nay vẫn thế.', '[trầm ngâm] Đánh cờ mà nóng là thua. [chậm rãi] Xưa nay vẫn thế.'],
    ['story-14', 'Chín đường dọc, mười đường ngang, cả đời đi không hết.', '[trang trọng] Chín đường dọc, mười đường ngang... [thì thầm] cả đời đi không hết.'],
    ['story-15', 'Trong quán cờ, chẳng ai hỏi nhau xuất thân là gì.', '[ấm áp] Trong quán cờ... [trang trọng] chẳng ai hỏi nhau xuất thân là gì.'],
    ['story-16', 'Kẻ mới học hay tiếc quân. Đánh lâu mới biết đạo cho đi.', '[trầm ngâm] Kẻ mới học hay tiếc quân. [nhấn mạnh] Đánh lâu mới biết đạo cho đi.'],
    ['story-17', 'Xem một ván cờ là đọc được tâm tính một người.', '[trầm ngâm] Xem một ván cờ... [ấm áp] là đọc được tâm tính một người.'],
    ['story-18', 'Có kỳ thủ cả đời chỉ luyện một thế pháo đầu.', '[kể chuyện] Có kỳ thủ cả đời... [ngạc nhiên] chỉ luyện một thế pháo đầu.'],
  ]
}

/** Lines per situation, with their audio ids filled in. */
export const LINES: Record<Situation, Line[]> = Object.fromEntries(
  Object.entries(DRAFTS).map(([situation, drafts]) => [situation, build(drafts)])
) as Record<Situation, Line[]>

/** Every reaction line. Facts live in `facts.ts` and are collected separately. */
export function allLines(): Line[] {
  return Object.values(LINES).flat()
}

/**
 * Picks a line, avoiding the ids in `recent`.
 *
 * The commentator must not repeat himself while a player is still listening, so
 * recently used lines are excluded until the pool would otherwise run dry.
 */
export function pickLine(situation: Situation, recent: readonly string[]): Line | null {
  const pool = LINES[situation]
  if (!pool || pool.length === 0) return null
  const fresh = pool.filter((l) => !recent.includes(l.id))
  const from = fresh.length > 0 ? fresh : pool
  return from[Math.floor(Math.random() * from.length)] ?? null
}
