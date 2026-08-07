/**
 * The commentator's script.
 *
 * He is not in the game. He is someone who wandered up to the table, knows
 * chess, and is telling whoever is standing next to him what he sees. That is
 * the whole rule this file follows, and an early version broke it: it spoke
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
 * ## Two things this file is careful about
 *
 * **Pool depth.** A situation with four lines in it repeats inside one game,
 * and a commentator who repeats himself is worse than one who says nothing. The
 * situations a player meets most — the read of a quiet position, the anecdote
 * that fills a long think — carry the deepest pools.
 *
 * **Mirrors stay mirrors.** "Red is winning" and "Black is winning" are the
 * same remark with the colours swapped, and hand-writing both is how they drift
 * apart: one gets edited, the other does not, and Black ends up with worse
 * commentary than Red for no reason anybody intended. They are generated from
 * one set of templates instead.
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
   * broadcast that sounds switched off. This is the deepest pool in the file
   * because it is the one that fires most often on a slow game.
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

/**
 * Delivery for a situation: a pair of tags per line, rotated through the pool.
 *
 * The first tag opens the remark, the second takes over at the sentence break —
 * an observation and then a verdict, which is the shape nearly every line here
 * has. Written as data rather than hand-tagged into each string because a
 * hundred and forty hand-tagged lines is a hundred and forty chances to leave a
 * bracket open, and because rotating the pairs stops a whole situation being
 * read in the same register.
 */
type Tone = [open: string, turn: string]

function toneFor(pairs: Tone[], index: number): Tone {
  return pairs[index % pairs.length]
}

/**
 * Splits a line at its first sentence break and tags the halves.
 *
 * The pause is where a person breathes, so it is also where the delivery is
 * allowed to change.
 */
function perform(text: string, [open, turn]: Tone): string {
  const cut = text.indexOf('. ')
  if (cut < 0) return `${open} ${text}`
  return `${open} ${text.slice(0, cut + 1)} ${turn} ${text.slice(cut + 2)}`
}

function build(prefix: string, texts: string[], tones: Tone[]): Line[] {
  return texts.map((text, i) => {
    const key = `${prefix}-${String(i + 1).padStart(2, '0')}`
    const speech = perform(text, toneFor(tones, i))
    return { key, text, speech, id: lineId(key, speech) }
  })
}

const GREETING = [
  'Chiêng vừa dứt, hai bên đã an vị. Ba mươi hai quân đứng im phăng phắc, mà lão phu dám chắc trong đầu cả hai người đã đánh xong ván này mấy lượt rồi.',
  'Bàn cờ mới tinh, chưa một vết. Cái đẹp của lúc này là chưa ai sai điều gì cả, và cái buồn cười là chỉ mấy nước nữa thôi là hết đẹp.',
  'Kính thưa chư vị, ván cờ hôm nay sắp khai màn. Cờ tướng vốn chẳng cần ai giới thiệu, chỉ cần hai người chịu ngồi xuống là tự khắc có chuyện để xem.',
  'Đỏ ngồi nam, Đen ngồi bắc, giữa hai bên là một con sông vẽ bằng mực. Con sông ấy chẳng cản được ai, nhưng ai bước qua nó cũng phải trả một cái giá.',
  'Quân đã bày đủ, trà đã rót đầy, người xem đã đứng vòng trong vòng ngoài. Lão phu chỉ xin nhắc một điều: kẻ nào vội trong cờ tướng, kẻ ấy trả tiền trước.',
  'Lại một ván nữa. Lão phu ngồi xem không biết bao nhiêu ván rồi mà chưa ván nào giống ván nào, và đó chính là lý do lão phu vẫn còn ngồi đây.',
  'Hai bên chắp tay chào nhau. Từ sau cái chào ấy thì hết khách sáo, mỗi quân đặt xuống đều là một câu nói thẳng vào mặt nhau.',
  'Chín đường dọc, mười đường ngang, ba mươi hai quân gỗ. Bấy nhiêu thôi mà cả ngàn năm nay chưa ai đi hết, và hôm nay hai vị đây sẽ thêm vào đó một ván nữa.',
  'Trống chưa điểm mà không khí đã đặc lại. Cờ tướng có cái lạ: chưa đánh đã thấy sát khí, mà đánh xong rồi lại ngồi uống trà với nhau được.',
  'Xin mời hai bên. Lão phu ngồi đây, nhìn từ ngoài vào, thấy gì nói nấy, có bênh ai thì cũng chỉ bênh nước cờ hay thôi.',
]

