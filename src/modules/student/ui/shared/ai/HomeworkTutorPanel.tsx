import { useEffect, useRef, useState } from "react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { Send, ImagePlus, X, Loader2, Sparkles, RotateCcw } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  streamHomeworkTutor,
  type ChatMsg,
  type TutorImage,
} from "@/modules/ai/application/ai-client";
import { parseHints, buildAnswerMessage } from "./tutorHints";
import { TutorAnswerForm } from "./TutorAnswerForm";

// Tailwind preflight xoá style mặc định của heading/list nên phải gán class rõ ràng (repo chưa
// có plugin typography). Heading trong bong bóng chat hiển thị như dòng in đậm, không phóng to.
const MD_COMPONENTS: Components = {
  h1: ({ node: _n, ...p }) => (
    <p className="font-bold mt-2 mb-1 first:mt-0" {...p} />
  ),
  h2: ({ node: _n, ...p }) => (
    <p className="font-bold mt-2 mb-1 first:mt-0" {...p} />
  ),
  h3: ({ node: _n, ...p }) => (
    <p className="font-bold mt-2 mb-1 first:mt-0" {...p} />
  ),
  p: ({ node: _n, ...p }) => <p className="my-1 first:mt-0 last:mb-0" {...p} />,
  ul: ({ node: _n, ...p }) => (
    <ul className="list-disc pl-5 my-1 space-y-0.5" {...p} />
  ),
  ol: ({ node: _n, ...p }) => (
    <ol className="list-decimal pl-5 my-1 space-y-0.5" {...p} />
  ),
  li: ({ node: _n, ...p }) => <li className="my-0.5" {...p} />,
  strong: ({ node: _n, ...p }) => <strong className="font-semibold" {...p} />,
  code: ({ node: _n, ...p }) => (
    <code className="px-1 py-0.5 rounded bg-black/5 text-[0.85em]" {...p} />
  ),
  a: ({ node: _n, ...p }) => (
    <a
      className="text-primary underline"
      target="_blank"
      rel="noreferrer"
      {...p}
    />
  ),
};

const SUGGESTIONS = [
  "Giải thích từng bước giúp em",
  "Gợi ý hướng làm bài này",
  "Em nên bắt đầu từ đâu?",
];

type Bubble = { role: "user" | "assistant"; content: string };

function fileToImage(file: File): Promise<TutorImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result); // data:image/png;base64,XXXX
      const comma = result.indexOf(",");
      const meta = result.slice(5, result.indexOf(";"));
      resolve({ media_type: meta, data: result.slice(comma + 1) });
    };
    reader.onerror = () => reject(new Error("Không đọc được ảnh"));
    reader.readAsDataURL(file);
  });
}

