/**
 * Danh mục tỉnh là hằng số chép tay, nên cái dễ sai nhất là chép thiếu, chép
 * trùng, hoặc lỡ tay để lại tên tỉnh đã bị sáp nhập từ 01/7/2025.
 */
import { describe, expect, it } from "vitest";

import {
  CENTRAL_CITIES,
  PROVINCES,
  PROVINCES_ONLY,
  isKnownProvince,
} from "./provinces";

/** Vài tên tiêu biểu đã KHÔNG còn là đơn vị cấp tỉnh sau sắp xếp 2025. */
const MERGED_AWAY = [
  "Bắc Giang",
  "Hải Dương",
  "Bình Dương",
  "Bà Rịa - Vũng Tàu",
  "Hà Giang",
  "Yên Bái",
  "Vĩnh Phúc",
  "Nam Định",
  "Thừa Thiên Huế",
];

describe("danh mục tỉnh thành", () => {
  it("đúng 34 đơn vị: 6 thành phố trực thuộc trung ương + 28 tỉnh", () => {
    expect(CENTRAL_CITIES).toHaveLength(6);
    expect(PROVINCES_ONLY).toHaveLength(28);
    expect(PROVINCES).toHaveLength(34);
  });

  it("không có tên nào trùng nhau", () => {
    expect(new Set(PROVINCES).size).toBe(PROVINCES.length);
  });

  it("không còn tên đơn vị đã bị sáp nhập", () => {
    const sotSot = MERGED_AWAY.filter((name) => PROVINCES.includes(name));
    expect(sotSot).toEqual([]);
  });

  it("isKnownProvince bỏ qua khoảng trắng thừa, và từ chối tên cũ", () => {
    expect(isKnownProvince("  Hà Nội  ")).toBe(true);
    expect(isKnownProvince("Bắc Giang")).toBe(false);
  });
});