const OPENING = [
  'Khai cuộc. Mấy nước đầu này nhìn thì nhẹ như không, nhưng chúng quyết định cả hình hài trận đánh về sau, y như móng nhà quyết định ngôi nhà.',
  'Quân vừa rời trại, hai bên còn đang dò ý nhau. Người có nghề chỉ cần nhìn ba nước đầu là đoán ra đối phương định đánh kiểu gì.',
  'Hai bên bày binh bố trận, chưa ai chịu động thủ trước. Ai cũng muốn đối phương lộ ý đồ sớm hơn mình nửa nhịp, mà nửa nhịp ấy là cả một lợi thế.',
  'Đây là đoạn cờ giống hai người đấu kiếm đi vòng quanh nhau. Chưa ai vung tay, nhưng chân đã đứng đúng thế và mắt đã nhắm sẵn chỗ hở.',
  'Cổ nhân dạy: khai cuộc sai một nước, trung cuộc khổ mười nước, tàn cuộc thì chẳng còn gì mà gỡ. Nghe thì nặng lời, đánh nhiều rồi mới thấy đúng.',
  'Cả hai còn giữ thế, chờ bên kia hở sườn. Kẻ nào nôn nóng phá thế trước ở giai đoạn này thường chính là kẻ trả giá đầu tiên.',
  'Cờ mới mở, đường còn rộng thênh thang. Nhưng chư vị để ý mà xem, mỗi nước đi là bàn cờ lại hẹp đi một chút, và đến lúc nào đó thì chỉ còn đúng một lối.',
  'Mấy nước đầu bao giờ cũng lịch sự nhất ván. Quân đi ra, chào hỏi, chiếm chỗ, chưa ai đụng vào ai, mà thế trận thì đã đang được cân đo từng phân.',
  'Hai bên đang dựng khung. Cờ tướng không giống đánh nhau ngoài chợ: người ta chuẩn bị rất lâu rồi mới ra đòn, và đòn hay là đòn đã có chỗ dựa sẵn.',
  'Giai đoạn này ít kịch tính mà lại quan trọng nhất. Nhiều ván thua từ nước thứ tám, chỉ có điều đến nước thứ ba mươi người ta mới nhận ra.',
]

const THINKING = [
  'Hai bên giằng nhau ở giữa bàn, chưa ai chịu lui nửa bước. Thế này căng như dây đàn, chỉ cần một bên buông tay là bên kia ập vào ngay.',
  'Bàn cờ lặng như tờ, mà bên dưới là sóng ngầm. Mỗi quân lúc này đều đang gánh một việc, rút con nào ra là chỗ ấy hở ngay lập tức.',
  'Nước này tính lâu, tức là thế cờ có chỗ hiểm. Người ngồi ngoài thấy bàn cờ đứng yên, chứ trong đầu người đang đi thì đã chạy qua cả chục biến rồi.',
  'Cả hai đang tính chuyện đổi quân. Đổi đúng lúc thì nhẹ gánh, đổi sai lúc thì chính tay mình tháo mất hàng phòng thủ của mình.',
  'Chưa bên nào để lộ sơ hở đáng kể. Hai người này đều biết mình đang ngồi trước ai, nên chẳng ai chịu đi ẩu lấy một nước.',
  'Trung cuộc rồi, và đây mới là chỗ phân cao thấp. Khai cuộc thì học được, tàn cuộc thì tính được, riêng trung cuộc phải có bản lĩnh mới qua nổi.',
  'Thế trận vẫn rộng, đường đi hãy còn nhiều. Ở cục diện này chưa ai dám nói chắc điều gì, mà đó lại chính là lúc cờ hay nhất.',
  'Phần lớn các ván cờ không thua vì đối phương quá giỏi, mà vì mình lỡ tay một nước. Cả hai bên đây đều biết thế, nên cả hai đều đang nín thở.',
  'Quân hai bên cài răng lược vào nhau, gỡ ra không dễ. Đụng vào chỗ này thì rung chỗ kia, thế cờ đang buộc cả hai phải tính rất xa.',
  'Chưa có đòn nào tung ra mà thế trận đã đổi mấy lần. Cờ tướng là vậy, nhiều khi nước quyết định lại là nước trông chẳng có gì.',
  'Cả hai đang chờ đối phương chán trước. Đây là cuộc đấu về sự kiên nhẫn nhiều hơn là về kỹ thuật, và người nóng ruột bao giờ cũng là người thua.',
  'Thế cờ đang ở chỗ mà một nước hay và một nước hỏng nhìn giống hệt nhau. Phải đi thêm dăm nước nữa mới biết ai đã nhìn đúng.',
]

