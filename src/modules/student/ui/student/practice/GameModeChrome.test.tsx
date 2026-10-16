// @vitest-environment jsdom
/**
 * QA 30/7: console error "Encountered two children with the same key" lặp mỗi
 * lần chuyển câu ở chế độ Chơi game. Nguồn: hai motion.div ANH EM trong header
 * của GameModeChrome dùng key là hai CON SỐ trần — `combo.streak` và `xp` —
 * nên va nhau bất cứ khi nào hai số trùng (điển hình: đầu phiên streak=0 và
 * xp=0; hoặc streak=15 khi mới đúng 1 câu → xp=15). Key phải mang tiền tố
 * phân biệt theo vai trò. Gallery /dev/players không lỗi vì không dùng chrome.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { GameModeChrome } from "./GameModeChrome";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderChrome(streak: number, correctCount: number) {
  return render(
    <GameModeChrome
      combo={{ streak, best: streak }}
      correctCount={correctCount}
      flashResult={null}
      milestone={null}
    >
      <div>câu hỏi</div>
    </GameModeChrome>,
  );
}

describe("GameModeChrome — key trùng giữa combo và XP (QA 30/7)", () => {
  it("đầu phiên (streak=0, xp=0) không được log duplicate-key", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderChrome(0, 0);
    const dupKey = errorSpy.mock.calls.filter((args) =>
      String(args[0]).includes("two children with the same key"),
    );
    expect(dupKey).toEqual([]);
  });

  it("streak=15 với 1 câu đúng (xp=15) cũng không va key", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderChrome(15, 1);
    const dupKey = errorSpy.mock.calls.filter((args) =>
      String(args[0]).includes("two children with the same key"),
    );
    expect(dupKey).toEqual([]);
  });
});
