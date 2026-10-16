import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refresh } from "@/core/auth/api";

// GAP-001: refresh token là single-use (IDENT-R8) — hai nơi cùng xin gia hạn cùng lúc
// (vd StrictMode mount đôi trong dev, nhiều component cùng phát hiện sắp hết hạn) phải
// dùng CHUNG một lượt gọi; nếu bắn hai request, request sau dùng token đã tiêu → 401 →
// phiên vừa gia hạn bị huỷ oan.

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const tokens = {
  access_token: "at-2",
  refresh_token: "rt-2",
  token_type: "Bearer",
  expires_in: 900,
};

describe("refresh single-flight (GAP-001)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("hai lượt gọi đồng thời cùng refresh token → MỘT request, cùng kết quả", async () => {
    let release: (r: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
    );

    const p1 = refresh("rt-1");
    const p2 = refresh("rt-1");
    release(jsonResponse({ success: true, data: tokens }));

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1.access_token).toBe("at-2");
    expect(r2).toBe(r1);
  });

  it("lượt gọi SAU khi lượt trước xong vẫn tạo request mới (không cache vĩnh viễn)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: tokens }));

    await refresh("rt-1");
    await refresh("rt-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("thất bại không kẹt in-flight: lượt kế tiếp thử lại được", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, message: "expired" }, false, 401),
    );
    await expect(refresh("rt-x")).rejects.toThrow();

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: tokens }),
    );
    await expect(refresh("rt-x")).resolves.toMatchObject({
      access_token: "at-2",
    });
  });

  it("token khác nhau không gộp chung", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: tokens }));
    await Promise.all([refresh("rt-a"), refresh("rt-b")]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