const BALANCED = [
  'Đỏ Đen cân sức từng quân một, chưa ai lấy được gì của ai. Những ván thế này thường không phân định bằng đòn hiểm, mà bằng ai chịu khó hơn ở những nước tưởng như vô thưởng vô phạt.',
  'Hai lưỡi kiếm chạm nhau giữa không trung, không bên nào nhích được. Ai ấn mạnh trước thì bên ấy hở sườn trước, nên cả hai đều đang chờ.',
  'Đổi qua đổi lại mà cán cân vẫn không nghiêng. Hai bên đọc được ý nhau, đòn nào tung ra cũng bị hoá giải gần như tức thì.',
  'Ngang tài ngang sức, ván này còn dài. Cái hay của cờ tướng là thế cân bằng chẳng bao giờ đứng yên lâu, chỉ một nước lơ đãng là mọi thứ đổ về một phía.',
  'Cục diện giằng co, không ai nhỉnh hơn ai. Ván này rồi sẽ do một nước lỡ tay quyết định chứ không phải do ai tính sâu hơn ai.',
  'Đếm quân thì bằng, đếm thế cũng bằng. Đến nước này thì hơn thua nằm ở chỗ ai chịu ngồi lâu hơn với một thế cờ khó chịu.',
  'Cả hai đều chưa có gì trong tay, và cả hai đều biết thế. Đây là lúc người ta hay đi bừa một nước cho đỡ bí, mà đi bừa thì thường là hỏng.',
  'Thế trận cân, nhưng cân kiểu căng chứ không phải cân kiểu yên. Một bên nhấc quân sai chỗ là cái cân ấy lật ngay.',
  'Chưa ai chiếm được ưu thế nào ra hồn. Cờ tướng ở thế này giống hai người vật nhau đứng, nhìn thì bất động mà sức thì đang dồn hết.',
  'Hai bên vẫn ngang nhau sau ngần ấy nước. Điều đó nói lên một chuyện: cả hai đều không cho không ai cái gì.',
]

const ENDGAME = [
  'Đã vào tàn cuộc, quân hai bên thưa hẳn. Từ đây mỗi nước nặng gấp mười lúc đầu, vì không còn quân dự phòng nào để sửa sai nữa.',
  'Bàn cờ trống trải, Tướng hai bên bắt đầu phải tự thân vận động. Ở tàn cuộc, con Tướng không còn là kẻ ngồi trong cung mà thành một quân chiến đấu thực thụ.',
  'Ít quân mà lại khó hơn nhiều quân, đó là cái lạ của cờ tàn. Lúc đông quân sai một nước còn có chỗ đỡ, lúc này sai một nước là xong.',
  'Con tốt qua sông lúc này đáng giá ngàn vàng. Cổ nhân bảo tàn cuộc một tốt bằng nửa con xe, nghe thì lạ mà đánh nhiều rồi mới thấy chẳng sai.',
  'Cờ tàn không che giấu được sơ hở nào. Đến chặng này thì kỹ thuật lộ ra hết, ai học hành tử tế và ai chỉ đánh theo cảm tính đều rõ mồn một.',
  'Quân đã ít, thế cờ đã rõ hình. Bây giờ không còn chỗ cho những nước đi cho có, mỗi nước đều phải có việc của nó.',
  'Đây là đoạn mà người giỏi ăn người khá. Trung cuộc còn cãi được bằng đòn hiểm, tàn cuộc thì chỉ còn cãi bằng sự chính xác.',
  'Bàn cờ rộng ra khi quân ít đi, và cái rộng ấy nguy hiểm. Một con Xe lúc này quét được cả bàn, chẳng mấy ai chặn nổi.',
  'Vào tàn cuộc, thời gian đứng về phía người có thế tốt hơn. Bên kém thế mà cứ đi cầm chừng thì chỉ là kéo dài cái điều đã biết trước.',
  'Đến đoạn này thì mọi thứ đều đếm được. Không còn chỗ cho may rủi, chỉ còn chỗ cho người tính đúng.',
]

