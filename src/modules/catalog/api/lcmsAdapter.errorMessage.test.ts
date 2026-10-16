// @vitest-environment jsdom
/**
 * SBT_1308 (đỏ, dòng 57): lỗi từ LCMS phải đọc được. Body lỗi mỗi service một
 * shape, nên adapter dò nhiều key — NHƯNG chỉ nhận nội dung thực sự là thông
 * báo cho người dùng: HTML của gateway hay stack trace thì thà trả mã lỗi còn
 * hơn đổ nguyên khối vào toast (vỡ giao diện + lộ nội bộ hệ thống).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { lcmsChangePassword } from "@/core/api/lcmsAdapter";

function stubResponse(body: string, status: number, contentType: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(body, { status, headers: { "Content-Type": contentType } }),
    ),
  );
}

const changePassword = () =>
  lcmsChangePassword({
    oldPassword: "cu",
    newPassword: "moi",
    confirmPassword: "moi",
  });

afterEach(() => vi.unstubAllGlobals());

describe("lcmsPlatformFetch — thông báo lỗi", () => {
  it("body JSON có `errors[].message` → dùng đúng message đó", async () => {
    stubResponse(
      JSON.stringify({ errors: [{ message: "Mật khẩu không đạt quy tắc." }] }),
      400,
      "application/json",
    );
    await expect(changePassword()).rejects.toThrow("Mật khẩu không đạt quy tắc.");
  });

  it("body text thuần ngắn gọn → dùng luôn làm message", async () => {
    stubResponse("Mật khẩu mới trùng mật khẩu cũ.", 400, "text/plain");
    await expect(changePassword()).rejects.toThrow(
      "Mật khẩu mới trùng mật khẩu cũ.",
    );
  });

  it("gateway trả HTML → KHÔNG đổ trang lỗi vào message", async () => {
    stubResponse(
      "<html><head><title>502 Bad Gateway</title></head><body>nginx</body></html>",
      502,
      "text/html",
    );
    await expect(changePassword()).rejects.toThrow("LCMS API error 502");
  });

  it("message nhiều dòng (danh sách quy tắc) → gộp một dòng, GIỮ nội dung", async () => {
    stubResponse(
      JSON.stringify({
        message:
          "Mật khẩu không hợp lệ:\n- phải có chữ hoa\n- không dùng dãy số liên tiếp",
      }),
      400,
      "application/json",
    );
    await expect(changePassword()).rejects.toThrow(
      "Mật khẩu không hợp lệ: - phải có chữ hoa - không dùng dãy số liên tiếp",
    );
  });

  it("message dài → CẮT ngắn, không đổ nguyên khối (4xx)", async () => {
    stubResponse(
      JSON.stringify({ message: "Mật khẩu không hợp lệ. ".repeat(30) }),
      400,
      "application/json",
    );
    const thrownError = await changePassword().catch((error: Error) => error);
    // Không chốt cứng độ dài (hằng số MAX_ERROR_TEXT_LENGTH không export):
    // hợp đồng là "có cắt và có dấu …", không phải con số cụ thể.
    expect((thrownError as Error).message.length).toBeLessThan(
      "Mật khẩu không hợp lệ. ".repeat(30).length,
    );
    expect((thrownError as Error).message.endsWith("…")).toBe(true);
  });

  // 5xx là lỗi hệ thống: body hay là stack trace / lỗi SQL — tuyệt đối không
  // hiện cho học sinh, dù đã cắt ngắn.
  it("5xx → luôn trả mã lỗi, KHÔNG lấy body (stack trace, lỗi SQL)", async () => {
    stubResponse(
      "java.lang.NullPointerException at com.lcms.user.PasswordService",
      500,
      "text/plain",
    );
    await expect(changePassword()).rejects.toThrow("LCMS API error 500");

    stubResponse(
      JSON.stringify({ message: "SQLSTATE[42S02]: Base table 'lcms.users' not found" }),
      500,
      "application/json",
    );
    await expect(changePassword()).rejects.toThrow("LCMS API error 500");
  });

  // Spring: {"error":"Bad Request","message":""} — trả "Bad Request" thì học sinh
  // vẫn không biết sai gì, mà còn che mất câu tiếng Việt fallback của dialog.
  it("body kiểu Spring (error='Bad Request', message rỗng) → trả mã lỗi", async () => {
    stubResponse(
      JSON.stringify({
        timestamp: "2026-08-14T10:00:00Z",
        status: 400,
        error: "Bad Request",
        message: "",
        path: "/api/lcms/user/change-password",
      }),
      400,
      "application/json",
    );
    await expect(changePassword()).rejects.toThrow("LCMS API error 400");
  });

  it("validation kiểu Spring @Valid (defaultMessage) → lấy được message", async () => {
    stubResponse(
      JSON.stringify({
        errors: [
          { field: "newPassword", defaultMessage: "Không được dùng dãy số liên tiếp" },
        ],
      }),
      400,
      "application/json",
    );
    await expect(changePassword()).rejects.toThrow(
      "Không được dùng dãy số liên tiếp",
    );
  });

  it("validation kiểu Laravel (errors là map field → [message]) → lấy được message", async () => {
    stubResponse(
      JSON.stringify({
        errors: { newPassword: ["Mật khẩu không được là dãy số liên tiếp"] },
      }),
      400,
      "application/json",
    );
    await expect(changePassword()).rejects.toThrow(
      "Mật khẩu không được là dãy số liên tiếp",
    );
  });

  it("errors chứa mã đã biết password-has-sequential-or-repeating-chars → câu tiếng Việt", async () => {
    stubResponse(
      JSON.stringify({
        timestamp: "1784626084873",
        errorCode: "INVALID_REQUEST",
        errors: ["security.authen.password-has-sequential-or-repeating-chars"],
      }),
      400,
      "application/json",
    );
    await expect(changePassword()).rejects.toThrow(
      "Mật khẩu không được chứa dãy ký tự liên tiếp (123, abc) hoặc lặp lại (aaa).",
    );
  });

  it("mã security.authen.password* chưa map → ẨN, trả mã lỗi HTTP", async () => {
    stubResponse(
      JSON.stringify({
        errorCode: "INVALID_REQUEST",
        errors: ["security.authen.password-something-new"],
      }),
      400,
      "application/json",
    );
    await expect(changePassword()).rejects.toThrow("LCMS API error 400");
    await expect(changePassword()).rejects.not.toThrow(/security\.authen/);
  });

  it("mã dạng máy chưa map ngoài miền mật khẩu → cũng ẨN, trả mã lỗi HTTP", async () => {
    stubResponse(
      JSON.stringify({
        errorCode: "INVALID_REQUEST",
        errors: ["user.profile.some-other-code"],
      }),
      400,
      "application/json",
    );
    await expect(changePassword()).rejects.toThrow("LCMS API error 400");
  });

  it("errors trộn mã đã map + mã lạ → CHỈ câu đã dịch, không lộ mã lạ", async () => {
    stubResponse(
      JSON.stringify({
        errorCode: "INVALID_REQUEST",
        errors: [
          "security.authen.password-has-sequential-or-repeating-chars",
          "user.profile.some-other-code",
        ],
      }),
      400,
      "application/json",
    );
    const thrownError = await changePassword().catch((error: Error) => error);
    expect((thrownError as Error).message).toBe(
      "Mật khẩu không được chứa dãy ký tự liên tiếp (123, abc) hoặc lặp lại (aaa).",
    );
  });

  it("chuỗi gạch-nối rất dài trong errors[] → xử lý nhanh như câu chữ thường", async () => {
    const longToken = `${"mat-khau-".repeat(34)}x `;
    stubResponse(
      JSON.stringify({ errors: [longToken] }),
      400,
      "application/json",
    );
    const thrownError = await changePassword().catch((error: Error) => error);
    expect((thrownError as Error).message.startsWith("mat-khau-")).toBe(true);
    expect((thrownError as Error).message.endsWith("…")).toBe(true);
  });

  const MAPPED_PASSWORD_CODES: [code: string, message: string][] = [
    [
      "auth.cannot-change-other",
      "Người dùng không có quyền thay đổi mật khẩu của người khác",
    ],
    ["password-too-long", "Mật khẩu vượt quá độ dài tối đa cho phép"],
    ["password-is-required", "Mật khẩu không được để trống"],
    [
      "password-and-confirm-password-not-match",
      "Mật khẩu mới và mật khẩu xác nhận không khớp nhau",
    ],
    ["old-password-is-not-correct", "Mật khẩu cũ nhập vào không đúng"],
    ["password-too-short", "Mật khẩu chưa đủ độ dài tối thiểu"],
    [
      "password-missing-uppercase",
      "Mật khẩu phải chứa ít nhất một ký tự viết hoa (A-Z)",
    ],
    [
      "password-missing-lowercase",
      "Mật khẩu phải chứa ít nhất một ký tự viết thường (a-z)",
    ],
    ["password-missing-digit", "Mật khẩu phải chứa ít nhất một chữ số (0-9)"],
    [
      "password-missing-special",
      "Mật khẩu phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*)",
    ],
  ];

  it.each(MAPPED_PASSWORD_CODES)(
    "mã %s trong errors[] → câu tiếng Việt tương ứng",
    async (code, message) => {
      stubResponse(
        JSON.stringify({ errorCode: "INVALID_REQUEST", errors: [code] }),
        400,
        "application/json",
      );
      await expect(changePassword()).rejects.toThrow(message);
    },
  );

  it.each(MAPPED_PASSWORD_CODES)(
    "mã %s ở key `message` → câu tiếng Việt tương ứng",
    async (code, message) => {
      stubResponse(JSON.stringify({ message: code }), 400, "application/json");
      await expect(changePassword()).rejects.toThrow(message);
    },
  );

  it("nhiều lỗi gộp lại vẫn bị cắt theo tổng, không chỉ theo từng phần tử", async () => {
    stubResponse(
      JSON.stringify({
        errors: Array.from({ length: 10 }, () => ({ message: "x".repeat(150) })),
      }),
      400,
      "application/json",
    );
    const thrownError = await changePassword().catch((error: Error) => error);
    expect((thrownError as Error).message.length).toBeLessThan(10 * 150);
    expect((thrownError as Error).message.endsWith("…")).toBe(true);
  });
});
