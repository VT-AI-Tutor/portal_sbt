/**
 * Đáp án hotspot dạng ĐẾM (spec §9.1): `correctAnswer: {count: N}` — đúng khi
 * chọn ĐỦ N vùng, bất kể vùng nào ("Tô màu 2 bông hoa"). Trả về `count` khi là
 * số nguyên dương, ngược lại `undefined` — count không hợp lệ (0, âm, lẻ 2.5)
 * phải rơi về không-chấm-được (record-only), không được thành câu "chấm được
 * nhưng bất khả thi" (`answer.length === 2.5` không bao giờ đúng).
 */
export function hotspotAnswerCount(correctAnswer: unknown): number | undefined {
  if (correctAnswer == null || typeof correctAnswer !== "object" || Array.isArray(correctAnswer)) {
    return undefined;
  }
  const count = Number((correctAnswer as { count?: unknown }).count);
  return Number.isInteger(count) && count > 0 ? count : undefined;
}
