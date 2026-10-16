import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FALLBACK_SUBJECT_ICON, getSubjectIcon } from "./subjectIcons";

// Suite chạy ở HAI layout: monorepo (core nằm ở packages/core, 8 tầng lên gốc)
// và snapshot bàn giao phẳng (core nằm ở src/core, 5 tầng lên src).
const subjectDisplayCandidate = [
  join(
    __dirname,
    "../../../../../../../../packages/core/src/reference/subjectDisplay.ts",
  ),
  join(__dirname, "../../../../../core/reference/subjectDisplay.ts"),
].find((candidate) => existsSync(candidate));

if (!subjectDisplayCandidate) {
  throw new Error("không tìm thấy core/reference/subjectDisplay.ts ở cả hai layout");
}
const SUBJECT_DISPLAY_FILE: string = subjectDisplayCandidate;

/** Mã môn trong SUBJECT_DISPLAY — dạng `"ma-mon": D(...)`. */
function declaredSubjectCodes(): string[] {
  const src = readFileSync(SUBJECT_DISPLAY_FILE, "utf8");
  return [...src.matchAll(/^\s*"([a-z0-9-]+)":\s*D\(/gm)].map((m) => m[1]);
}

describe("getSubjectIcon", () => {
  it("phủ hết mã môn khai báo trong core/reference/subjectDisplay.ts", () => {
    const codes = declaredSubjectCodes();
    // Guard tự nó phải có dữ liệu — regex hỏng thì test không được im lặng xanh.
    expect(codes.length).toBeGreaterThanOrEqual(24);

    const missing = codes.filter(
      (code) => getSubjectIcon(code) === FALLBACK_SUBJECT_ICON,
    );
    expect(missing, `thiếu icon cho môn: ${missing.join(", ")}`).toEqual([]);
  });

  it("mã lạ rơi về icon fallback", () => {
    expect(getSubjectIcon("mon-hoc-moi-tu-lcms")).toBe(FALLBACK_SUBJECT_ICON);
  });
});
