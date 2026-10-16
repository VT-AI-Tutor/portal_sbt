import { describe, expect, it } from "vitest";
import {
  createPlacement,
  isComplete,
  placeItem,
  toGradeArray,
} from "./sortPlacement";

describe("sortPlacement", () => {
  it("bắt đầu rỗng, đặt từng item theo index, đủ hết mới complete", () => {
    let p = createPlacement(3);
    expect(isComplete(p)).toBe(false);
    p = placeItem(p, 0, 0);
    p = placeItem(p, 1, 1);
    expect(isComplete(p)).toBe(false);
    p = placeItem(p, 2, 1);
    expect(isComplete(p)).toBe(true);
    expect(toGradeArray(p)).toEqual([0, 1, 1]);
  });
  it("item đã đặt thì không đặt lại được (không cho làm lại)", () => {
    let p = createPlacement(2);
    p = placeItem(p, 0, 1);
    p = placeItem(p, 0, 0); // bị bỏ qua
    expect(toGradeArray(placeItem(p, 1, 0))).toEqual([1, 0]);
  });
});