const REPETITION = [
  'Hai bên cứ quần nhau mãi mấy nước ấy. Đây là lúc thử thần kinh nhau, ai sốt ruột đổi thế trước thì thường là người chịu thiệt.',
  'Đi tới đi lui, chưa ai chịu đổi. Có khi cả hai đều thấy đổi đi là hỏng, nên đành giữ nguyên và chờ đối phương nghĩ khác.',
  'Cứ lặp thế này thì luật cờ sẽ phải lên tiếng. Bên nào ép liên tục mà không chịu buông sẽ bị xử thua, luật đặt ra là để không ai lấy sự lì lợm thay cho kỹ thuật.',
  'Đôi bên dò nhau, chưa ai dám xuống tay trước. Thế cờ đứng im nhưng đồng hồ thì không, và người nào bí trước sẽ phải là người phá vỡ nó.',
  'Lại đúng cái thế lúc nãy. Trong cờ tướng, lặp lại không phải lúc nào cũng là bí, đôi khi đó là cách nói rằng tôi không sợ, anh đi trước đi.',
  'Vòng đi vòng lại mấy nước này rồi. Ai đó phải chịu đổi hướng thôi, mà đổi hướng thì phải nhận phần rủi ro về mình.',
  'Thế cờ đang giậm chân tại chỗ. Người xem thì sốt ruột, nhưng với hai người đang đánh thì mỗi vòng lặp là một lần thăm dò xem đối phương có nhịn nổi không.',
  'Cứ thế này thì hoặc là hoà, hoặc là có người mất kiên nhẫn. Lão phu đoán vế sau, người ta hiếm khi ngồi yên được lâu như mình tưởng.',
]

const PREDICTION = [
  'Nước vừa rồi mở ra một hướng hoàn toàn mới. Cả cục diện vừa xoay một góc, và những gì tính từ mấy nước trước giờ phải bỏ đi làm lại.',
  'Thế cờ vừa đổi chiều, đổi khá mạnh. Đây là loại nước mà xem lại ván đấu người ta sẽ dừng đúng ở chỗ này và bảo rằng bước ngoặt nằm đây.',
  'Nếu bên kia không gỡ kịp trong một hai nước thì ắt mất quân. Mà gỡ được quân thì lại hở thế, kiểu gì cũng phải trả một cái giá.',
  'Đòn này còn dư âm mấy nước nữa chứ chưa hết ngay. Cái hay của nó không nằm ở chỗ ăn được gì bây giờ, mà ở chỗ nó dựng sẵn cái bẫy cho sau này.',
  'Sắp có một trận đổi quân lớn ngay chỗ này. Khói tan rồi thì cục diện sẽ khác hẳn, và bên nào tính đúng hơn nửa nước sẽ là bên hưởng lợi.',
  'Cục diện vừa nghiêng hẳn về một phía. Từ đây bên trên cơ chỉ cần đi cho chắc, còn bên dưới cơ phải tìm ra thứ gì đó bất ngờ mới có cửa.',
  'Chỉ một sơ hở nhỏ mà cả ván cờ đổi chủ. Cờ tướng tàn nhẫn ở chỗ ấy, công sức ba mươi nước có thể tan trong đúng một nước.',
  'Bên bị ép giờ buộc phải tìm nước phá vây. Ngồi yên chịu trận thì càng lúc càng ngạt, mà phá vây thì phải chịu thí quân, chẳng có đường nào dễ cả.',
  'Cán cân vừa động, và một khi nó đã động thì hiếm khi quay lại. Bên hưởng lợi bây giờ chỉ cần đừng làm gì dại là đủ.',
  'Nước ấy vừa đổi cả câu chuyện. Từ chỗ hai bên cùng tấn công, giờ thành một bên tấn còn một bên phải lo giữ.',
]

