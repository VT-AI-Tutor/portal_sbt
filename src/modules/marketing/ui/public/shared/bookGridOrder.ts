/**
 * Thứ tự lưới bìa sách: khối → môn → TẬP → tên. Nấc tập phải đứng TRƯỚC tên vì
 * so theo tên thì "Tập hai" < "Tập một" (h < m) → tập 2 lên trước.
 */
export interface BookGridOrderKey {
  level: string;
  subject: string;
  tap: number | null;
  title: string;
}

/** Chỉ một|hai|ba: sách bài tập không có tập 4 trở lên, thêm nữa chỉ tăng nguy
 *  cơ khớp nhầm tên môn (vd "Vở bài tập Tư tưởng…" → "tập tư"). */
const VOLUME_BY_WORD: Record<string, number> = { một: 1, hai: 2, ba: 3 };

/**
 * Số tập đọc từ tên sách — chỉ là **phương án dự phòng** khi API không cho
 * biết số tập (`tap`/`bookNumber` trống hoặc 0).
 *
 * Lấy lần khớp CUỐI: "Vở Tập viết 1 - Tập một" có hai chữ "tập", chỉ chữ sau
 * mới là số tập. Token không phải số cũng không phải một|hai|ba thì bỏ qua, nên
 * "Vở bài tập Toán 4" (→ "tập toán") không bị hiểu nhầm là có tập.
 */
export function volumeFromTitle(title: string): number | null {
  let found: number | null = null;
  for (const match of title.toLowerCase().matchAll(/tập\s+(\S+)/g)) {
    const token = match[1].replace(/[^\p{L}\p{N}]/gu, "");
    const value = /^\d+$/.test(token)
      ? Number(token)
      : VOLUME_BY_WORD[token];
    if (value) found = value;
  }
  return found;
}

/** `tap` = 0 nghĩa là sách không chia tập, không phải "tập 0". */
function volumeOf(book: BookGridOrderKey): number | null {
  return book.tap || volumeFromTitle(book.title);
}

export function compareBooksForGrid(
  a: BookGridOrderKey,
  b: BookGridOrderKey,
): number {
  if (a.level !== b.level)
    return a.level.localeCompare(b.level, "vi", { numeric: true });
  if (a.subject !== b.subject) return a.subject.localeCompare(b.subject, "vi");

  const volumeA = volumeOf(a);
  const volumeB = volumeOf(b);
  if (volumeA !== volumeB) {
    // Sách không chia tập xếp sau các tập đã đánh số của cùng môn.
    if (volumeA == null) return 1;
    if (volumeB == null) return -1;
    return volumeA - volumeB;
  }
  return a.title.localeCompare(b.title, "vi");
}
