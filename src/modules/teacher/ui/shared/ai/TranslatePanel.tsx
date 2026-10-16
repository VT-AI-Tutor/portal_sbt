import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { useState } from "react";
import { Loader2, Languages, Copy, Check } from "lucide-react";
import { streamChat } from '@/modules/ai/application/ai-client';
import { toast } from "sonner";

const LANGS = [
  { id: "en", label: "🇬🇧 Tiếng Anh", desc: "Bilingual song ngữ" },
  { id: "zh", label: "🇨🇳 Tiếng Trung", desc: "Hỗ trợ HS gốc Hoa" },
  { id: "km", label: "🇰🇭 Khmer", desc: "Đồng bào Khmer Nam Bộ" },
  { id: "tay", label: "🌾 Tày", desc: "Vùng cao phía Bắc" },
  { id: "hmong", label: "🏔️ H'Mông", desc: "Vùng núi cao" },
  { id: "simple", label: "🧒 Tiếng Việt đơn giản", desc: "Cho HS yếu" },
];

export function TranslatePanel() {
  const [src, setSrc] = useState("");
  const [target, setTarget] = useState("en");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function translate() {
    if (!src.trim()) {
      toast.error("Cô nhập nội dung cần dịch trước nhé!");
      return;
    }
    setLoading(true);
    setOut("");
    const lang = LANGS.find((l) => l.id === target)!;

    const system =
      target === "simple"
        ? "Bạn là giáo viên tiểu học. Hãy diễn đạt lại nội dung sau bằng tiếng Việt thật đơn giản, ngắn gọn để học sinh yếu/HS lớp 1-2 dễ hiểu. Dùng câu ngắn, từ thông dụng, có thể thêm ví dụ trực quan."
        : `Bạn là biên dịch viên giáo dục. Hãy dịch nội dung tiếng Việt sang ${lang.label}.
- Giữ nguyên ý nghĩa giáo dục.
- Phù hợp cho học sinh tiểu học.
- Nếu là bài tập, giữ nguyên cấu trúc câu hỏi/đáp án.
- Trình bày song song: đoạn dịch trước, sau đó dòng "📖 Phiên âm/giải thích" nếu cần.
- Chỉ trả về phần đã dịch, không thêm lời mở đầu.`;

    let acc = "";
    await streamChat({
      messages: [{ role: "user", content: src }],
      system,
      onDelta: (chunk) => {
        acc += chunk;
        setOut(acc);
      },
      onError: (msg) => toast.error(msg),
      onDone: () => setLoading(false),
    });
    setLoading(false);
  }

  function copy() {
    navigator.clipboard.writeText(out);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-5">
      <Card className="p-4 border-2">
        <div className="text-xs uppercase font-bold text-muted-foreground mb-2">
          Chọn ngôn ngữ đích
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => setTarget(l.id)}
              className={`text-left p-3 rounded-xl border-2 transition ${target === l.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
            >
              <div className="font-bold text-sm">{l.label}</div>
              <div className="text-xs text-muted-foreground">{l.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 border-2">
          <div className="text-xs uppercase font-bold text-muted-foreground mb-2">
            🇻🇳 Tiếng Việt (gốc)
          </div>
          <Textarea
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder="Dán nội dung bài tập, hướng dẫn..."
            rows={12}
            className="text-base"
          />
          <Button
            onClick={translate}
            disabled={loading}
            className="btn-pop rounded-full mt-3 w-full"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 mr-1 animate-spin" /> Đang dịch...
              </>
            ) : (
              <>
                <Languages className="size-4 mr-1" /> Dịch ngay
              </>
            )}
          </Button>
        </Card>

        <Card className="p-4 border-2 bg-info/5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase font-bold text-info">
              {LANGS.find((l) => l.id === target)?.label}
            </div>
            {out && (
              <Button size="sm" variant="ghost" onClick={copy} className="h-7">
                {copied ? (
                  <>
                    <Check className="size-3 mr-1" /> Đã copy
                  </>
                ) : (
                  <>
                    <Copy className="size-3 mr-1" /> Copy
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="min-h-[280px] whitespace-pre-wrap text-base leading-relaxed">
            {out || (
              <span className="text-muted-foreground italic">
                Bản dịch sẽ hiển thị ở đây...
              </span>
            )}
            {loading && (
              <span className="inline-block w-1 h-4 bg-info animate-pulse ml-0.5" />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
