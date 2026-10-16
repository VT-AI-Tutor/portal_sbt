import { describe, expect, it } from "vitest";
import { formatCountdown, remainingSeconds } from "./useCountdown";

describe("formatCountdown", () => {
  it("725 giây → '12:05'", () => {
    expect(formatCountdown(725)).toBe("12:05");
  });

  it("0 giây → '00:00'", () => {
    expect(formatCountdown(0)).toBe("00:00");
  });

  it("số âm cũng bị kẹp về '00:00' (không hiển thị âm)", () => {
    expect(formatCountdown(-5)).toBe("00:00");
  });

  it("59 giây → '00:59'", () => {
    expect(formatCountdown(59)).toBe("00:59");
  });
});

describe("remainingSeconds", () => {
  it("bắt đầu 10 phút trước, giới hạn 720s → còn 120s", () => {
    const now = Date.now();
    const startedAt = new Date(now - 10 * 60 * 1000).toISOString();
    expect(remainingSeconds(startedAt, 720, now)).toBe(120);
  });

  it("đã quá hạn → 0 (không âm)", () => {
    const now = Date.now();
    const startedAt = new Date(now - 60 * 60 * 1000).toISOString();
    expect(remainingSeconds(startedAt, 600, now)).toBe(0);
  });

  it("vừa bắt đầu → xấp xỉ đúng giới hạn", () => {
    const now = Date.now();
    expect(remainingSeconds(new Date(now).toISOString(), 300, now)).toBe(300);
  });
});
