import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LCMS đã có endpoint upload file bài làm: POST /api/lcms/attempt/upload-file
 * (multipart, field `file`) → {fileUrl, fileId}. Cặp này được nhét vào
 * answer.files của câu upload_answer rồi đi theo PUT answer / POST submit.
 * Điểm dễ gãy: lcmsAuthedFetch tự gắn "Content-Type: application/json" cho mọi
 * request có body — với FormData thì header đó phá boundary của multipart.
 */

const API_BASE = "https://lcms-api.test";

function stubBrowser() {
  const store = new Map<string, string>([
    ["evo_auth_access_token", "at"],
    ["evo_auth_refresh_token", "rt"],
  ]);
  vi.stubGlobal("window", {
    __APP_CONFIG__: {
      API_PROVIDER: "lcms",
      LCMS_API_BASE_URL: API_BASE,
    },
  });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
}

describe("lcmsUploadAttemptFile", () => {
  beforeEach(() => {
    stubBrowser();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POST multipart tới /attempt/upload-file, KHÔNG ép Content-Type json, trả {fileId, fileUrl}", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            message: null,
            data: {
              fileUrl: "https://media.test/lcms/abc.png",
              fileId: "346882382739013705",
            },
            total: "2",
          }),
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    const { lcmsUploadAttemptFile } = await import("./lcmsAdapter");
    const file = new File(["nội dung"], "bai-lam.png", { type: "image/png" });
    const result = await lcmsUploadAttemptFile(file);

    expect(result).toEqual({
      fileId: "346882382739013705",
      fileUrl: "https://media.test/lcms/abc.png",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${API_BASE}/api/lcms/attempt/upload-file`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
    // Bearer vẫn phải gắn; Content-Type để trống cho fetch tự đặt boundary.
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer at");
    expect(headers["Content-Type"]).toBeUndefined();
  });
});
