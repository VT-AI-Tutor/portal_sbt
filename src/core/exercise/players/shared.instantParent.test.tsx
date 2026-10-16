// @vitest-environment jsdom
/**
 * CHẤM KÍN (gradeMode "parent" — thi đấu / bài GV giao, Owner 31/7 phương án B):
 * useInstantGrading KHÔNG được lộ verdict per-element (reveal → màu đúng/sai)
 * khi player chạy dưới GradeModeContext mode="parent", nhưng đáp án vẫn phải
 * được đẩy lên cha (report → onAnswerChange) để autosave/submit chấm ngầm.
 * Bug gốc: `active = instantFeedback && !recordOnly` bỏ qua mode → mọi surface
 * parent-graded (Arena, Practice, sealed SubmissionRunner) lộ đỏ/xanh tức thì.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GradeModeContext,
  useInstantGrading,
  type Verdict,
} from "./shared";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function Probe({
  onReport,
}: {
  onReport: (answer: unknown, verdict: Verdict) => void;
}) {
  const instant = useInstantGrading({
    elementIds: ["a"],
    instantFeedback: true,
    recordOnly: false,
    buildAnswer: () => ["a"],
    report: onReport,
  });
  return (
    <div>
      <button type="button" onClick={() => instant.grade("a", "incorrect")}>
        hit
      </button>
      <span data-testid="rv">{String(instant.reveal("a"))}</span>
    </div>
  );
}

function clickHit() {
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("hit"),
  );
  act(() => btn!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function revealText() {
  return container.querySelector('[data-testid="rv"]')?.textContent;
}

describe("useInstantGrading × gradeMode parent (chấm kín)", () => {
  it("self mode (mặc định): reveal trả verdict per-element", () => {
    const onReport = vi.fn();
    act(() => root.render(<Probe onReport={onReport} />));
    clickHit();
    expect(revealText()).toBe("incorrect");
    expect(onReport).toHaveBeenCalledWith(["a"], "incorrect");
  });

  it("parent mode: reveal bị NIÊM PHONG (undefined) nhưng đáp án vẫn đẩy lên cha", () => {
    const onReport = vi.fn();
    act(() =>
      root.render(
        <GradeModeContext.Provider value={{ mode: "parent" }}>
          <Probe onReport={onReport} />
        </GradeModeContext.Provider>,
      ),
    );
    clickHit();
    // Không verdict nào lộ ra ngoài khi đang làm…
    expect(revealText()).toBe("undefined");
    // …nhưng report vẫn chạy — cha nhận đáp án (useGrading nuốt sound/status ở
    // parent mode; runner chấm ngầm bằng gradeByType lúc autosave/submit).
    expect(onReport).toHaveBeenCalledWith(["a"], "incorrect");
  });
});
