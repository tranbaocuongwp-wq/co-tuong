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
    [
      'hello-01',
      'Kính chào chư vị kỳ hữu! Bàn cờ đã bày xong, quân hai bên đã vào vị trí, và như mọi ván cờ tướng khác, tất cả sẽ được quyết định bởi ai giữ được cái đầu lạnh lâu hơn.',
      '[trang trọng] Kính chào chư vị kỳ hữu! [ấm áp] Bàn cờ đã bày xong, quân hai bên đã vào vị trí... [nhấn mạnh] và như mọi ván cờ tướng khác, tất cả sẽ được quyết định bởi ai giữ được cái đầu lạnh lâu hơn.',
    ],
    [
      'hello-02',
      'Đỏ trấn phía nam, Đen giữ phía bắc, giữa hai bên là con sông Sở Hà Hán Giới. Ba mươi hai quân đã đứng đúng chỗ của mình, chỉ còn chờ nước đầu tiên là cuộc so tài chính thức mở màn.',
      '[trang trọng] Đỏ trấn phía nam, Đen giữ phía bắc... giữa hai bên là con sông Sở Hà Hán Giới. [dõng dạc] Ba mươi hai quân đã đứng đúng chỗ của mình... [hào hùng] chỉ còn chờ nước đầu tiên là cuộc so tài chính thức mở màn.',
    ],
    [
      'hello-03',
      'Lão phu xin phép ngồi đây hầu chuyện chư vị suốt ván này. Cờ tướng không dài như một đời người, nhưng đủ dài để người ta bộc lộ hết tính nết — và đó mới là phần đáng xem nhất.',
      '[ấm áp] Lão phu xin phép ngồi đây hầu chuyện chư vị suốt ván này. [trầm ngâm] Cờ tướng không dài như một đời người... [nhấn mạnh] nhưng đủ dài để người ta bộc lộ hết tính nết, và đó mới là phần đáng xem nhất.',
    ],
    [
      'hello-04',
      'Chiêng đã điểm, hai bên chắp tay chào nhau lần cuối. Từ giây phút này trở đi thì không còn khách sáo gì nữa, mỗi nước đi đều là một lời tuyên chiến.',
      '[hào hùng] Chiêng đã điểm, hai bên chắp tay chào nhau lần cuối. [nghiêm giọng] Từ giây phút này trở đi thì không còn khách sáo gì nữa... [dõng dạc] mỗi nước đi đều là một lời tuyên chiến.',
    ],
    [
      'hello-05',
      'Bàn cờ chín đường dọc, mười đường ngang, nhìn thì đơn giản mà cả ngàn năm nay chưa ai đi hết. Hôm nay hai vị này sẽ thêm vào đó một ván nữa. Xin mời!',
      '[trang trọng] Bàn cờ chín đường dọc, mười đường ngang... nhìn thì đơn giản mà cả ngàn năm nay chưa ai đi hết. [ấm áp] Hôm nay hai vị này sẽ thêm vào đó một ván nữa. [dõng dạc] Xin mời!',
    ],
    [
      'hello-06',
      'Trà đã rót, quân đã bày, người xem đã ngồi kín quanh bàn. Lão phu chỉ xin nhắc một câu trước khi bắt đầu: trong cờ tướng, kẻ vội vàng bao giờ cũng là kẻ trả giá trước.',
      '[ấm áp] Trà đã rót, quân đã bày, người xem đã ngồi kín quanh bàn. [trầm ngâm] Lão phu chỉ xin nhắc một câu trước khi bắt đầu... [nghiêm giọng] trong cờ tướng, kẻ vội vàng bao giờ cũng là kẻ trả giá trước.',
    ],
    [
      'hello-07',
      'Một ván cờ mới lại bắt đầu, và như mọi lần, không ai biết trước nó sẽ đi về đâu. Có ván phân thắng bại trong mười nước, có ván kéo tới tận tàn cuộc mới ngã ngũ. Ta cùng xem.',
      '[ấm áp] Một ván cờ mới lại bắt đầu... và như mọi lần, không ai biết trước nó sẽ đi về đâu. [trầm ngâm] Có ván phân thắng bại trong mười nước, có ván kéo tới tận tàn cuộc mới ngã ngũ. [tò mò] Ta cùng xem.',
    ],
    [
      'hello-08',
      'Quân đã yên chỗ, sát khí đã bắt đầu đọng lại trên mặt bàn. Cờ tướng vốn là chuyện binh đao thu nhỏ, và hôm nay chư vị sắp được xem một trận nữa từ đầu đến cuối.',
      '[thì thầm] Quân đã yên chỗ, sát khí đã bắt đầu đọng lại trên mặt bàn. [trang trọng] Cờ tướng vốn là chuyện binh đao thu nhỏ... [hào hùng] và hôm nay chư vị sắp được xem một trận nữa từ đầu đến cuối.',
    ],
  ],

  opening: [
    [
      'open-01',
      'Giai đoạn khai cuộc, hai bên còn đang thăm dò nhau. Những nước đi lúc này trông thì nhẹ nhàng, nhưng chúng quyết định cả hình dáng của trận đánh về sau.',
      '[điềm tĩnh] Giai đoạn khai cuộc, hai bên còn đang thăm dò nhau. [nhấn mạnh] Những nước đi lúc này trông thì nhẹ nhàng... nhưng chúng quyết định cả hình dáng của trận đánh về sau.',
    ],
    [
      'open-02',
      'Quân vừa rời khỏi trại, thế trận hai bên đang dần thành hình. Người có kinh nghiệm nhìn mấy nước đầu là đoán được đối phương định đánh kiểu gì.',
      '[trầm ngâm] Quân vừa rời khỏi trại, thế trận hai bên đang dần thành hình. [nhấn mạnh] Người có kinh nghiệm nhìn mấy nước đầu là đoán được đối phương định đánh kiểu gì.',
    ],
    [
      'open-03',
      'Đỏ bày binh, Đen bố trận, chưa bên nào chịu ra đòn trước. Đây là lúc cả hai đều muốn đối phương lộ ý đồ trước mình một nhịp.',
      '[dõng dạc] Đỏ bày binh, Đen bố trận, chưa bên nào chịu ra đòn trước. [thì thầm] Đây là lúc cả hai đều muốn đối phương lộ ý đồ trước mình một nhịp.',
    ],
    [
      'open-04',
      'Chưa chạm binh khí mà không khí đã đặc lại. Khai cuộc trong cờ tướng giống như hai người đấu kiếm đi vòng quanh nhau, chưa ai vung tay nhưng ai cũng đã tính đường ra đòn.',
      '[thì thầm] Chưa chạm binh khí mà không khí đã đặc lại. [ngâm nga] Khai cuộc trong cờ tướng giống như hai người đấu kiếm đi vòng quanh nhau... [căng thẳng] chưa ai vung tay nhưng ai cũng đã tính đường ra đòn.',
    ],
    [
      'open-05',
      'Sách vở gọi đây là giai đoạn bày binh bố trận. Cổ nhân dặn: khai cuộc sai một nước, trung cuộc khổ mười nước, tàn cuộc thì không còn gì mà gỡ.',
      '[trang trọng] Sách vở gọi đây là giai đoạn bày binh bố trận. [nghiêm giọng] Cổ nhân dặn... [nhấn mạnh] khai cuộc sai một nước, trung cuộc khổ mười nước, tàn cuộc thì không còn gì mà gỡ.',
    ],
    [
      'open-06',
      'Hai bên còn giữ thế thủ, chờ đối phương hở sườn. Ai nôn nóng phá thế trước ở giai đoạn này thường là người phải trả giá đầu tiên.',
      '[điềm tĩnh] Hai bên còn giữ thế thủ, chờ đối phương hở sườn. [cảnh báo] Ai nôn nóng phá thế trước ở giai đoạn này thường là người phải trả giá đầu tiên.',
    ],
  ],

  thinking: [
    [
      'think-01',
      'Hai bên đang giằng co ở giữa bàn, chưa ai chịu lui nửa bước. Thế cờ này căng như dây đàn, chỉ cần một bên buông tay là bên kia ập tới ngay.',
      '[căng thẳng] Hai bên đang giằng co ở giữa bàn, chưa ai chịu lui nửa bước. [nhấn mạnh] Thế cờ này căng như dây đàn... chỉ cần một bên buông tay là bên kia ập tới ngay.',
    ],
    [
      'think-02',
      'Đỏ và Đen cùng nín thở chờ một kẽ hở. Trong cờ tướng, phần lớn các ván không thua vì đối phương quá giỏi, mà vì mình lỡ tay một nước.',
      '[thì thầm] Đỏ và Đen cùng nín thở chờ một kẽ hở. [trầm ngâm] Trong cờ tướng, phần lớn các ván không thua vì đối phương quá giỏi... [nghiêm giọng] mà vì mình lỡ tay một nước.',
    ],
    [
      'think-03',
      'Nước này tính lâu, tức là thế cờ có chỗ hiểm. Người ngồi ngoài nhìn thì thấy bàn cờ đứng yên, nhưng trong đầu người đang đi thì đã chạy qua cả chục biến rồi.',
      '[trầm ngâm] Nước này tính lâu, tức là thế cờ có chỗ hiểm. [thì thầm] Người ngồi ngoài nhìn thì thấy bàn cờ đứng yên... [nhấn mạnh] nhưng trong đầu người đang đi thì đã chạy qua cả chục biến rồi.',
    ],
    [
      'think-04',
      'Bàn cờ lặng như tờ, mà bên dưới là sóng ngầm. Mỗi quân trên bàn lúc này đều đang giữ một nhiệm vụ, rút con nào ra là chỗ đó hở ngay.',
      '[thì thầm] Bàn cờ lặng như tờ, mà bên dưới là sóng ngầm. [nghiêm giọng] Mỗi quân trên bàn lúc này đều đang giữ một nhiệm vụ... rút con nào ra là chỗ đó hở ngay.',
    ],
    [
      'think-05',
      'Cả hai bên đều đang tính chuyện đổi quân. Đổi đúng lúc thì nhẹ gánh, đổi sai lúc thì tự tay tháo mất hàng phòng thủ của chính mình.',
      '[trầm ngâm] Cả hai bên đều đang tính chuyện đổi quân. [nhấn mạnh] Đổi đúng lúc thì nhẹ gánh... [cảnh báo] đổi sai lúc thì tự tay tháo mất hàng phòng thủ của chính mình.',
    ],
    [
      'think-06',
      'Thế trận còn rộng, đường đi hãy còn nhiều. Ở cục diện này chưa ai có thể nói chắc điều gì, và đó chính là lúc cờ hay nhất.',
      '[điềm tĩnh] Thế trận còn rộng, đường đi hãy còn nhiều. [ấm áp] Ở cục diện này chưa ai có thể nói chắc điều gì... và đó chính là lúc cờ hay nhất.',
    ],
    [
      'think-07',
      'Chưa bên nào để lộ sơ hở đáng kể. Hai người này đều biết mình đang đánh với ai, nên không ai chịu đi ẩu một nước nào.',
      '[trang trọng] Chưa bên nào để lộ sơ hở đáng kể. [nhấn mạnh] Hai người này đều biết mình đang đánh với ai... nên không ai chịu đi ẩu một nước nào.',
    ],
    [
      'think-08',
      'Trung cuộc đã tới, và đây mới là chỗ phân cao thấp. Khai cuộc thì học được, tàn cuộc thì tính được, riêng trung cuộc phải có bản lĩnh mới qua nổi.',
      '[nghiêm giọng] Trung cuộc đã tới, và đây mới là chỗ phân cao thấp. [trầm ngâm] Khai cuộc thì học được, tàn cuộc thì tính được... [nhấn mạnh] riêng trung cuộc phải có bản lĩnh mới qua nổi.',
    ],
  ],

  redAhead: [
    [
      'red-01',
      'Bên Đỏ đang chiếm thượng phong rõ rệt. Quân Đỏ có chỗ đứng tốt hơn, đường đi thoáng hơn, còn Đen thì phải lui về giữ chứ chưa tính được chuyện tấn.',
      '[dõng dạc] Bên Đỏ đang chiếm thượng phong rõ rệt. [nhấn mạnh] Quân Đỏ có chỗ đứng tốt hơn, đường đi thoáng hơn... [trầm giọng] còn Đen thì phải lui về giữ chứ chưa tính được chuyện tấn.',
    ],
    [
      'red-02',
      'Cán cân đã nghiêng hẳn về phía Đỏ. Đen bây giờ mỗi nước đều phải cân nhắc rất lâu, vì sai thêm một nước nữa là hết đường gỡ.',
      '[nhấn mạnh] Cán cân đã nghiêng hẳn về phía Đỏ. [căng thẳng] Đen bây giờ mỗi nước đều phải cân nhắc rất lâu... [nghiêm giọng] vì sai thêm một nước nữa là hết đường gỡ.',
    ],
    [
      'red-03',
      'Đỏ hơn quân, lại giữ được thế chủ động. Trong cờ tướng, hơn quân mà còn hơn cả thế thì thường là chuyện đã an bài, chỉ còn xem kết thúc nhanh hay chậm.',
      '[hào hứng] Đỏ hơn quân, lại giữ được thế chủ động. [trầm ngâm] Trong cờ tướng, hơn quân mà còn hơn cả thế thì thường là chuyện đã an bài... [lạnh lùng] chỉ còn xem kết thúc nhanh hay chậm.',
    ],
    [
      'red-04',
      'Quân Đỏ đang ép sát, Đen co cụm quanh cung. Phòng tuyến bên Đen đã rạn vài chỗ, mà chỗ nào cũng cần quân giữ trong khi quân thì không đủ.',
      '[dõng dạc] Quân Đỏ đang ép sát, Đen co cụm quanh cung. [căng thẳng] Phòng tuyến bên Đen đã rạn vài chỗ... [trầm giọng] mà chỗ nào cũng cần quân giữ trong khi quân thì không đủ.',
    ],
    [
      'red-05',
      'Đỏ đang nắm thế chủ động hoàn toàn. Đen vẫn còn chống được, nhưng chống đỡ mãi mà không phản công thì trước sau cũng vỡ.',
      '[nhấn mạnh] Đỏ đang nắm thế chủ động hoàn toàn. [trầm ngâm] Đen vẫn còn chống được... [cảnh báo] nhưng chống đỡ mãi mà không phản công thì trước sau cũng vỡ.',
    ],
    [
      'red-06',
      'Thế cờ bên Đen đã hỏng ở nhiều chỗ cùng lúc. Đây là tình huống khó nhất trong cờ tướng: cứu được chỗ này thì hở chỗ kia, mà quân thì chỉ có bấy nhiêu.',
      '[nghiêm giọng] Thế cờ bên Đen đã hỏng ở nhiều chỗ cùng lúc. [trầm giọng] Đây là tình huống khó nhất trong cờ tướng... [nhấn mạnh] cứu được chỗ này thì hở chỗ kia, mà quân thì chỉ có bấy nhiêu.',
    ],
  ],

  blackAhead: [
    [
      'black-01',
      'Bên Đen đang chiếm thượng phong rõ rệt. Quân Đen có chỗ đứng tốt hơn, đường đi thoáng hơn, còn Đỏ thì phải lui về giữ chứ chưa tính được chuyện tấn.',
      '[dõng dạc] Bên Đen đang chiếm thượng phong rõ rệt. [nhấn mạnh] Quân Đen có chỗ đứng tốt hơn, đường đi thoáng hơn... [trầm giọng] còn Đỏ thì phải lui về giữ chứ chưa tính được chuyện tấn.',
    ],
    [
      'black-02',
      'Cán cân đã nghiêng hẳn về phía Đen. Đỏ bây giờ mỗi nước đều phải cân nhắc rất lâu, vì sai thêm một nước nữa là hết đường gỡ.',
      '[nhấn mạnh] Cán cân đã nghiêng hẳn về phía Đen. [căng thẳng] Đỏ bây giờ mỗi nước đều phải cân nhắc rất lâu... [nghiêm giọng] vì sai thêm một nước nữa là hết đường gỡ.',
    ],
    [
      'black-03',
      'Đen hơn quân, lại giữ được thế chủ động. Trong cờ tướng, hơn quân mà còn hơn cả thế thì thường là chuyện đã an bài, chỉ còn xem kết thúc nhanh hay chậm.',
      '[hào hứng] Đen hơn quân, lại giữ được thế chủ động. [trầm ngâm] Trong cờ tướng, hơn quân mà còn hơn cả thế thì thường là chuyện đã an bài... [lạnh lùng] chỉ còn xem kết thúc nhanh hay chậm.',
    ],
    [
      'black-04',
      'Quân Đen đang ép sát, Đỏ co cụm quanh cung. Phòng tuyến bên Đỏ đã rạn vài chỗ, mà chỗ nào cũng cần quân giữ trong khi quân thì không đủ.',
      '[dõng dạc] Quân Đen đang ép sát, Đỏ co cụm quanh cung. [căng thẳng] Phòng tuyến bên Đỏ đã rạn vài chỗ... [trầm giọng] mà chỗ nào cũng cần quân giữ trong khi quân thì không đủ.',
    ],
    [
      'black-05',
      'Đen đang nắm thế chủ động hoàn toàn. Đỏ vẫn còn chống được, nhưng chống đỡ mãi mà không phản công thì trước sau cũng vỡ.',
      '[nhấn mạnh] Đen đang nắm thế chủ động hoàn toàn. [trầm ngâm] Đỏ vẫn còn chống được... [cảnh báo] nhưng chống đỡ mãi mà không phản công thì trước sau cũng vỡ.',
    ],
    [
      'black-06',
      'Thế cờ bên Đỏ đã hỏng ở nhiều chỗ cùng lúc. Đây là tình huống khó nhất trong cờ tướng: cứu được chỗ này thì hở chỗ kia, mà quân thì chỉ có bấy nhiêu.',
      '[nghiêm giọng] Thế cờ bên Đỏ đã hỏng ở nhiều chỗ cùng lúc. [trầm giọng] Đây là tình huống khó nhất trong cờ tướng... [nhấn mạnh] cứu được chỗ này thì hở chỗ kia, mà quân thì chỉ có bấy nhiêu.',
    ],
  ],

  balanced: [
    [
      'bal-01',
      'Đỏ Đen cân sức từng quân một, chưa ai lấy được gì của ai. Những ván như thế này thường không phân định bằng đòn hiểm, mà bằng ai chịu khó hơn ở những nước tưởng như vô thưởng vô phạt.',
      '[điềm tĩnh] Đỏ Đen cân sức từng quân một, chưa ai lấy được gì của ai. [trầm ngâm] Những ván như thế này thường không phân định bằng đòn hiểm... [nhấn mạnh] mà bằng ai chịu khó hơn ở những nước tưởng như vô thưởng vô phạt.',
    ],
    [
      'bal-02',
      'Thế trận cân bằng như hai lưỡi kiếm chạm nhau giữa không trung. Bên nào ấn mạnh trước thì bên ấy hở sườn trước, nên cả hai đều đang chờ.',
      '[trang trọng] Thế trận cân bằng như hai lưỡi kiếm chạm nhau giữa không trung. [thì thầm] Bên nào ấn mạnh trước thì bên ấy hở sườn trước... [căng thẳng] nên cả hai đều đang chờ.',
    ],
    [
      'bal-03',
      'Đổi qua đổi lại mà cán cân vẫn không nghiêng. Hai bên đang đọc được ý nhau, mỗi đòn tung ra đều bị hoá giải gần như ngay lập tức.',
      '[trầm ngâm] Đổi qua đổi lại mà cán cân vẫn không nghiêng. [nhấn mạnh] Hai bên đang đọc được ý nhau... mỗi đòn tung ra đều bị hoá giải gần như ngay lập tức.',
    ],
    [
      'bal-04',
      'Hai bên ngang tài ngang sức, ván này còn dài. Cờ tướng có cái hay là thế cân bằng không bao giờ đứng yên lâu, chỉ cần một nước lơ đãng là mọi thứ đổ về một phía.',
      '[điềm tĩnh] Hai bên ngang tài ngang sức, ván này còn dài. [trầm ngâm] Cờ tướng có cái hay là thế cân bằng không bao giờ đứng yên lâu... [cảnh báo] chỉ cần một nước lơ đãng là mọi thứ đổ về một phía.',
    ],
    [
      'bal-05',
      'Cục diện đang ở thế giằng co không bên nào nhỉnh hơn. Ván này rồi sẽ do một nước lỡ tay quyết định, chứ không phải do ai tính sâu hơn ai.',
      '[thì thầm] Cục diện đang ở thế giằng co không bên nào nhỉnh hơn. [nghiêm giọng] Ván này rồi sẽ do một nước lỡ tay quyết định... chứ không phải do ai tính sâu hơn ai.',
    ],
  ],

  endgame: [
    [
      'end-01',
      'Đã vào tàn cuộc, quân hai bên thưa hẳn trên bàn. Từ đây trở đi mỗi nước nặng gấp mười lúc đầu, vì không còn quân dự phòng để sửa sai nữa.',
      '[trầm giọng] Đã vào tàn cuộc, quân hai bên thưa hẳn trên bàn. [nhấn mạnh] Từ đây trở đi mỗi nước nặng gấp mười lúc đầu... vì không còn quân dự phòng để sửa sai nữa.',
    ],
    [
      'end-02',
      'Bàn cờ trống trải, Tướng hai bên bắt đầu phải tự thân vận động. Ở tàn cuộc, con Tướng không còn là kẻ trốn trong cung mà thành một quân chiến đấu thực thụ.',
      '[chậm rãi] Bàn cờ trống trải, Tướng hai bên bắt đầu phải tự thân vận động. [nhấn mạnh] Ở tàn cuộc, con Tướng không còn là kẻ trốn trong cung... [dõng dạc] mà thành một quân chiến đấu thực thụ.',
    ],
    [
      'end-03',
      'Ít quân mà lại khó hơn nhiều quân, đó là cái lạ của cờ tàn. Lúc đông quân thì sai một nước còn có chỗ đỡ, lúc này sai một nước là xong.',
      '[trầm ngâm] Ít quân mà lại khó hơn nhiều quân, đó là cái lạ của cờ tàn. [nghiêm giọng] Lúc đông quân thì sai một nước còn có chỗ đỡ... [lạnh lùng] lúc này sai một nước là xong.',
    ],
    [
      'end-04',
      'Con tốt qua sông lúc này đáng giá ngàn vàng. Cổ nhân bảo tàn cuộc một tốt bằng nửa con xe, nghe thì lạ mà đánh nhiều rồi mới thấy đúng.',
      '[nhấn mạnh] Con tốt qua sông lúc này đáng giá ngàn vàng. [trang trọng] Cổ nhân bảo tàn cuộc một tốt bằng nửa con xe... [ấm áp] nghe thì lạ mà đánh nhiều rồi mới thấy đúng.',
    ],
    [
      'end-05',
      'Cờ tàn không che giấu được sơ hở nào. Đến chặng này thì kỹ thuật lộ ra hết, ai học hành tử tế và ai chỉ đánh theo cảm tính đều rõ mồn một.',
      '[nghiêm giọng] Cờ tàn không che giấu được sơ hở nào. [nhấn mạnh] Đến chặng này thì kỹ thuật lộ ra hết... ai học hành tử tế và ai chỉ đánh theo cảm tính đều rõ mồn một.',
    ],
    [
      'end-06',
      'Quân đã ít, thế cờ đã rõ hình. Bây giờ không còn chỗ cho những nước đi cho có, mỗi nước đều phải có mục đích cụ thể.',
      '[chậm rãi] Quân đã ít, thế cờ đã rõ hình. [nghiêm giọng] Bây giờ không còn chỗ cho những nước đi cho có... [nhấn mạnh] mỗi nước đều phải có mục đích cụ thể.',
    ],
  ],

  repetition: [
    [
      'rep-01',
      'Đỏ Đen cứ quần nhau mãi mấy nước ấy. Đây là lúc thử thần kinh nhau, ai sốt ruột đổi thế trước thì thường là người thiệt.',
      '[cười khẩy] Đỏ Đen cứ quần nhau mãi mấy nước ấy. [thì thầm] Đây là lúc thử thần kinh nhau... [nhấn mạnh] ai sốt ruột đổi thế trước thì thường là người thiệt.',
    ],
    [
      'rep-02',
      'Hai bên đi tới đi lui, chưa ai chịu đổi thế. Có khi cả hai đều thấy đổi đi là hỏng, nên đành giữ nguyên và chờ đối phương nghĩ khác.',
      '[trầm ngâm] Hai bên đi tới đi lui, chưa ai chịu đổi thế. [nhấn mạnh] Có khi cả hai đều thấy đổi đi là hỏng... nên đành giữ nguyên và chờ đối phương nghĩ khác.',
    ],
    [
      'rep-03',
      'Cứ lặp thế này mãi thì luật cờ sẽ phải lên tiếng. Bên nào ép liên tục mà không chịu buông sẽ bị xử thua, đó là luật để không ai lấy sự lì lợm thay cho kỹ thuật.',
      '[nghiêm giọng] Cứ lặp thế này mãi thì luật cờ sẽ phải lên tiếng. [cảnh báo] Bên nào ép liên tục mà không chịu buông sẽ bị xử thua... [trang trọng] đó là luật để không ai lấy sự lì lợm thay cho kỹ thuật.',
    ],
    [
      'rep-04',
      'Đôi bên đang dò nhau, chưa ai dám xuống tay trước. Thế cờ đứng im nhưng đồng hồ thì không, và người nào bí trước sẽ phải phá vỡ nó.',
      '[thì thầm] Đôi bên đang dò nhau, chưa ai dám xuống tay trước. [căng thẳng] Thế cờ đứng im nhưng đồng hồ thì không... [nhấn mạnh] và người nào bí trước sẽ phải phá vỡ nó.',
    ],
  ],

  prediction: [
    [
      'pred-01',
      'Nước vừa rồi mở ra một hướng tấn công hoàn toàn mới. Cả cục diện vừa xoay một góc, và những tính toán từ mấy nước trước giờ phải bỏ đi làm lại.',
      '[hào hứng] Nước vừa rồi mở ra một hướng tấn công hoàn toàn mới. [nhấn mạnh] Cả cục diện vừa xoay một góc... và những tính toán từ mấy nước trước giờ phải bỏ đi làm lại.',
    ],
    [
      'pred-02',
      'Thế cờ vừa đổi chiều, và đổi khá mạnh. Đây là loại nước mà xem lại ván đấu người ta sẽ dừng đúng ở đây và bảo: chỗ này là bước ngoặt.',
      '[ngạc nhiên] Thế cờ vừa đổi chiều, và đổi khá mạnh. [trầm ngâm] Đây là loại nước mà xem lại ván đấu người ta sẽ dừng đúng ở đây... [nhấn mạnh] và bảo, chỗ này là bước ngoặt.',
    ],
    [
      'pred-03',
      'Nếu bên kia không gỡ kịp trong một hai nước thì ắt phải mất quân. Mà gỡ được quân thì lại hở thế, kiểu gì cũng phải trả một cái giá.',
      '[cảnh báo] Nếu bên kia không gỡ kịp trong một hai nước thì ắt phải mất quân. [nghiêm giọng] Mà gỡ được quân thì lại hở thế... [nhấn mạnh] kiểu gì cũng phải trả một cái giá.',
    ],
    [
      'pred-04',
      'Đòn này còn dư âm ở vài nước nữa chứ chưa hết ngay. Cái hay của nó không nằm ở chỗ ăn được gì bây giờ, mà ở chỗ nó dựng sẵn cái bẫy cho sau này.',
      '[thì thầm] Đòn này còn dư âm ở vài nước nữa chứ chưa hết ngay. [nhấn mạnh] Cái hay của nó không nằm ở chỗ ăn được gì bây giờ... [ranh mãnh] mà ở chỗ nó dựng sẵn cái bẫy cho sau này.',
    ],
    [
      'pred-05',
      'Sắp có một trận đổi quân lớn ngay chỗ này. Sau khi khói tan thì cục diện sẽ khác hẳn, và bên nào tính đúng hơn nửa nước sẽ là bên hưởng lợi.',
      '[căng thẳng] Sắp có một trận đổi quân lớn ngay chỗ này. [nhấn mạnh] Sau khi khói tan thì cục diện sẽ khác hẳn... [dõng dạc] và bên nào tính đúng hơn nửa nước sẽ là bên hưởng lợi.',
    ],
    [
      'pred-06',
      'Cục diện vừa nghiêng hẳn về một phía. Từ đây bên trên cơ chỉ cần đi cho chắc là thắng, còn bên dưới cơ phải tìm ra thứ gì đó bất ngờ mới có cửa.',
      '[nhấn mạnh] Cục diện vừa nghiêng hẳn về một phía. [trầm giọng] Từ đây bên trên cơ chỉ cần đi cho chắc là thắng... [nghiêm giọng] còn bên dưới cơ phải tìm ra thứ gì đó bất ngờ mới có cửa.',
    ],
    [
      'pred-07',
      'Chỉ một sơ hở nhỏ là cả ván cờ đổi chủ. Cờ tướng tàn nhẫn ở chỗ đó, công sức ba mươi nước có thể tan trong một nước.',
      '[cảnh báo] Chỉ một sơ hở nhỏ là cả ván cờ đổi chủ. [trầm giọng] Cờ tướng tàn nhẫn ở chỗ đó... [nhấn mạnh] công sức ba mươi nước có thể tan trong một nước.',
    ],
    [
      'pred-08',
      'Bên bị ép giờ buộc phải tìm nước phá vây. Ngồi yên chịu trận thì càng lúc càng ngạt, mà phá vây thì phải chấp nhận thí quân — chẳng có đường nào dễ.',
      '[nghiêm giọng] Bên bị ép giờ buộc phải tìm nước phá vây. [căng thẳng] Ngồi yên chịu trận thì càng lúc càng ngạt... [trầm giọng] mà phá vây thì phải chấp nhận thí quân, chẳng có đường nào dễ.',
    ],
  ],

  foreseeMate: [
    [
      'fmate-01',
      'Đường sát cục đã mở ra và không còn lấp được nữa. Từ giây phút này mọi nước đi chỉ là thủ tục, kết quả đã nằm sẵn trên bàn cờ rồi.',
      '[dõng dạc] Đường sát cục đã mở ra và không còn lấp được nữa. [lạnh lùng] Từ giây phút này mọi nước đi chỉ là thủ tục... [chậm rãi] kết quả đã nằm sẵn trên bàn cờ rồi.',
    ],
    [
      'fmate-02',
      'Đã thấy nước chiếu bí, ván cờ coi như đã định. Bên bị dồn vẫn còn đi được, nhưng đi hướng nào cũng chỉ là chọn cách thua cho đỡ khó coi.',
      '[lạnh lùng] Đã thấy nước chiếu bí, ván cờ coi như đã định. [trầm giọng] Bên bị dồn vẫn còn đi được... [nhấn mạnh] nhưng đi hướng nào cũng chỉ là chọn cách thua cho đỡ khó coi.',
    ],
    [
      'fmate-03',
      'Tướng chạy hướng nào cũng vướng thiên la địa võng. Đây chính là cái đẹp tàn nhẫn của cờ tướng: khi lưới đã giăng đủ thì không có phép màu nào cả.',
      '[hào hùng] Tướng chạy hướng nào cũng vướng thiên la địa võng. [trang trọng] Đây chính là cái đẹp tàn nhẫn của cờ tướng... [lạnh lùng] khi lưới đã giăng đủ thì không có phép màu nào cả.',
    ],
    [
      'fmate-04',
      'Từ đây tới hết ván, mọi nước đều đã an bài. Người tính ra sát cục này hẳn đã nhìn thấy nó từ mấy nước trước, và cứ thế lùa đối phương vào đúng chỗ.',
      '[trang trọng] Từ đây tới hết ván, mọi nước đều đã an bài. [nhấn mạnh] Người tính ra sát cục này hẳn đã nhìn thấy nó từ mấy nước trước... [lạnh lùng] và cứ thế lùa đối phương vào đúng chỗ.',
    ],
  ],

  redWin: [
    [
      'rwin-01',
      'Bên Đỏ thắng ván này. Đen đã chống đến nước cuối cùng nhưng thế cờ không cho phép thêm nữa, và Đỏ kết thúc rất dứt khoát.',
      '[hào hùng] Bên Đỏ thắng ván này. [trầm giọng] Đen đã chống đến nước cuối cùng nhưng thế cờ không cho phép thêm nữa... [dõng dạc] và Đỏ kết thúc rất dứt khoát.',
    ],
    [
      'rwin-02',
      'Ván cờ khép lại, phần thắng thuộc về Đỏ. Một trận đáng xem từ đầu tới cuối, và lão phu xin cảm ơn cả hai bên đã cho một ván ra ván.',
      '[trang trọng] Ván cờ khép lại, phần thắng thuộc về Đỏ. [ấm áp] Một trận đáng xem từ đầu tới cuối... và lão phu xin cảm ơn cả hai bên đã cho một ván ra ván.',
    ],
    [
      'rwin-03',
      'Đen buông kiếm, Đỏ thắng. Nhìn lại cả ván thì Đỏ đã giành thế chủ động từ khá sớm và không bao giờ trả lại nữa.',
      '[dõng dạc] Đen buông kiếm, Đỏ thắng. [trầm ngâm] Nhìn lại cả ván thì Đỏ đã giành thế chủ động từ khá sớm... [nhấn mạnh] và không bao giờ trả lại nữa.',
    ],
    [
      'rwin-04',
      'Đỏ hạ được Tướng Đen, ván đấu kết thúc. Cờ tướng là vậy, dù hơn hay kém bao nhiêu quân đi nữa thì tất cả cũng chỉ để đi tới một nước cuối cùng này.',
      '[hào hùng] Đỏ hạ được Tướng Đen, ván đấu kết thúc. [trang trọng] Cờ tướng là vậy, dù hơn hay kém bao nhiêu quân đi nữa... [nhấn mạnh] thì tất cả cũng chỉ để đi tới một nước cuối cùng này.',
    ],
  ],

  blackWin: [
    [
      'bwin-01',
      'Bên Đen thắng ván này. Đỏ đã chống đến nước cuối cùng nhưng thế cờ không cho phép thêm nữa, và Đen kết thúc rất dứt khoát.',
      '[hào hùng] Bên Đen thắng ván này. [trầm giọng] Đỏ đã chống đến nước cuối cùng nhưng thế cờ không cho phép thêm nữa... [dõng dạc] và Đen kết thúc rất dứt khoát.',
    ],
    [
      'bwin-02',
      'Ván cờ khép lại, phần thắng thuộc về Đen. Một trận đáng xem từ đầu tới cuối, và lão phu xin cảm ơn cả hai bên đã cho một ván ra ván.',
      '[trang trọng] Ván cờ khép lại, phần thắng thuộc về Đen. [ấm áp] Một trận đáng xem từ đầu tới cuối... và lão phu xin cảm ơn cả hai bên đã cho một ván ra ván.',
    ],
    [
      'bwin-03',
      'Đỏ buông kiếm, Đen thắng. Nhìn lại cả ván thì Đen đã giành thế chủ động từ khá sớm và không bao giờ trả lại nữa.',
      '[dõng dạc] Đỏ buông kiếm, Đen thắng. [trầm ngâm] Nhìn lại cả ván thì Đen đã giành thế chủ động từ khá sớm... [nhấn mạnh] và không bao giờ trả lại nữa.',
    ],
    [
      'bwin-04',
      'Đen hạ được Tướng Đỏ, ván đấu kết thúc. Cờ tướng là vậy, dù hơn hay kém bao nhiêu quân đi nữa thì tất cả cũng chỉ để đi tới một nước cuối cùng này.',
      '[hào hùng] Đen hạ được Tướng Đỏ, ván đấu kết thúc. [trang trọng] Cờ tướng là vậy, dù hơn hay kém bao nhiêu quân đi nữa... [nhấn mạnh] thì tất cả cũng chỉ để đi tới một nước cuối cùng này.',
    ],
  ],

  draw: [
    [
      'draw-01',
      'Hoà cờ. Đỏ Đen không ai cho ai một khe hở nào suốt cả ván, và một kết quả hoà ở đây là hoàn toàn xứng đáng cho cả hai.',
      '[trang trọng] Hoà cờ. [nhấn mạnh] Đỏ Đen không ai cho ai một khe hở nào suốt cả ván... [ấm áp] và một kết quả hoà ở đây là hoàn toàn xứng đáng cho cả hai.',
    ],
    [
      'draw-02',
      'Bất phân thắng bại, đúng là kỳ phùng địch thủ. Có những ván mà hoà lại hay hơn thắng, vì nó cho thấy hai bên đọc được nhau đến từng nước.',
      '[trang trọng] Bất phân thắng bại, đúng là kỳ phùng địch thủ. [ấm áp] Có những ván mà hoà lại hay hơn thắng... [nhấn mạnh] vì nó cho thấy hai bên đọc được nhau đến từng nước.',
    ],
    [
      'draw-03',
      'Hai bên cùng lui, ván này chia đôi. Không ai thắng mà cũng chẳng ai đáng thua, thế cờ đã cạn đường cho cả hai phía.',
      '[chậm rãi] Hai bên cùng lui, ván này chia đôi. [điềm tĩnh] Không ai thắng mà cũng chẳng ai đáng thua... [trang trọng] thế cờ đã cạn đường cho cả hai phía.',
    ],
    [
      'draw-04',
      'Ván cờ khép lại ở thế cân bằng. Đôi khi hoà mới là kết quả trung thực nhất, và ép cho ra thắng thua bằng mọi giá thì thường là hỏng cả ván.',
      '[trang trọng] Ván cờ khép lại ở thế cân bằng. [trầm ngâm] Đôi khi hoà mới là kết quả trung thực nhất... [nhấn mạnh] và ép cho ra thắng thua bằng mọi giá thì thường là hỏng cả ván.',
    ],
  ],

  story: [
    [
      'story-01',
      'Cờ tướng có từ đời Đường, tới đời Tống đã thành hình gần như bây giờ. Ngàn năm trôi qua, bao nhiêu thứ đã đổi, riêng cái bàn cờ này thì gần như y nguyên.',
      '[trầm ngâm] Cờ tướng có từ đời Đường, tới đời Tống đã thành hình gần như bây giờ. [trang trọng] Ngàn năm trôi qua, bao nhiêu thứ đã đổi... [nhấn mạnh] riêng cái bàn cờ này thì gần như y nguyên.',
    ],
    [
      'story-02',
      'Quất Trung Bí, Mai Hoa Phổ — những quyển cổ phổ ấy ngày xưa người ta chép tay truyền nhau. Có người đi bộ mấy trăm dặm chỉ để mượn về chép lại một quyển.',
      '[kể chuyện] Quất Trung Bí, Mai Hoa Phổ... những quyển cổ phổ ấy ngày xưa người ta chép tay truyền nhau. [ngạc nhiên] Có người đi bộ mấy trăm dặm... [ấm áp] chỉ để mượn về chép lại một quyển.',
    ],
    [
      'story-03',
      'Lão phu từng thấy một quán cờ đầu ngõ, mặt bàn gỗ mòn lõm hẳn xuống. Bao nhiêu ván đã đi qua chỗ đó, bao nhiêu người thắng thua rồi lại về nhà ăn cơm như thường.',
      '[kể chuyện] Lão phu từng thấy một quán cờ đầu ngõ, mặt bàn gỗ mòn lõm hẳn xuống. [trầm ngâm] Bao nhiêu ván đã đi qua chỗ đó... [ấm áp] bao nhiêu người thắng thua rồi lại về nhà ăn cơm như thường.',
    ],
    [
      'story-04',
      'Ở quán cờ thì kẻ đứng xem bao giờ cũng nói to hơn người đang đánh. Mà lạ một cái, bảo họ ngồi xuống đánh thử thì ai cũng bận.',
      '[cười nhẹ] Ở quán cờ thì kẻ đứng xem bao giờ cũng nói to hơn người đang đánh. [cười khẩy] Mà lạ một cái... bảo họ ngồi xuống đánh thử thì ai cũng bận.',
    ],
    [
      'story-05',
      'Người xưa dạy: cờ tàn học trước, khai cuộc học sau. Nghe thì ngược đời, nhưng ai học đúng thứ tự ấy đều tiến nhanh hơn hẳn.',
      '[trang trọng] Người xưa dạy, cờ tàn học trước, khai cuộc học sau. [ngạc nhiên] Nghe thì ngược đời... [nhấn mạnh] nhưng ai học đúng thứ tự ấy đều tiến nhanh hơn hẳn.',
    ],
    [
      'story-06',
      'Con sông giữa bàn cờ tên là Sở Hà Hán Giới, lấy từ chuyện Hạng Vũ với Lưu Bang chia đôi thiên hạ. Mỗi lần một con tốt bước qua đó là một lần nhắc lại tích cũ.',
      '[ngâm nga] Con sông giữa bàn cờ tên là Sở Hà Hán Giới... lấy từ chuyện Hạng Vũ với Lưu Bang chia đôi thiên hạ. [trang trọng] Mỗi lần một con tốt bước qua đó... [nhấn mạnh] là một lần nhắc lại tích cũ.',
    ],
    [
      'story-07',
      'Tướng chẳng được rời cung, Sĩ chẳng được rời Tướng, Tượng chẳng được qua sông. Người đặt ra luật này hẳn muốn nói với ta điều gì đó về chữ phận.',
      '[trang trọng] Tướng chẳng được rời cung, Sĩ chẳng được rời Tướng, Tượng chẳng được qua sông. [trầm ngâm] Người đặt ra luật này... [nhấn mạnh] hẳn muốn nói với ta điều gì đó về chữ phận.',
    ],
    [
      'story-08',
      'Con tốt qua sông thì không còn đường lui, chỉ được đi tới. Cả bàn cờ có mỗi nó là không được hối hận, mà cũng chính nó nhiều khi lại quyết định cả ván.',
      '[chậm rãi] Con tốt qua sông thì không còn đường lui, chỉ được đi tới. [trầm ngâm] Cả bàn cờ có mỗi nó là không được hối hận... [nhấn mạnh] mà cũng chính nó nhiều khi lại quyết định cả ván.',
    ],
    [
      'story-09',
      'Pháo phải có ngòi mới bắn được, không có ngòi thì nó chỉ là một khối gỗ. Kẻ mạnh nào cũng cần một chỗ dựa, chuyện ấy đâu riêng gì cờ.',
      '[điềm tĩnh] Pháo phải có ngòi mới bắn được, không có ngòi thì nó chỉ là một khối gỗ. [nhấn mạnh] Kẻ mạnh nào cũng cần một chỗ dựa... [ấm áp] chuyện ấy đâu riêng gì cờ.',
    ],
    [
      'story-10',
      'Mã sợ chân, Tượng sợ mắt, Xe sợ bị chặn đường. Quân nào cũng có tử huyệt, vấn đề chỉ là ai nhìn ra trước và ai chịu khó tìm.',
      '[điềm tĩnh] Mã sợ chân, Tượng sợ mắt, Xe sợ bị chặn đường. [thì thầm] Quân nào cũng có tử huyệt... [nhấn mạnh] vấn đề chỉ là ai nhìn ra trước và ai chịu khó tìm.',
    ],
    [
      'story-11',
      'Ngày trước người ta đánh cờ ngoài vỉa hè, che cái ô, uống trà đá, cãi nhau ỏm tỏi. Bây giờ đánh trên màn hình, sạch sẽ hơn nhiều mà lão phu vẫn thấy nhớ cái ồn ào ấy.',
      '[kể chuyện] Ngày trước người ta đánh cờ ngoài vỉa hè, che cái ô, uống trà đá, cãi nhau ỏm tỏi. [ấm áp] Bây giờ đánh trên màn hình, sạch sẽ hơn nhiều... [trầm ngâm] mà lão phu vẫn thấy nhớ cái ồn ào ấy.',
    ],
    [
      'story-12',
      'Có những ván đánh ba ngày chưa xong, hai bên cứ để nguyên bàn đó rồi mai đánh tiếp. Thời ấy chẳng ai vội, và cờ vì thế cũng sâu hơn.',
      '[kể chuyện] Có những ván đánh ba ngày chưa xong, hai bên cứ để nguyên bàn đó rồi mai đánh tiếp. [ấm áp] Thời ấy chẳng ai vội... [nhấn mạnh] và cờ vì thế cũng sâu hơn.',
    ],
    [
      'story-13',
      'Đánh cờ mà nóng là thua, xưa nay vẫn thế. Lão phu học được điều đó sau chừng một ngàn ván, mà thú thật là thỉnh thoảng vẫn quên.',
      '[trầm ngâm] Đánh cờ mà nóng là thua, xưa nay vẫn thế. [cười khẩy] Lão phu học được điều đó sau chừng một ngàn ván... [ấm áp] mà thú thật là thỉnh thoảng vẫn quên.',
    ],
    [
      'story-14',
      'Xem một người đánh cờ là đọc được tính người ấy. Ai tham thì thấy quân là ăn, ai nhát thì thủ mãi không dám ra, ai bản lĩnh thì biết lúc nào nên thí.',
      '[trầm ngâm] Xem một người đánh cờ là đọc được tính người ấy. [nhấn mạnh] Ai tham thì thấy quân là ăn, ai nhát thì thủ mãi không dám ra... [trang trọng] ai bản lĩnh thì biết lúc nào nên thí.',
    ],
    [
      'story-15',
      'Kẻ mới học hay tiếc quân, thấy mất con nào cũng xót. Đánh lâu rồi mới hiểu có lúc phải cho đi mới lấy được, và đó là bài học đắt nhất của cờ tướng.',
      '[trầm ngâm] Kẻ mới học hay tiếc quân, thấy mất con nào cũng xót. [nhấn mạnh] Đánh lâu rồi mới hiểu có lúc phải cho đi mới lấy được... [trang trọng] và đó là bài học đắt nhất của cờ tướng.',
    ],
    [
      'story-16',
      'Trong quán cờ chẳng ai hỏi nhau làm nghề gì, xuất thân ra sao. Ngồi xuống đối diện nhau là ngang hàng, chỉ có nước cờ mới nói lên được anh là ai.',
      '[ấm áp] Trong quán cờ chẳng ai hỏi nhau làm nghề gì, xuất thân ra sao. [trang trọng] Ngồi xuống đối diện nhau là ngang hàng... [nhấn mạnh] chỉ có nước cờ mới nói lên được anh là ai.',
    ],
    [
      'story-17',
      'Có kỳ thủ cả đời chỉ luyện một thế pháo đầu, ai cũng biết ông ta sẽ đi gì mà vẫn không cản nổi. Đánh cờ đến mức ấy thì đâu còn là kỹ thuật nữa.',
      '[kể chuyện] Có kỳ thủ cả đời chỉ luyện một thế pháo đầu... [ngạc nhiên] ai cũng biết ông ta sẽ đi gì mà vẫn không cản nổi. [trang trọng] Đánh cờ đến mức ấy thì đâu còn là kỹ thuật nữa.',
    ],
    [
      'story-18',
      'Bàn cờ chỉ có chín đường dọc mười đường ngang, vậy mà cả đời người đi không hết. Càng đánh càng thấy mình biết ít, đó mới là chỗ nó giữ chân người ta.',
      '[trang trọng] Bàn cờ chỉ có chín đường dọc mười đường ngang, vậy mà cả đời người đi không hết. [trầm ngâm] Càng đánh càng thấy mình biết ít... [ấm áp] đó mới là chỗ nó giữ chân người ta.',
    ],
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
