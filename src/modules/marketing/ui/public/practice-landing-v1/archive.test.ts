import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { trackLandingEvent } from "./analytics";

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

describe("bản lưu trữ landing v1", () => {
  it("độc lập với module landing chuẩn — không import chéo", () => {
    // Cả bản v1 lẫn bản chuẩn đều được phép đổi tự do. Điều đó chỉ đúng khi
    // v1 không import gì từ ../practice-landing: dính một import là sửa bản
    // chuẩn sẽ âm thầm đổi cả ảnh chụp lịch sử này.
    const offenders = allSourceFiles(ROOT).filter((file) =>
      /^\s*import[^;]*from\s+["'][^"']*practice-landing\//m.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders, `import chéo trong: ${offenders.join(", ")}`).toEqual([]);
  });

  it("không nhắc NXB (giữ nguyên rào chắn của spec §2)", () => {
    for (const file of allSourceFiles(ROOT)) {
      expect(readFileSync(file, "utf8"), `${file} nhắc NXB`).not.toMatch(/NXB/);
    }
  });

  it("analytics là no-op — không làm nhiễu số liệu của landing chính", () => {
    const gtag = vi.fn();
    vi.stubGlobal("gtag", gtag);
    trackLandingEvent("landing_view");
    trackLandingEvent("signup_from_landing");
    expect(gtag).not.toHaveBeenCalled();
  });
});

afterEach(() => vi.unstubAllGlobals());