const FORESEE_MATE = [
  'Đường sát cục đã mở ra và không lấp lại được nữa. Từ giây phút này mọi nước đi chỉ còn là thủ tục, kết quả đã nằm sẵn trên bàn.',
  'Đã thấy nước chiếu bí, ván cờ coi như đã định. Bên bị dồn vẫn đi được, nhưng đi hướng nào cũng chỉ là chọn cách thua cho đỡ khó coi.',
  'Tướng chạy hướng nào cũng vướng thiên la địa võng. Đây chính là cái đẹp tàn nhẫn của cờ tướng, khi lưới đã giăng đủ thì không có phép màu nào cả.',
  'Từ đây tới hết ván, mọi nước đã an bài. Người tính ra sát cục này hẳn đã nhìn thấy nó từ mấy nước trước, rồi cứ thế lùa đối phương vào đúng chỗ.',
  'Lưới đã khép. Bên bị vây có thể còn chống thêm vài nhịp, nhưng mỗi nhịp ấy chỉ làm cái kết đến chậm hơn chứ không đổi được nó.',
  'Sát cục đã hiện hình rõ ràng. Chư vị để ý mà xem, mấy quân tưởng như đứng chơi từ nãy giờ hoá ra đều đã đứng đúng chỗ của chúng.',
]

const DRAW = [
  'Hoà cờ. Suốt cả ván không ai cho ai một khe hở nào, và một kết quả hoà ở đây là hoàn toàn xứng đáng cho cả hai.',
  'Bất phân thắng bại, đúng là kỳ phùng địch thủ. Có những ván mà hoà lại hay hơn thắng, vì nó cho thấy hai bên đọc được nhau đến từng nước.',
  'Hai bên cùng lui, ván này chia đôi. Không ai thắng mà cũng chẳng ai đáng thua, thế cờ đã cạn đường cho cả hai phía.',
  'Ván cờ khép lại ở thế cân bằng. Đôi khi hoà mới là kết quả trung thực nhất, còn ép cho ra thắng thua bằng mọi giá thì thường là hỏng cả ván.',
  'Hoà. Nghe thì nhạt, nhưng ngồi xem cả ván rồi mới thấy giữ được thế cân đến tận đây là công sức của cả hai bên.',
  'Không ai hạ được ai. Cờ tướng có cái công bằng của nó, khi hai bên cùng không sai thì chẳng bên nào được thưởng.',
]