export function HomeworkTutorPanel() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<TutorImage | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState<string | null>(null);
  // Câu trả lời HS điền vào các ô tương tác của lượt trợ giảng mới nhất (key = index của ô).
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // Lượt gửi gần nhất — để nút "Thử lại" gửi lại đúng nội dung đó khi gặp lỗi.
  const [lastSent, setLastSent] = useState<{
    text: string;
    image: TutorImage | null;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tự cuộn xuống cuối khi có tin nhắn mới / mỗi mảnh stream để luôn thấy câu trả lời mới nhất.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles]);

  const canSend = (input.trim().length > 0 || image !== null) && !pending;

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      setImage(await fileToImage(file));
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được ảnh");
    }
  }

  function clearImage() {
    setImage(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  // Lõi 1 lượt: historyBubbles KẾT THÚC bằng tin nhắn của học sinh cần trả lời; thêm 1 bong bóng
  // trợ lý rỗng rồi stream vào đó. Tách ra để nút "Thử lại" gửi lại KHÔNG nhân đôi tin nhắn HS.
  async function stream(historyBubbles: Bubble[], img: TutorImage | null) {
    setBubbles([...historyBubbles, { role: "assistant", content: "" }]);
    setError(null);
    setRateLimited(null);
    setAnswers({}); // lượt mới → xoá câu trả lời cũ của các ô
    setPending(true);

    const history: ChatMsg[] = historyBubbles.map((b) => ({
      role: b.role,
      content: b.content,
    }));
    let acc = "";
    await streamHomeworkTutor({
      messages: history,
      image: img,
      onDelta: (t) => {
        acc += t;
        setBubbles((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      },
      onDone: () => setPending(false),
      onError: (m) => {
        setError(m);
        setPending(false);
        // Gỡ bong bóng trợ lý rỗng, GIỮ tin nhắn HS để "Thử lại" dùng lại lịch sử.
        setBubbles((prev) => prev.slice(0, -1));
      },
      onRateLimited: (m) => {
        setRateLimited(m);
        setPending(false);
        setBubbles((prev) => prev.slice(0, -1));
      },
    });
  }

  async function send() {
    if (!canSend) return;
    const text =
      input.trim() || "Đây là bài tập của em, cô hướng dẫn giúp em nhé!";
    const img = image;
    setInput("");
    clearImage();
    setLastSent({ text, image: img });
    await stream([...bubbles, { role: "user", content: text }], img);
  }

  // Gửi câu trả lời gộp từ các ô tương tác (không kèm ảnh).
  async function submitAnswers(text: string) {
    setLastSent({ text, image: null });
    await stream([...bubbles, { role: "user", content: text }], null);
  }

  // Thử lại lượt gần nhất khi gặp lỗi: stream lại với lịch sử hiện tại (đã kết thúc bằng tin
  // nhắn HS vì bong bóng trợ lý rỗng đã được gỡ khi lỗi) — không thêm tin nhắn HS mới.
  function retryLast() {
    if (pending || lastSent === null) return;
    void stream(bubbles, lastSent.image);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-2 border-fun/40 bg-fun/5">
        <p className="text-sm">
          <strong>Cozzy hướng dẫn — không giải hộ nhé!</strong> Em dán đề bài
          hoặc tải ảnh chụp bài tập, Cozzy sẽ gợi ý từng bước để em tự làm được.
          💪
        </p>
      </Card>

      <Card className="p-5 border-2 space-y-4">
        {bubbles.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="text-sm rounded-full border-2 border-primary/30 px-3 py-1.5 hover:border-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="space-y-3 max-h-[50vh] overflow-y-auto pr-1"
          >
            {bubbles.map((b, i) => {
              // Tách token ô tương tác khỏi phần lời (chỉ với bong bóng trợ lý có nội dung).
              const parsed =
                b.role === "assistant" && b.content
                  ? parseHints(b.content)
                  : null;
              const isLast = i === bubbles.length - 1;
              return (
                <div
                  key={i}
                  className={
                    b.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <div
                    className={
                      b.role === "user"
                        ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap"
                        : "max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm"
                    }
                  >
                    {b.role === "user" ? (
                      b.content
                    ) : parsed ? (
                      // Trợ lý trả về markdown (tiêu đề, danh sách, in đậm) — render đúng thay vì thô.
                      <div className="text-sm leading-relaxed">
                        <ReactMarkdown components={MD_COMPONENTS}>
                          {parsed.prose}
                        </ReactMarkdown>
                        {isLast && !pending && parsed.fields.length > 0 && (
                          <TutorAnswerForm
                            fields={parsed.fields}
                            values={answers}
                            onChange={(idx, val) =>
                              setAnswers((a) => ({ ...a, [idx]: val }))
                            }
                            onSubmit={() =>
                              void submitAnswers(
                                buildAnswerMessage(parsed.fields, answers),
                              )
                            }
                            disabled={pending}
                          />
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Cozzy đang
                        nghĩ…
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {rateLimited && (
          <Card className="p-3 border-2 border-warning bg-warning/10 text-sm flex items-center gap-2">
            <Sparkles className="size-4 text-warning shrink-0" />
            <span>{rateLimited}</span>
          </Card>
        )}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 flex items-center justify-between gap-3">
            <span>{error}</span>
            {lastSent && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1"
                onClick={retryLast}
                disabled={pending}
              >
                <RotateCcw className="size-3.5" /> Thử lại
              </Button>
            )}
          </div>
        )}

        {preview && (
          <div className="relative inline-block">
            <img
              src={preview}
              alt="Ảnh bài tập"
              className="max-h-40 rounded-lg border-2"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1"
              aria-label="Xoá ảnh"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => onPickImage(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            aria-label="Tải ảnh bài tập"
          >
            <ImagePlus className="size-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Dán đề bài hoặc hỏi Cozzy…"
            rows={2}
            className="flex-1 resize-none"
            onKeyDown={(e) => {
              // Bỏ qua Enter khi bộ gõ tiếng Việt (IME) đang soạn — nếu không sẽ gửi sớm và
              // rớt lại ký tự đang gõ trong ô.
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button
            onClick={() => void send()}
            disabled={!canSend}
            className="shrink-0"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
