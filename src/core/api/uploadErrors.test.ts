/**
 * Khoá luật nhận diện 413 cho cả BA lớp lỗi đang tồn tại trong repo — chúng đặt
 * mã HTTP ở hai tên field khác nhau (`statusCode` vs `status`), nên bài test này
 * chính là thứ chặn việc thêm tầng API thứ tư mà quên nối vào.
 */
import { describe, expect, it } from "vitest";

import { isPayloadTooLarge, PAYLOAD_TOO_LARGE_MESSAGE } from "./uploadErrors";

class FakeLcmsApiError extends Error {
  constructor(readonly statusCode: number) {
    super(`LCMS API error ${statusCode}`);
  }
}

class FakeAuthApiError extends Error {
  constructor(readonly status: number) {
    super(`Auth API error ${status}`);
  }
}

describe("isPayloadTooLarge", () => {
  it("nhận 413 qua `statusCode` (LcmsApiError, AssessmentApiError)", () => {
    expect(isPayloadTooLarge(new FakeLcmsApiError(413))).toBe(true);
  });

  it("nhận 413 qua `status` (AuthApiError)", () => {
    expect(isPayloadTooLarge(new FakeAuthApiError(413))).toBe(true);
  });

  it("KHÔNG nhận mã khác — 401/500 phải đi đường xử lý của riêng nó", () => {
    expect(isPayloadTooLarge(new FakeLcmsApiError(401))).toBe(false);
    expect(isPayloadTooLarge(new FakeAuthApiError(500))).toBe(false);
  });

  it("KHÔNG đoán theo chuỗi: lỗi mạng mang đúng chữ 413 vẫn là false", () => {
    // nginx cắt kết nối giữa chừng thì fetch reject bằng TypeError không mang
    // mã nào — trường hợp này CỐ Ý lọt, lớp chặn thật phải là kiểm dung lượng
    // trước khi gửi. Ghim ở đây để khỏi ai đó "sửa" thành dò chuỗi.
    expect(isPayloadTooLarge(new TypeError("Failed to fetch 413"))).toBe(false);
  });

  it("chịu được đầu vào không phải lỗi", () => {
    expect(isPayloadTooLarge(null)).toBe(false);
    expect(isPayloadTooLarge(undefined)).toBe(false);
    expect(isPayloadTooLarge("413")).toBe(false);
    expect(isPayloadTooLarge(413)).toBe(false);
  });

  it("câu hiển thị nói ra LÝ DO, không chỉ 'thử lại'", () => {
    // Khoá tính chất chứ không khoá từng chữ: đổi câu thoải mái, miễn là còn
    // cho học sinh biết vấn đề nằm ở dung lượng. Câu chỉ có "thử lại nhé" đẩy
    // các em chọn lại đúng file vừa rồi và hỏng tiếp thành vòng lặp.
    expect(PAYLOAD_TOO_LARGE_MESSAGE).toMatch(/quá lớn|quá nặng|dung lượng/i);
  });
});
