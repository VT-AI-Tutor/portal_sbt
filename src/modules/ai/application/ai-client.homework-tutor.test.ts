import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamHomeworkTutor } from "@/modules/ai/application/ai-client";

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

describe("streamHomeworkTutor", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POST tới /api/ai/homework-tutor kèm messages + ảnh, stream delta", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([
        'data: {"choices":[{"delta":{"content":"Em thử "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"bước đầu nhé"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    });

    const deltas: string[] = [];
    let done = false;
    await streamHomeworkTutor({
      messages: [{ role: "user", content: "Bài này ạ" }],
      image: { media_type: "image/png", data: "QUJD" },
      onDelta: (t) => deltas.push(t),
      onDone: () => {
        done = true;
      },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/ai/homework-tutor");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toBe("Bài này ạ");
    expect(body.image.media_type).toBe("image/png");
    expect(deltas.join("")).toBe("Em thử bước đầu nhé");
    expect(done).toBe(true);
  });

  it("HTTP 429 → gọi onRateLimited, không onError", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Hết lượt hôm nay", code: "rate_limited" }),
    });

    let rateMsg = "";
    let errored = false;
    await streamHomeworkTutor({
      messages: [{ role: "user", content: "x" }],
      onDelta: () => {},
      onRateLimited: (m) => {
        rateMsg = m;
      },
      onError: () => {
        errored = true;
      },
    });

    expect(rateMsg).toBe("Hết lượt hôm nay");
    expect(errored).toBe(false);
  });
});