const STORY = [
  'Cờ tướng có từ đời Đường, tới đời Tống đã thành hình gần như bây giờ. Ngàn năm trôi qua, bao nhiêu thứ đổi thay, riêng cái bàn cờ này thì gần như y nguyên.',
  'Quất Trung Bí, Mai Hoa Phổ, mấy quyển cổ phổ ấy ngày xưa người ta chép tay truyền nhau. Có người đi bộ mấy trăm dặm chỉ để mượn về chép lại một quyển.',
  'Lão phu từng thấy một quán cờ đầu ngõ, mặt bàn gỗ mòn lõm hẳn xuống. Bao nhiêu ván đã đi qua chỗ đó, bao nhiêu người thắng thua rồi lại về nhà ăn cơm như thường.',
  'Ở quán cờ thì kẻ đứng xem bao giờ cũng nói to hơn người đang đánh. Mà lạ một cái, bảo họ ngồi xuống đánh thử thì ai cũng bận.',
  'Người xưa dạy: cờ tàn học trước, khai cuộc học sau. Nghe thì ngược đời, nhưng ai học đúng thứ tự ấy đều tiến nhanh hơn hẳn.',
  'Con sông giữa bàn tên là Sở Hà Hán Giới, lấy từ chuyện Hạng Vũ với Lưu Bang chia đôi thiên hạ. Mỗi lần một con tốt bước qua đó là một lần nhắc lại tích cũ.',
  'Tướng chẳng được rời cung, Sĩ chẳng được rời Tướng, Tượng chẳng được qua sông. Người đặt ra luật này hẳn muốn nói với ta điều gì đó về chữ phận.',
  'Con tốt qua sông thì hết đường lui, chỉ được đi tới. Cả bàn cờ có mỗi nó là không được hối hận, mà cũng chính nó nhiều khi lại quyết định cả ván.',
  'Pháo phải có ngòi mới bắn được, không ngòi thì nó chỉ là một khối gỗ. Kẻ mạnh nào cũng cần một chỗ dựa, chuyện ấy đâu riêng gì cờ.',
  'Mã sợ chân, Tượng sợ mắt, Xe sợ bị chặn đường. Quân nào cũng có tử huyệt, vấn đề chỉ là ai nhìn ra trước và ai chịu khó tìm.',
  'Ngày trước người ta đánh cờ ngoài vỉa hè, che cái ô, uống trà đá, cãi nhau ỏm tỏi. Bây giờ đánh trên màn hình, sạch sẽ hơn nhiều mà lão phu vẫn thấy nhớ cái ồn ào ấy.',
  'Có những ván đánh ba ngày chưa xong, hai bên cứ để nguyên bàn đó rồi mai đánh tiếp. Thời ấy chẳng ai vội, và cờ vì thế cũng sâu hơn.',
  'Đánh cờ mà nóng là thua, xưa nay vẫn thế. Lão phu học được điều đó sau chừng một ngàn ván, mà thú thật là thỉnh thoảng vẫn quên.',
  'Xem một người đánh cờ là đọc được tính người ấy. Ai tham thì thấy quân là ăn, ai nhát thì thủ mãi không dám ra, ai bản lĩnh thì biết lúc nào nên thí.',
  'Kẻ mới học hay tiếc quân, mất con nào cũng xót. Đánh lâu rồi mới hiểu có lúc phải cho đi mới lấy được, và đó là bài học đắt nhất của cờ tướng.',
  'Trong quán cờ chẳng ai hỏi nhau làm nghề gì, xuất thân ra sao. Ngồi xuống đối diện nhau là ngang hàng, chỉ có nước cờ mới nói lên được anh là ai.',
  'Có kỳ thủ cả đời chỉ luyện một thế pháo đầu, ai cũng biết ông ta sẽ đi gì mà vẫn không cản nổi. Đánh cờ đến mức ấy thì đâu còn là kỹ thuật nữa.',
  'Bàn cờ chỉ có chín đường dọc mười đường ngang, vậy mà cả đời người đi không hết. Càng đánh càng thấy mình biết ít, đó mới là chỗ nó giữ chân người ta.',
  'Lão phu quen một ông cụ bán nước chè, ngày nào cũng bày bàn cờ ra trước quán. Ông ấy bảo bán nước chỉ là cái cớ, ngồi đó là để chờ người biết đánh.',
  'Có cái lệ ở quán cờ: người thua nhường ghế, người thắng ngồi tiếp. Cứ thế đến tối, cái ghế ấy đi qua tay hàng chục người.',
  'Người ta hay nói cờ tướng là binh pháp thu nhỏ. Lão phu thì thấy nó giống cuộc đời hơn, vì quân đã đặt xuống rồi thì không nhấc lên lại được nữa.',
  'Xưa có ông quan về hưu, cả ngày chỉ ngồi bày lại những ván mình đã thua. Người nhà bảo ông gàn, mà ba năm sau thì cả vùng không ai đánh lại ông.',
  'Nhiều người học cờ bằng cách đứng sau lưng xem người khác đánh, mấy trăm ván không nói một câu. Lối học ấy chậm, nhưng cái gì học được thì nhớ rất lâu.',
  'Cờ tướng chẳng có yếu tố may rủi nào cả, không quân bài úp, không con xúc xắc. Thắng là do mình, thua cũng là do mình, sòng phẳng đến mức đôi khi phũ phàng.',
]

/**
 * One side stands clearly better.
 *
 * `{a}` is the side ahead, `{b}` the side behind. Written once and generated
 * for both colours, so the two can never drift apart.
 */
