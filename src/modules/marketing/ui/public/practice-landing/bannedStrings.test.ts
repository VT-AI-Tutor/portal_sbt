import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 2026-07-18 practice-landing §2 cấm "SGK" / "sách giáo khoa" / "NXB".
 *
 * QUYẾT ĐỊNH OWNER 2026-07-27 (đè §2): nới "SGK" và "sách giáo khoa" — bố cục
 * landing dựng theo trang tham khảo hcmc.dehoctot.vn, copy hero đã duyệt dùng
 * chip "Bám sát Chương trình & SGK" (nói về khung Chương trình GDPT 2018, không
 * phải tên bộ sách cụ thể).
 *
 * "NXB" VẪN CẤM: không nhắc tên nhà xuất bản trong module này. Bìa bài tập in
 * tên thương hiệu ("Để học tốt"), khác BookCover của LandingPage.tsx (landing
 * danh mục — nằm ngoài phạm vi quét của guard này).
 */
const BANNED = [/NXB/];
const ROOT = join(__dirname);

function allSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return allSourceFiles(full);
    return /\.(ts|tsx|css)$/.test(name) && !name.includes(".test.")
      ? [full]
      : [];
  });
}

describe("practice-landing không chứa chuỗi cấm", () => {
  it("không file nào nhắc NXB", () => {
    for (const file of allSourceFiles(ROOT)) {
      const content = readFileSync(file, "utf8");
      for (const pattern of BANNED) {
        expect(content, `${file} chứa chuỗi cấm ${pattern}`).not.toMatch(
          pattern,
        );
      }
    }
  });
});
