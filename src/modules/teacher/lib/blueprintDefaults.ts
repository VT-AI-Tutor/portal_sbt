/**
 * MA TRẬN MẪU — điền sẵn ngay khi giáo viên chọn xong môn và khối.
 *
 * Bảng trống là một câu hỏi bỏ ngỏ: "cho chủ đề nào mấy câu?" — giáo viên phải
 * tự nghĩ ra phân bổ trước khi làm được gì. Điền sẵn một ma trận hợp lý thì
 * bấm Sinh là ra đề luôn, còn ai muốn khác thì sửa số trong ô, đúng như trước.
 *
 * Mẫu bám hai thứ có thật: **tỷ lệ mức nhận thức quen thuộc của đề kiểm tra
 * Việt Nam** và **số câu kho đang thật sự có**. Không ô nào vượt số câu kho có,
 * để bấm Sinh là chạy được ngay chứ không phải nhờ trợ lý AI bù từ đầu.
 */
import type {
  BlueprintCatalog,
  BlueprintCell,
  CognitiveLevelCode,
} from "@/modules/teacher/api/teacherBlueprintApi";
import type { PaperKind } from "@/core/lib/paperKind";

/**
 * Số câu mặc định của ma trận mẫu. Đề kiểm tra dài hơn phiếu bài tập — phiếu
 * là bài về nhà một buổi, đề là một tiết kiểm tra.
 */
export const DEFAULT_TOTAL: Record<PaperKind, number> = {
  exam: 20,
  worksheet: 10,
};

/**
 * Tỷ lệ theo mức nhận thức — khuôn 40/30/20/10 quen thuộc của ma trận đề.
 * Khớp `SuggestBlueprintForClass::LEVEL_SHARE` phía máy chủ.
 */
const LEVEL_SHARE: Record<string, number> = {
  biet: 0.4,
  hieu: 0.3,
  vandung: 0.2,
  vandungcao: 0.1,
};

interface Slot {
  contentCode: string;
  levelCode: string;
  have: number;
  take: number;
}

/**
 * Dựng ma trận mẫu từ bảng chủ đề × mức của một môn + khối.
 *
 * @param targetTotal tổng số câu mong muốn; kết quả có thể ÍT hơn nếu kho không đủ.
 */
export function buildDefaultMatrix(
  catalog: BlueprintCatalog,
  targetTotal: number,
): BlueprintCell[] {
  // Chủ đề kho trống không vào mẫu: đưa vào thì đề mặc định toàn câu do trợ lý
  // AI sinh, chậm và tốn, trong khi giáo viên chưa hề yêu cầu điều đó. Muốn thì
  // họ tự gõ số vào ô — bảng vẫn bày đủ mọi chủ đề.
  const topics = catalog.topics.filter((t) => t.total > 0);
  if (topics.length === 0 || targetTotal <= 0) return [];

  const slots: Slot[] = [];
  for (const level of catalog.levels) {
    const share = LEVEL_SHARE[level.code] ?? 0;
    const quota = Math.round(targetTotal * share);
    if (quota <= 0) continue;

    const available = topics
      .map((t) => ({
        contentCode: t.content_code,
        levelCode: level.code as string,
        have: t.counts[level.code] ?? 0,
        take: 0,
      }))
      .filter((s) => s.have > 0);

    slots.push(...spread(available, quota));
  }

  // Mức nào kho cạn thì phần của mức đó rơi rụng — bù lại từ chỗ còn dư, ưu
  // tiên mức thấp (kho thường dày nhất ở Nhận biết) để đề vẫn đủ số câu.
  topUp(slots, targetTotal);

  return slots
    .filter((s) => s.take > 0)
    .map((s) => ({
      content_code: s.contentCode,
      level_code: s.levelCode as CognitiveLevelCode,
      count: s.take,
    }));
}

/**
 * Chia `quota` câu cho các chủ đề của MỘT mức, tỷ lệ theo số câu kho có và
 * không vượt quá số đó.
 *
 * Chia theo tỷ lệ tồn kho chứ không chia đều: chủ đề kho có 20 câu và chủ đề
 * kho có 2 câu mà nhận cùng số lượng thì cái sau lập tức phải nhờ trợ lý AI,
 * còn cái trước bỏ phí câu đã có sẵn.
 */
function spread(slots: Slot[], quota: number): Slot[] {
  const pool = slots.reduce((sum, s) => sum + s.have, 0);
  if (pool === 0) return [];

  const want = Math.min(quota, pool);
  const shares = slots.map((s) => (s.have / pool) * want);

  // Phần nguyên trước, rồi rải phần lẻ theo dư lớn nhất — chia kiểu này thì
  // tổng luôn khớp `want`, không hụt không thừa.
  slots.forEach((s, i) => {
    s.take = Math.min(s.have, Math.floor(shares[i]));
  });

  let assigned = slots.reduce((sum, s) => sum + s.take, 0);
  const byRemainder = slots
    .map((s, i) => ({ slot: s, remainder: shares[i] - Math.floor(shares[i]) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (const { slot } of byRemainder) {
    if (assigned >= want) break;
    if (slot.take < slot.have) {
      slot.take += 1;
      assigned += 1;
    }
  }

  return slots;
}

/**
 * Bù cho đủ `targetTotal` từ chỗ kho còn dư — vẫn CHIA THEO TỶ LỆ chỗ dư, không
 * dồn hết vào ô gặp trước.
 *
 * Dồn vào ô đầu thì công chia theo tỷ lệ ở trên hoá vô nghĩa: môn nào kho chỉ
 * dày ở một mức là cả đề mặc định đổ dồn về một ô duy nhất.
 *
 * Bù từng câu một chứ không tính tỷ lệ hàng loạt: mỗi câu về ô còn dư NHIỀU
 * NHẤT, nên phân bổ luôn bám tồn kho và không bao giờ vượt trần — đọc thẳng
 * hơn hẳn một vòng chia tỷ lệ có xử lý phần lẻ, mà số câu cần bù thì nhỏ.
 */
function topUp(slots: Slot[], targetTotal: number): void {
  let assigned = slots.reduce((sum, s) => sum + s.take, 0);

  while (assigned < targetTotal) {
    const widest = slots
      .filter((s) => s.take < s.have)
      .sort((a, b) => b.have - b.take - (a.have - a.take))[0];
    if (!widest) return; // kho hết chỗ — mẫu ngắn hơn mong muốn, đúng thực tế
    widest.take += 1;
    assigned += 1;
  }
}