const LEADER = [
  'Bên {a} đang chiếm thượng phong rõ rệt. Quân {a} đứng chỗ tốt hơn, đường đi thoáng hơn, còn {b} thì phải lo giữ chứ chưa tính được chuyện tấn.',
  'Cán cân nghiêng hẳn về phía {a}. {b} bây giờ mỗi nước đều phải cân nhắc rất lâu, vì sai thêm một nước nữa là hết đường gỡ.',
  '{a} hơn quân, lại giữ được thế chủ động. Trong cờ tướng, hơn quân mà còn hơn cả thế thì thường là chuyện đã an bài, chỉ còn xem kết thúc nhanh hay chậm.',
  'Quân {a} đang ép sát, {b} co cụm quanh cung. Phòng tuyến bên {b} đã rạn vài chỗ, mà chỗ nào cũng cần quân giữ trong khi quân thì chỉ có bấy nhiêu.',
  '{a} nắm thế chủ động hoàn toàn. {b} vẫn còn chống được, nhưng chống mãi mà không phản công thì trước sau cũng vỡ.',
  'Thế cờ bên {b} hỏng ở nhiều chỗ cùng một lúc. Đây là tình huống khó nhất trong cờ tướng, cứu được chỗ này thì hở chỗ kia.',
  '{a} đang đi trước một nhịp trong mọi tính toán. Cái nhịp ấy nghe thì nhỏ, nhưng nó khiến {b} lúc nào cũng phải đi theo chứ không được đi trước.',
  'Nhìn cục diện thì {a} thoải mái hơn hẳn. {b} chưa thua, nhưng {b} đã hết những nước dễ, từ đây mỗi nước đều phải là nước hay.',
]

/** The result. `{w}` won, `{l}` lost. Generated for both colours, same reason. */
const VICTORY = [
  'Bên {w} thắng ván này. {l} đã chống đến nước cuối cùng nhưng thế cờ không cho phép thêm nữa, và {w} kết thúc rất dứt khoát.',
  'Ván cờ khép lại, phần thắng thuộc về {w}. Một trận đáng xem từ đầu tới cuối, lão phu xin cảm ơn cả hai bên đã cho một ván ra ván.',
  '{l} buông kiếm, {w} thắng. Nhìn lại cả ván thì {w} đã giành thế chủ động từ khá sớm và không bao giờ trả lại nữa.',
  '{w} hạ được Tướng {l}, ván đấu kết thúc. Cờ tướng là vậy, hơn kém bao nhiêu quân đi nữa thì rốt cuộc cũng chỉ để đi tới đúng một nước cuối này.',
  'Xong. {w} thắng, và thắng ở chỗ {l} chỉ hở đúng một lần, cả ván có mỗi một sơ suất ấy thôi mà đủ.',
  'Ván này thuộc về {w}. {l} đánh không tệ, nhưng trong cờ tướng đánh không tệ thì chưa đủ, phải không sai mới đủ.',
]

function swap(templates: string[], from: Record<string, string>): string[] {
  return templates.map((t) =>
    Object.entries(from).reduce((s, [token, word]) => s.replaceAll(`{${token}}`, word), t)
  )
}

