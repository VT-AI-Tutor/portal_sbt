import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { useState, useRef, useEffect } from "react";
import { Loader2, Bot, User, Send } from "lucide-react";
import { streamChat, type ChatMsg } from '@/modules/ai/application/ai-client';
import ReactMarkdown from "react-markdown";

const SYSTEM = `Bạn là trợ lý AI cho giáo viên tiểu học Việt Nam, am hiểu chương trình GDPT 2018 và phương pháp dạy tích cực.
Trả lời:
- Bằng tiếng Việt rõ ràng, súc tích.
- Có ví dụ cụ thể khi giải thích phương pháp.
- Luôn bám sát đối tượng học sinh tiểu học (lớp 1-5).
- Khi được hỏi tài liệu/giáo án, hãy đề xuất cấu trúc và hoạt động cụ thể.
Có thể dùng markdown (đầu mục, bảng) để dễ đọc.`;

const STARTERS = [
  "Gợi ý hoạt động khởi động sôi nổi cho bài 'Tính chất của nước' lớp 4",
  "Học sinh khó hiểu phép chia có dư, cô nên dạy thế nào?",
  "Soạn giáo án 5E cho bài 'Vòng tuần hoàn của nước'",
  "Cách phân loại học sinh theo năng lực để giao bài phù hợp",
];

export function AssistantPanel() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: ChatMsg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    let acc = "";
    await streamChat({
      messages: next,
      system: SYSTEM,
      onDelta: (chunk) => {
        acc += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: acc } : m,
            );
          }
          return [...prev, { role: "assistant", content: acc }];
        });
      },
      onError: (msg) =>
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ ${msg}` },
        ]),
      onDone: () => setLoading(false),
    });
    setLoading(false);
  }

  return (
    <Card className="border-2 flex flex-col overflow-hidden h-[70vh]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="size-16 rounded-2xl bg-fun/15 text-fun flex items-center justify-center mb-4">
              <Bot className="size-8" />
            </div>
            <div className="font-display text-xl font-bold mb-1">
              Cô có thể hỏi tôi bất cứ điều gì
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Một vài gợi ý để bắt đầu:
            </p>
            <div className="grid sm:grid-cols-2 gap-2 max-w-2xl">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm p-3 rounded-xl border-2 border-dashed hover:border-primary hover:bg-primary/5 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}
          >
            {m.role === "assistant" && (
              <div className="size-8 rounded-full bg-fun/15 text-fun flex items-center justify-center shrink-0">
                <Bot className="size-4" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-headings:font-display prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                  <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
              )}
            </div>
            {m.role === "user" && (
              <div className="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <User className="size-4" />
              </div>
            )}
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="size-8 rounded-full bg-fun/15 text-fun flex items-center justify-center">
              <Bot className="size-4" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-3">
              <Loader2 className="size-4 animate-spin" />
            </div>
          </div>
        )}
      </div>
      <div className="border-t p-3 bg-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 items-end"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Nhập câu hỏi... (Shift+Enter để xuống dòng)"
            rows={1}
            className="resize-none min-h-[44px] max-h-32"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-pop rounded-full size-11 p-0 shrink-0"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}
