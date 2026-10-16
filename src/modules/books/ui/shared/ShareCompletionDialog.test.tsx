// @vitest-environment jsdom
/**
 * ShareCompletionDialog — chỉnh theo mockup SBT_2 C32:
 *  - Bài CHỜ CHẤM không khoe điểm (dù server trả score tạm).
 *  - Thẻ chia sẻ hiện HỌ TÊN đầy đủ (không phải viết tắt "H.").
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { ShareCompletionDialog } from "./ShareCompletionDialog";

const base = {
  open: true as const,
  onOpenChange: () => {},
  title: "Ôn tập chủ đề Gia đình",
  studentName: "Học sinh Demo",
  submittedAt: "2026-08-03T11:05:00.000Z",
  shareUrl: "http://example.test/sach-bai-tap/39/39004",
};

afterEach(cleanup);
afterEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  });
});

describe("ShareCompletionDialog", () => {
  it("bài chờ chấm: KHÔNG hiển thị điểm dù có score tạm", () => {
    render(
      <ShareCompletionDialog {...base} score={1} maxScore={4} pending />,
    );
    // Không có badge "Điểm: 1 / 4" trên thẻ.
    expect(screen.queryByText(/^Điểm:/)).toBeNull();
    // Phụ đề công tắc điểm báo đang chờ chấm.
    expect(screen.getByText(/Bài đang chờ chấm/)).toBeTruthy();
  });

  it("bài đã chấm: hiển thị điểm trên thẻ", () => {
    render(<ShareCompletionDialog {...base} score={6} maxScore={8} />);
    expect(screen.getByText(/^Điểm:\s*6\s*\/\s*8/)).toBeTruthy();
  });

  it("hiển thị họ tên đầy đủ (không phải viết tắt)", () => {
    render(<ShareCompletionDialog {...base} score={6} maxScore={8} />);
    // Họ tên đầy đủ xuất hiện (thẻ + phụ đề công tắc), không chỉ "H.".
    expect(screen.getAllByText("Học sinh Demo").length).toBeGreaterThan(0);
    expect(screen.getByText(/Hiển thị họ tên: Học sinh Demo/)).toBeTruthy();
  });

  it("copy thất bại (môi trường chặn clipboard): lộ input chép tay đúng liên kết", async () => {
    // Không có navigator.clipboard + execCommand trả false = môi trường QA
    // HTTP/iframe → copyText() trả false → hiện input read-only để chép tay.
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    document.execCommand = (() => false) as typeof document.execCommand;
    render(<ShareCompletionDialog {...base} score={6} maxScore={8} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Sao chép liên kết/ }),
    );
    const input = (await screen.findByLabelText(
      "Liên kết chia sẻ",
    )) as HTMLInputElement;
    expect(input.value).toBe(base.shareUrl);
  });

  it("copy thành công: KHÔNG lộ input chép tay", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<ShareCompletionDialog {...base} score={6} maxScore={8} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Sao chép liên kết/ }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(base.shareUrl));
    expect(screen.queryByLabelText("Liên kết chia sẻ")).toBeNull();
  });
});
