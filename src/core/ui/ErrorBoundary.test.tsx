// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Bum({ khi }: { khi: boolean }) {
  if (khi) throw new Error("câu hỏi dị dạng");

  return <p>nội dung bình thường</p>;
}

beforeEach(() => {
  // React in ra console.error cho mọi lỗi bị ranh giới bắt — tắt để log test sạch.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("cho nội dung chạy bình thường khi không có lỗi", () => {
    render(
      <ErrorBoundary fallback={() => <p>đã lỗi</p>}>
        <Bum khi={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("nội dung bình thường")).toBeTruthy();
  });

  it("bắt lỗi render và hiện nội dung thay thế thay vì trắng trang", () => {
    render(
      <ErrorBoundary fallback={(e) => <p>đã lỗi: {e.message}</p>}>
        <Bum khi />
      </ErrorBoundary>,
    );

    // Đây là hồi quy của "màn hình trắng": trước khi có ranh giới, React gỡ sạch
    // cây và người dùng không còn gì để bấm.
    expect(screen.getByText("đã lỗi: câu hỏi dị dạng")).toBeTruthy();
  });

  it("một ranh giới hỏng KHÔNG kéo theo phần còn lại của trang", () => {
    render(
      <div>
        <ErrorBoundary fallback={() => <p>câu 1 lỗi</p>}>
          <Bum khi />
        </ErrorBoundary>
        <ErrorBoundary fallback={() => <p>câu 2 lỗi</p>}>
          <Bum khi={false} />
        </ErrorBoundary>
      </div>,
    );

    expect(screen.getByText("câu 1 lỗi")).toBeTruthy();
    expect(screen.getByText("nội dung bình thường")).toBeTruthy();
  });

  it("vẫn ghi console.error để người phát triển còn manh mối", () => {
    render(
      <ErrorBoundary fallback={() => <p>đã lỗi</p>}>
        <Bum khi />
      </ErrorBoundary>,
    );

    // Ranh giới "nuốt" lỗi khỏi giao diện — nếu nuốt luôn khỏi console thì mất
    // dấu vết duy nhất để lần ra nguyên nhân.
    expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes("ErrorBoundary"))).toBe(true);
  });

  it("gọi onError để nơi dùng gửi log nếu muốn", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary fallback={() => <p>đã lỗi</p>} onError={onError}>
        <Bum khi />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toBe("câu hỏi dị dạng");
  });
});
