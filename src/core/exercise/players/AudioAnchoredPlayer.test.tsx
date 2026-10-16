import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioAnchoredPlayer } from "./AudioAnchoredPlayer";

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

/** Tua audio qua một mốc thời gian để mở thẻ câu hỏi neo tại đó. */
function crossAnchor(audio: HTMLAudioElement, time: number) {
  act(() => {
    Object.defineProperty(audio, "currentTime", { value: time, configurable: true, writable: true });
    audio.dispatchEvent(new Event("timeupdate"));
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

describe("AudioAnchoredPlayer", () => {
  it("chỉ gộp đáp án và báo 'idle' — KHÔNG phát 'success' khi mọi mốc mới chỉ được trả lời", async () => {
    const onAnswerChange = vi.fn();
    const onStatusChange = vi.fn();

    act(() => {
      root.render(
        <AudioAnchoredPlayer
          title="Nghe và trả lời"
          audioUrl="https://media.test/listening.mp3"
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

    const audio = container.querySelector("audio");
    expect(audio).toBeTruthy();

    // Mốc 1: mở thẻ, trả lời.
    crossAnchor(audio!, 1.2);
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
    crossAnchor(audio!, 2.2);
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
        <AudioAnchoredPlayer
          title="Nghe và trả lời"
          audioUrl="https://media.test/listening.mp3"
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

    crossAnchor(container.querySelector("audio")!, 1.2);
    click(container.querySelector('[data-testid="child-grades"]')!);

    // "success" của MỘT câu con không được rò rỉ lên host qua wrapper.
    expect(onStatusChange).not.toHaveBeenCalledWith("success");
  });

  it("yêu cầu trình duyệt tải sẵn metadata (nếu không, thời lượng đứng ở 0:00)", () => {
    act(() => {
      root.render(
        <AudioAnchoredPlayer title="Nghe" audioUrl="https://media.test/bai2.mp3" anchors={[]} />,
      );
    });

    // preload mặc định trên mobile Chrome/Safari là "none" → duration = NaN →
    // player hiện 0:00/0:00 cho tới khi bấm play (WEB10).
    expect(container.querySelector("audio")!.getAttribute("preload")).toBe("metadata");
  });

  it("báo lỗi rõ ràng khi tệp âm thanh không tải được thay vì đứng im ở 0:00", () => {
    act(() => {
      root.render(
        <AudioAnchoredPlayer title="Nghe" audioUrl="https://media.test/hong.mp3" anchors={[]} />,
      );
    });

    expect(container.querySelector('[role="alert"]')).toBeNull();

    act(() => {
      container.querySelector("audio")!.dispatchEvent(new Event("error"));
    });

    expect(container.querySelector('[role="alert"]')!.textContent).toContain(
      "Không tải được tệp âm thanh",
    );
  });
});
