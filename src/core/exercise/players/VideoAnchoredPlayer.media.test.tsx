/**
 * WEB09 — video không tải được không được kẹt spinner mãi: lỗi phải hiện thông
 * báo + nút "Thử lại", và bấm thử lại phải dựng lại <video>.
 */
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
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function render() {
  act(() => {
    root.render(
      <VideoAnchoredPlayer
        title="Xem mẫu rồi làm theo"
        videoUrl="/storage/hong.mp4"
        anchors={[]}
      />,
    );
  });
}

const retryButton = () =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Thử lại",
  );

describe("VideoAnchoredPlayer — trạng thái tải media", () => {
  it("hiện lỗi + nút thử lại khi video báo lỗi", () => {
    render();
    expect(container.textContent).toContain("Đang tải video");
    act(() => {
      container.querySelector("video")!.dispatchEvent(new Event("error"));
    });
    expect(container.textContent).toContain("Không tải được video");
    expect(retryButton()).toBeTruthy();
  });

  it("hiện lỗi khi quá 15 giây vẫn chưa có metadata (kẹt loading)", () => {
    render();
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(container.textContent).toContain("Không tải được video");
  });

  it("ẩn overlay khi metadata đã tải", () => {
    render();
    const video = container.querySelector("video")!;
    Object.defineProperty(video, "duration", { value: 30, configurable: true });
    act(() => {
      video.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(container.textContent).not.toContain("Đang tải video");
    expect(container.textContent).not.toContain("Không tải được video");
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(container.textContent).not.toContain("Không tải được video");
  });

  it("bấm thử lại dựng lại video và quay về trạng thái đang tải", () => {
    render();
    const first = container.querySelector("video")!;
    act(() => {
      first.dispatchEvent(new Event("error"));
    });
    act(() => {
      retryButton()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Đang tải video");
    expect(container.querySelector("video")).not.toBe(first);
  });
});
