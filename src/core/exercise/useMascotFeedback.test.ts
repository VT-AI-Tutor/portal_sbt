// @vitest-environment jsdom
/**
 * CHẤM NGAY (instant marking): mascot phải nói theo TỪNG thao tác
 * (onElementGraded) và khen riêng khi CẢ CÂU đúng (onStatusChange "success").
 * Chấm kín (bài GV giao) thì im — verdict không được lộ khi đang làm.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMascotFeedback } from "./useMascotFeedback";

const IDLE = "Chọn đáp án đúng nhé!";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useMascotFeedback", () => {
  it("mặc định là lời hướng dẫn", () => {
    const { result } = renderHook(() =>
      useMascotFeedback({ questionKey: "q1:0", idleMessage: IDLE }),
    );
    expect(result.current.status).toBe("idle");
    expect(result.current.message).toBe(IDLE);
  });

  it("mỗi thao tác được chấm → phản hồi ngay rồi tự quay về hướng dẫn", () => {
    const { result } = renderHook(() =>
      useMascotFeedback({ questionKey: "q1:0", idleMessage: IDLE }),
    );

    act(() => result.current.onElementGraded("e1", "correct"));
    expect(result.current.status).toBe("success");
    expect(result.current.message).not.toBe(IDLE);

    act(() => result.current.onElementGraded("e2", "incorrect"));
    expect(result.current.status).toBe("error");

    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.status).toBe("idle");
    expect(result.current.message).toBe(IDLE);
  });

  it("cả câu đúng → lời khen giữ nguyên, không tự tắt", () => {
    const { result } = renderHook(() =>
      useMascotFeedback({ questionKey: "q1:0", idleMessage: IDLE }),
    );

    act(() => result.current.onElementGraded("e1", "correct"));
    act(() => result.current.onStatusChange("success"));
    const praise = result.current.message;

    act(() => void vi.advanceTimersByTime(10_000));
    expect(result.current.status).toBe("success");
    expect(result.current.message).toBe(praise);
  });

  it("cả câu chấm xong mà còn ý sai → nhắc thử lại (tạm thời)", () => {
    const { result } = renderHook(() =>
      useMascotFeedback({ questionKey: "q1:0", idleMessage: IDLE }),
    );

    act(() => result.current.onStatusChange("error"));
    expect(result.current.status).toBe("error");
    expect(result.current.message).toBe("Còn ý chưa đúng, thử lại nhé!");

    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.status).toBe("idle");
  });

  it('bỏ qua "idle" của player để không cắt ngang phản hồi vừa hiện', () => {
    const { result } = renderHook(() =>
      useMascotFeedback({ questionKey: "q1:0", idleMessage: IDLE }),
    );

    act(() => result.current.onElementGraded("e1", "incorrect"));
    // Player báo idle ngay sau đó (câu còn dở) — phản hồi vẫn phải còn.
    act(() => result.current.onStatusChange("idle"));
    expect(result.current.status).toBe("error");
  });

  it("sang câu khác (hoặc Làm lại) → xoá phản hồi cũ", () => {
    const { result, rerender } = renderHook(
      ({ questionKey }) => useMascotFeedback({ questionKey, idleMessage: IDLE }),
      { initialProps: { questionKey: "q1:0" } },
    );

    act(() => result.current.onStatusChange("success"));
    expect(result.current.status).toBe("success");

    rerender({ questionKey: "q1:1" });
    expect(result.current.status).toBe("idle");
    expect(result.current.message).toBe(IDLE);
  });

  it("chấm kín (enabled=false) → mascot im, chỉ giữ lời hướng dẫn", () => {
    const { result } = renderHook(() =>
      useMascotFeedback({ questionKey: "q1:0", idleMessage: IDLE, enabled: false }),
    );

    act(() => result.current.onElementGraded("e1", "correct"));
    act(() => result.current.onStatusChange("success"));
    expect(result.current.status).toBe("idle");
    expect(result.current.message).toBe(IDLE);
  });
});
