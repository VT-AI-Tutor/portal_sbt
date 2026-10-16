import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoAnchoredPlayer } from "./VideoAnchoredPlayer";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // jsdom không hiện thực play/pause của HTMLMediaElement.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

/** Tua video qua một mốc thời gian để mở thẻ câu hỏi neo tại đó. */
function crossAnchor(video: HTMLVideoElement, time: number) {
  act(() => {
    Object.defineProperty(video, "currentTime", { value: time, configurable: true, writable: true });
    video.dispatchEvent(new Event("timeupdate"));
  });
}

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Chờ phần tử xuất hiện (AnimatePresence mode="wait" cần chạy xong exit animation). */
async function waitForEl(selector: string, timeout = 3000): Promise<Element> {
  const start = Date.now();
  for (;;) {
    const el = container.querySelector(selector);
    if (el) return el;
    if (Date.now() - start > timeout) throw new Error(`Hết thời gian chờ ${selector}`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
  }
}

describe("VideoAnchoredPlayer", () => {
  it("chỉ gộp đáp án và báo 'idle' — KHÔNG phát 'success' khi mọi mốc mới chỉ được trả lời", async () => {
    const onAnswerChange = vi.fn();
    const onStatusChange = vi.fn();

    act(() => {
      root.render(
        <VideoAnchoredPlayer
          title="Xem và trả lời"
          videoUrl="https://media.test/lesson.mp4"
          onAnswerChange={onAnswerChange}
          onStatusChange={onStatusChange}
          anchors={[
            {
              id: "q1",
              time: 1,
              render: (ctx) => (
                <button data-testid="answer-q1" onClick={() => ctx.onAnswerChange("sai bét")}>
                  Trả lời câu 1
                </button>
              ),
            },
            {
              id: "q2",
              time: 2,
              render: (ctx) => (
                <button data-testid="answer-q2" onClick={() => ctx.onAnswerChange("cũng sai")}>
                  Trả lời câu 2
                </button>
              ),
            },
          ]}
        />,
      );
    });

    const video = container.querySelector("video");
    expect(video).toBeTruthy();

    // Mốc 1: mở thẻ, trả lời.
    crossAnchor(video!, 1.2);
    const btn1 = container.querySelector('[data-testid="answer-q1"]');
    expect(btn1).toBeTruthy();
    click(btn1!);
    expect(onAnswerChange).toHaveBeenLastCalledWith({ q1: "sai bét" });
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");

    // Tiếp tục ▶ để đóng thẻ, rồi tua qua mốc 2 và trả lời nốt.
    const resumeBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Tiếp tục"),
    );
    expect(resumeBtn).toBeTruthy();
    click(resumeBtn!);
    crossAnchor(video!, 2.2);
    const btn2 = await waitForEl('[data-testid="answer-q2"]');
    click(btn2);

    // Đủ 2/2 mốc đã trả lời: đáp án được gộp đầy đủ…
    expect(onAnswerChange).toHaveBeenLastCalledWith({ q1: "sai bét", q2: "cũng sai" });
    // …nhưng wrapper KHÔNG được tự phán "success" — verdict thuộc về câu hỏi con.
    expect(onStatusChange).not.toHaveBeenCalledWith("success");
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
  });

  it("không chuyển tiếp status của câu con thành status của wrapper", () => {
    const onStatusChange = vi.fn();

    act(() => {
      root.render(
        <VideoAnchoredPlayer
          title="Xem và trả lời"
          videoUrl="https://media.test/lesson.mp4"
          onStatusChange={onStatusChange}
          anchors={[
            {
              id: "q1",
              time: 1,
              render: (ctx) => (
                <button
                  data-testid="child-grades"
                  onClick={() => ctx.onStatusChange?.("success")}
                >
                  Câu con tự chấm đúng
                </button>
              ),
            },
          ]}
        />,
      );
    });

    crossAnchor(container.querySelector("video")!, 1.2);
    click(container.querySelector('[data-testid="child-grades"]')!);

    // "success" của MỘT câu con không được rò rỉ lên host qua wrapper.
    expect(onStatusChange).not.toHaveBeenCalledWith("success");
  });
});
