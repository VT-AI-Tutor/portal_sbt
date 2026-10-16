// Client helpers for AI — requires backend routes at {VITE_API_BASE_URL}/api/ai/*.
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";
import { getStoredSession } from "@/core/auth/storage";
import { PAYLOAD_TOO_LARGE_MESSAGE } from "@/core/api/uploadErrors";

const API_BASE = getAuthenticatedApiBaseUrl();

function authHeaders(): Record<string, string> {
  const { accessToken } = getStoredSession();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export type ChatMsg = { role: "user" | "assistant"; content: string };

/** Ảnh đính vào lượt hỏi bài (TUTOR-R6). `data` = base64 (không kèm tiền tố data:). */
export type TutorImage = { media_type: string; data: string };

/** Đọc dòng SSE `data: {choices[0].delta.content}` … `data: [DONE]`. Dùng chung cho các stream AI. */
async function pumpDeltaStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;

  while (!done) {
    const { done: rd, value } = await reader.read();
    if (rd) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        done = true;
        break;
      }
      try {
        const parsed = JSON.parse(json);
        const content: string | undefined = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
}

/**
 * Trợ giảng hỏi bài (TUTOR-R6/R7): gửi lịch sử hội thoại + ảnh tuỳ chọn tới
 * /api/ai/homework-tutor. Hết lượt trong ngày → gọi onRateLimited (HTTP 429).
 */
export async function streamHomeworkTutor({
  messages,
  image,
  onDelta,
  onDone,
  onError,
  onRateLimited,
  signal,
}: {
  messages: ChatMsg[];
  image?: TutorImage | null;
  onDelta: (text: string) => void;
  onDone?: () => void;
  onError?: (msg: string) => void;
  onRateLimited?: (msg: string) => void;
  signal?: AbortSignal;
}) {
  try {
    const resp = await fetch(`${API_BASE}/api/ai/homework-tutor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ messages, image: image ?? null }),
      signal,
    });

    if (!resp.ok || !resp.body) {
      // 413 chặn TRƯỚC khi đọc thân: ảnh chụp bài tập đi kèm dưới dạng base64
      // (phồng ~33% so với file gốc) nên đây là cửa dễ vượt trần nhất, mà thân
      // lỗi lúc đó là trang HTML của gateway chứ không phải JSON của mình.
      if (resp.status === 413) {
        onError?.(PAYLOAD_TOO_LARGE_MESSAGE);
        return;
      }
      const data = await resp.json().catch(() => ({ error: "Lỗi khi gọi AI" }));
      if (resp.status === 429 || data.code === "rate_limited") {
        onRateLimited?.(data.error ?? "Hôm nay em đã hết lượt hỏi bài rồi.");
        return;
      }
      onError?.(data.error ?? `HTTP ${resp.status}`);
      return;
    }

    await pumpDeltaStream(resp.body, onDelta);
    onDone?.();
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    onError?.(e instanceof Error ? e.message : "Lỗi không xác định");
  }
}

export async function streamChat({
  messages,
  system,
  model,
  onDelta,
  onDone,
  onError,
  signal,
}: {
  messages: ChatMsg[];
  system?: string;
  model?: string;
  onDelta: (text: string) => void;
  onDone?: () => void;
  onError?: (msg: string) => void;
  signal?: AbortSignal;
}) {
  try {
    const resp = await fetch(`${API_BASE}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ messages, system, model }),
      signal,
    });

    if (!resp.ok || !resp.body) {
      // KHÔNG bắt 413 ở đây như homework-tutor: cửa này chỉ gửi chữ (trợ lý và
      // dịch của khu giáo viên), không có tệp nào để mà báo "file quá lớn".
      // Muốn báo tử tế cho nội dung quá dài thì cần câu riêng cho màn giáo viên.
      const data = await resp.json().catch(() => ({ error: "Lỗi khi gọi AI" }));
      onError?.(data.error ?? `HTTP ${resp.status}`);
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;

    while (!done) {
      const { done: rd, value } = await reader.read();
      if (rd) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") {
          done = true;
          break;
        }
        try {
          const parsed = JSON.parse(json);
          const content: string | undefined =
            parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
    onDone?.();
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    onError?.(e instanceof Error ? e.message : "Lỗi không xác định");
  }
}

export async function callAIJson<T>({
  system,
  prompt,
  tool,
  model,
}: {
  system?: string;
  prompt: string;
  tool: { name: string; description: string; parameters: unknown };
  model?: string;
}): Promise<{ data?: T; error?: string }> {
  try {
    const resp = await fetch(`${API_BASE}/api/ai/json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ system, prompt, tool, model }),
    });
    const json = await resp.json();
    if (!resp.ok) return { error: json.error ?? `HTTP ${resp.status}` };
    return { data: json.data as T };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Lỗi không xác định" };
  }
}
