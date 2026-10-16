/**
 * Vùng CẮT phải chừa chỗ cho hiệu ứng của con (Owner 9/8).
 *
 * Lỗi gốc, đo trên `95131076/bai2` câu 1: thẻ chọn mang `scale-[1.02]` nên phình
 * đều bốn phía, nhưng nó nằm sát mép trái (L0) của một khung `overflow-x-auto`
 * KHÔNG có padding ngang. Trình duyệt cắt mọi thứ vẽ ra ngoài padding-box của
 * vùng cuộn → mất đúng nét viền trái. Cùng cơ chế với mọi `ring`/`shadow`/
 * `scale` khác, nên chữa ở KHUNG (chừa chỗ) chứ không chữa ở từng hiệu ứng.
 *
 * Guard này đọc THẲNG mã nguồn thay vì render: lỗi nằm ở chuỗi class tĩnh, mà
 * jsdom không layout nên có render cũng không đo được chỗ bị xén. Đổi lại nó
 * chặn được cả những player chưa có bài test riêng.
 *
 * Muốn thêm một vùng cuộn mới thì hoặc cho nó padding, hoặc ghi vào
 * {@link ALLOWLIST} kèm lý do.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PLAYERS_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Vùng cuộn KHÔNG cần padding ngang, kèm lý do. Đừng nới danh sách này chỉ để
 * test xanh — mỗi dòng phải trả lời được "tại sao con ở đây không bị xén".
 */
const ALLOWLIST: Record<string, string> = {
  // Khay công cụ đã có `p-2 md:p-3` (8–12px) trong cùng chuỗi class; ô màu 24px
  // phóng 110% chỉ cần 1,4px.
  "FreeDrawPlayer.tsx": "khay đã có p-2/p-3",
  // Hiệu ứng phóng duy nhất trong hai file này nằm ở NÚT TỰ CHẤM, render SAU khi
  // thẻ cuộn đã đóng — không có gì bên trong vùng cuộn để bị xén. Guard soi theo
  // file nên không tự thấy điều đó.
  "TableFillPlayer.tsx": "scale ở nút tự chấm, ngoài vùng cuộn",
  "TrueFalseTablePlayer.tsx": "scale ở nút tự chấm, ngoài vùng cuộn",
};

/** Bỏ chú thích trước khi soi — ghi chú có nhắc tên lớp cũng bị tính là khai. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[^\n]*?\/\/[^\n]*$/gm, "");
}

/**
 * Chỉ đòi padding ở file CÓ hiệu ứng phóng. Vùng cuộn chứa bảng hay chữ thuần
 * không vẽ gì ra ngoài border-box nên không có gì để xén — bắt nó chừa chỗ chỉ
 * là thay đổi diện mạo vô cớ.
 */
function hasScaleEffect(source: string): boolean {
  return /scale-\[|scale-1\d\d|scale:\s*1\./.test(source);
}

/** Tách từng chuỗi class có khai cắt (overflow-x-auto / overflow-auto). */
function scrollClassStrings(source: string): string[] {
  const found: string[] = [];
  // Chuỗi trong nháy kép, nháy đơn hoặc backtick — đủ cho cách viết className
  // hiện có; template lồng biểu thức vẫn khớp phần chữ tĩnh.
  for (const match of source.matchAll(/["'`]([^"'`]*overflow-(?:x-)?auto[^"'`]*)["'`]/g)) {
    found.push(match[1]);
  }
  return found;
}

function hasHorizontalPadding(classes: string): boolean {
  return /(^|\s)(px-|p-|pl-)/.test(classes);
}

describe("vùng cắt chừa chỗ cho hiệu ứng của con", () => {
  const files = readdirSync(PLAYERS_DIR).filter(
    (name) => name.endsWith("Player.tsx") && !name.includes(".test."),
  );

  it("có quét được thư mục player (guard không được rỗng)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("vùng cuộn ngang ở player CÓ hiệu ứng phóng đều chừa padding ngang", () => {
    const thieu: string[] = [];
    for (const file of files) {
      if (file in ALLOWLIST) continue;
      const source = stripComments(readFileSync(join(PLAYERS_DIR, file), "utf8"));
      if (!hasScaleEffect(source)) continue;
      for (const classes of scrollClassStrings(source)) {
        if (!hasHorizontalPadding(classes)) thieu.push(`${file}: "${classes.trim()}"`);
      }
    }
    expect(thieu).toEqual([]);
  });
});
