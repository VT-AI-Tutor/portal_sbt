import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { Input } from "@/core/ui/input";
import { useState } from "react";
import {
  Sparkles,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { callAIJson } from '@/modules/ai/application/ai-client';
import { toast } from "sonner";

type FCard = { front: string; back: string };

export function FlashcardsPanel() {
  const [topic, setTopic] = useState("Vòng tuần hoàn của nước");
  const [content, setContent] = useState("");
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<FCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  async function generate() {
    if (!topic.trim()) {
      toast.error("Em nhập chủ đề trước nhé!");
      return;
    }
    setLoading(true);
    setCards([]);
    setIdx(0);
    setFlipped(false);

    const { data, error } = await callAIJson<{ cards: FCard[] }>({
      system:
        "Bạn là gia sư cho học sinh tiểu học Việt Nam. Tạo flashcard ngắn gọn, dễ hiểu, đúng chương trình SGK. Mặt trước là câu hỏi/khái niệm, mặt sau là câu trả lời/giải thích ngắn (1-2 câu).",
      prompt: `Tạo ${count} flashcard về chủ đề: "${topic}".${content ? `\n\nNội dung tham khảo:\n${content}` : ""}`,
      tool: {
        name: "create_flashcards",
        description: "Tạo bộ flashcard học tập",
        parameters: {
          type: "object",
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  front: { type: "string" },
                  back: { type: "string" },
                },
                required: ["front", "back"],
              },
            },
          },
          required: ["cards"],
        },
      },
    });

    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (data?.cards?.length) {
      setCards(data.cards);
      toast.success(`Đã tạo ${data.cards.length} flashcard! 🎉`);
    } else {
      toast.error("Không nhận được flashcard, em thử lại nhé.");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 border-2 space-y-4">
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground mb-1 block">
            Chủ đề
          </label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="VD: Vòng tuần hoàn của nước"
            className="text-base"
          />
        </div>
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground mb-1 block">
            Nội dung tham khảo (tùy chọn)
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Dán đoạn văn trong sách, ghi chú học tập..."
            rows={4}
          />
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs uppercase font-bold text-muted-foreground mb-1 block">
              Số thẻ
            </label>
            <Input
              type="number"
              min={3}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <Button
            onClick={generate}
            disabled={loading}
            className="btn-pop rounded-full px-6 h-11"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 mr-1 animate-spin" /> Đang tạo...
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-1" /> Tạo flashcard
              </>
            )}
          </Button>
        </div>
      </Card>

      {cards.length > 0 && (
        <div className="space-y-4 animate-pop-in">
          <div className="text-sm text-muted-foreground text-center">
            Thẻ {idx + 1} / {cards.length}
          </div>
          <button
            onClick={() => setFlipped((f) => !f)}
            className="w-full"
            aria-label="Lật thẻ"
          >
            <Card
              className={`relative min-h-[260px] p-8 border-2 transition-all duration-300 cursor-pointer flex items-center justify-center text-center ${flipped ? "bg-success/10 border-success" : "bg-gradient-to-br from-primary/10 to-fun/10 border-primary"}`}
            >
              <div>
                <div className="text-xs uppercase font-bold text-muted-foreground mb-3">
                  {flipped ? "Đáp án" : "Câu hỏi"}
                </div>
                <div className="text-xl md:text-2xl font-display font-bold leading-relaxed">
                  {flipped ? cards[idx].back : cards[idx].front}
                </div>
                <div className="mt-6 text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <RotateCw className="size-3" /> Bấm để lật
                </div>
              </div>
            </Card>
          </button>
          <div className="flex justify-between items-center gap-3">
            <Button
              variant="outline"
              disabled={idx === 0}
              onClick={() => {
                setIdx((i) => Math.max(0, i - 1));
                setFlipped(false);
              }}
              className="rounded-full"
            >
              <ChevronLeft className="size-4 mr-1" /> Trước
            </Button>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-success transition-all"
                style={{ width: `${((idx + 1) / cards.length) * 100}%` }}
              />
            </div>
            <Button
              disabled={idx === cards.length - 1}
              onClick={() => {
                setIdx((i) => Math.min(cards.length - 1, i + 1));
                setFlipped(false);
              }}
              className="rounded-full btn-pop"
            >
              Tiếp <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
