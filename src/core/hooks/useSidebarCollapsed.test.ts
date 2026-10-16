// @vitest-environment jsdom
/**
 * Nhớ trạng thái thu gọn menu chính. Cái đáng vỡ ở đây không phải việc bật/tắt
 * mà là ĐƯỜNG NHỚ: đọc sai khoá, ghi sai lúc, hoặc localStorage ném lỗi (Safari
 * riêng tư) thì hoặc mất lựa chọn của người dùng, hoặc chết cả khung trang.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import {
  SIDEBAR_COLLAPSED_KEY,
  useSidebarCollapsed,
} from "./useSidebarCollapsed";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("useSidebarCollapsed", () => {
  it("mặc định mở rộng khi chưa có gì lưu", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
  });

  it("vào lại thấy đúng trạng thái đã thu gọn — ngay lượt render ĐẦU", () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
    const { result } = renderHook(() => useSidebarCollapsed());
    // Lượt đầu đã collapsed: đọc bằng effect thì thanh bên giật một nhịp từ rộng
    // sang hẹp mỗi lần mở trang.
    expect(result.current.collapsed).toBe(true);
  });

  it("bật/tắt ghi lại lựa chọn", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(true);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");

    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(false);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("0");
  });

  it("khoá riêng cho từng khu — thu gọn khu này không kéo theo khu kia", () => {
    window.localStorage.setItem("evo_admin_sidebar_collapsed", "1");
    const { result } = renderHook(() =>
      useSidebarCollapsed("evo_admin_sidebar_collapsed"),
    );
    expect(result.current.collapsed).toBe(true);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
  });

  it("localStorage ném lỗi thì vẫn chạy, không làm vỡ trang", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(true);
  });
});
