import { afterEach, describe, expect, it } from "vitest";
import { isStudentPageEnabled } from "./studentPage";

type Cfg = { STUDENT_PAGE_ENABLED?: string } | undefined;
function setRuntimeConfig(cfg: Cfg) {
  (globalThis as { window?: { __APP_CONFIG__?: Cfg } }).window = {
    __APP_CONFIG__: cfg,
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("isStudentPageEnabled", () => {
  it("mặc định BẬT khi không có config", () => {
    setRuntimeConfig(undefined);
    expect(isStudentPageEnabled()).toBe(true);
  });

  it("BẬT khi cấu hình rỗng/không liên quan", () => {
    setRuntimeConfig({});
    expect(isStudentPageEnabled()).toBe(true);
  });

  it("TẮT khi STUDENT_PAGE_ENABLED=false (trim + lowercase)", () => {
    setRuntimeConfig({ STUDENT_PAGE_ENABLED: "  False " });
    expect(isStudentPageEnabled()).toBe(false);
  });

  it("TẮT với các biến thể 0/off/no", () => {
    for (const v of ["0", "off", "no", "OFF"]) {
      setRuntimeConfig({ STUDENT_PAGE_ENABLED: v });
      expect(isStudentPageEnabled()).toBe(false);
    }
  });

  it("BẬT khi STUDENT_PAGE_ENABLED=true", () => {
    setRuntimeConfig({ STUDENT_PAGE_ENABLED: "true" });
    expect(isStudentPageEnabled()).toBe(true);
  });
});
