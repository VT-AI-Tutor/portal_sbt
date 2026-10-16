import { describe, expect, it } from "vitest";
import { createPendingUploadGate } from "./pendingUploadGate";

describe("pendingUploadGate", () => {
  it("đếm upload đang chạy; resolve xong thì hạ cờ", async () => {
    const gate = createPendingUploadGate();
    expect(gate.hasPending()).toBe(false);

    let release!: (v: string) => void;
    const p = gate.wrap(() => new Promise<string>((res) => (release = res)));
    expect(gate.hasPending()).toBe(true);

    release("ok");
    await expect(p).resolves.toBe("ok");
    expect(gate.hasPending()).toBe(false);
  });

  it("reject cũng hạ cờ — upload lỗi không được kẹt nút Nộp bài mãi", async () => {
    const gate = createPendingUploadGate();
    await expect(
      gate.wrap(() => Promise.reject(new Error("mạng rớt"))),
    ).rejects.toThrow("mạng rớt");
    expect(gate.hasPending()).toBe(false);
  });

  it("nhiều upload chồng nhau: chỉ hết pending khi TẤT CẢ xong", async () => {
    const gate = createPendingUploadGate();
    let release1!: () => void;
    let release2!: () => void;
    const p1 = gate.wrap(() => new Promise<void>((res) => (release1 = res)));
    const p2 = gate.wrap(() => new Promise<void>((res) => (release2 = res)));

    release1();
    await p1;
    expect(gate.hasPending()).toBe(true);

    release2();
    await p2;
    expect(gate.hasPending()).toBe(false);
  });
});