/** Delivery per situation. Rotated line by line so a pool is not read in one register. */
const TONES: Record<Situation, Tone[]> = {
  greeting: [
    ['[trang trọng]', '[ấm áp]'],
    ['[ấm áp]', '[trầm ngâm]'],
    ['[dõng dạc]', '[nhấn mạnh]'],
    ['[hào hùng]', '[nghiêm giọng]'],
  ],
  opening: [
    ['[điềm tĩnh]', '[nhấn mạnh]'],
    ['[trầm ngâm]', '[tò mò]'],
    ['[dõng dạc]', '[thì thầm]'],
    ['[trang trọng]', '[cảnh báo]'],
  ],
  thinking: [
    ['[căng thẳng]', '[nhấn mạnh]'],
    ['[thì thầm]', '[nghiêm giọng]'],
    ['[trầm ngâm]', '[nhấn mạnh]'],
    ['[điềm tĩnh]', '[ấm áp]'],
  ],
  redAhead: [
    ['[dõng dạc]', '[trầm giọng]'],
    ['[nhấn mạnh]', '[căng thẳng]'],
    ['[hào hứng]', '[lạnh lùng]'],
    ['[nghiêm giọng]', '[nhấn mạnh]'],
  ],
  blackAhead: [
    ['[dõng dạc]', '[trầm giọng]'],
    ['[nhấn mạnh]', '[căng thẳng]'],
    ['[hào hứng]', '[lạnh lùng]'],
    ['[nghiêm giọng]', '[nhấn mạnh]'],
  ],
  balanced: [
    ['[điềm tĩnh]', '[trầm ngâm]'],
    ['[trang trọng]', '[căng thẳng]'],
    ['[trầm ngâm]', '[nhấn mạnh]'],
    ['[thì thầm]', '[nghiêm giọng]'],
  ],
  endgame: [
    ['[trầm giọng]', '[nhấn mạnh]'],
    ['[chậm rãi]', '[dõng dạc]'],
    ['[trầm ngâm]', '[lạnh lùng]'],
    ['[nghiêm giọng]', '[nhấn mạnh]'],
  ],
  repetition: [
    ['[cười khẩy]', '[nhấn mạnh]'],
    ['[trầm ngâm]', '[điềm tĩnh]'],
    ['[nghiêm giọng]', '[cảnh báo]'],
    ['[thì thầm]', '[căng thẳng]'],
  ],
  prediction: [
    ['[hào hứng]', '[nhấn mạnh]'],
    ['[ngạc nhiên]', '[trầm ngâm]'],
    ['[cảnh báo]', '[nghiêm giọng]'],
    ['[căng thẳng]', '[dõng dạc]'],
  ],
  foreseeMate: [
    ['[dõng dạc]', '[lạnh lùng]'],
    ['[lạnh lùng]', '[trầm giọng]'],
    ['[hào hùng]', '[trang trọng]'],
    ['[trang trọng]', '[chậm rãi]'],
  ],
  redWin: [
    ['[hào hùng]', '[dõng dạc]'],
    ['[trang trọng]', '[ấm áp]'],
    ['[dõng dạc]', '[trầm ngâm]'],
  ],
  blackWin: [
    ['[hào hùng]', '[dõng dạc]'],
    ['[trang trọng]', '[ấm áp]'],
    ['[dõng dạc]', '[trầm ngâm]'],
  ],
  draw: [
    ['[trang trọng]', '[nhấn mạnh]'],
    ['[chậm rãi]', '[điềm tĩnh]'],
    ['[điềm tĩnh]', '[ấm áp]'],
  ],
  story: [
    ['[kể chuyện]', '[trầm ngâm]'],
    ['[trầm ngâm]', '[nhấn mạnh]'],
    ['[trang trọng]', '[ấm áp]'],
    ['[kể chuyện]', '[ngạc nhiên]'],
    ['[điềm tĩnh]', '[nhấn mạnh]'],
    ['[cười nhẹ]', '[cười khẩy]'],
  ],
}

/** Lines per situation, with their audio ids filled in. */
export const LINES: Record<Situation, Line[]> = {
  greeting: build('hello', GREETING, TONES.greeting),
  opening: build('open', OPENING, TONES.opening),
  thinking: build('think', THINKING, TONES.thinking),
  redAhead: build('red', swap(LEADER, { a: 'Đỏ', b: 'Đen' }), TONES.redAhead),
  blackAhead: build('black', swap(LEADER, { a: 'Đen', b: 'Đỏ' }), TONES.blackAhead),
  balanced: build('bal', BALANCED, TONES.balanced),
  endgame: build('end', ENDGAME, TONES.endgame),
  repetition: build('rep', REPETITION, TONES.repetition),
  prediction: build('pred', PREDICTION, TONES.prediction),
  foreseeMate: build('fmate', FORESEE_MATE, TONES.foreseeMate),
  redWin: build('rwin', swap(VICTORY, { w: 'Đỏ', l: 'Đen' }), TONES.redWin),
  blackWin: build('bwin', swap(VICTORY, { w: 'Đen', l: 'Đỏ' }), TONES.blackWin),
  draw: build('draw', DRAW, TONES.draw),
  story: build('story', STORY, TONES.story),
}

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
