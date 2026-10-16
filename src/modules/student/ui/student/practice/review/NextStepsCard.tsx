/**
 * Yêu cầu 6 — hai lối đi tiếp sau khi nộp: luyện tiếp CHỦ ĐỀ VỪA LÀM (tạo phiên
 * mới cùng tham số) hoặc chuyển sang chủ đề khác (gợi ý theo chiều `content`).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { isEmbedded, postToNative } from "@/core/embed/bridge";
import {
  createPracticeSession,
  getPracticeSuggestions,
  type PracticeSuggestion,
  type SessionReview,
} from "@/modules/student/api/practiceApi";

export function NextStepsCard({ review }: { review: SessionReview }) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState<string | null>(null);

  const { data: suggestions } = useQuery<PracticeSuggestion[], Error>({
    queryKey: ["practice", "suggestions", "content", review.subject_code],
    queryFn: () => getPracticeSuggestions(review.subject_code, "content"),
    refetchOnWindowFocus: false,
  });

  async function start(key: string, ref: SessionReview["ref"]) {
    setStarting(key);
    try {
      const session = await createPracticeSession({
        mode: "practice",
        source: review.source,
        subject_code: review.subject_code,
        level: review.level,
        ...(ref ? { ref } : {}),
      });
      navigate(`/student/practice/session/${session.id}`);
    } catch {
      toast.error("Chưa tạo được phiên mới. Em thử lại nhé!");
    } finally {
      setStarting(null);
    }
  }

  return (
    <Card className="p-4 border-2 space-y-3">
      <h3 className="font-display font-bold flex items-center gap-2">
        <Sparkles className="size-4 text-fun" />
        Luyện tiếp
      </h3>

      <Button
        className="w-full gap-2 btn-pop"
        disabled={starting !== null}
        onClick={() => start("same", review.ref)}
      >
        {starting === "same" && <Loader2 className="size-4 animate-spin" />}
        {review.ref ? "Luyện tiếp chủ đề này" : "Luyện thêm một phiên nữa"}
        <ArrowRight className="size-4" />
      </Button>

      {(suggestions ?? []).slice(0, 3).map((s) => (
        <button
          key={s.key}
          type="button"
          disabled={starting !== null}
          onClick={() => start(s.key, s.ref as SessionReview["ref"])}
          className="w-full text-left rounded-xl border-2 border-border/60 p-3 hover:border-primary/60 disabled:opacity-60"
        >
          <div className="font-medium">{s.title}</div>
          <div className="text-xs text-muted-foreground">{s.reason_text}</div>
        </button>
      ))}

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() =>
            isEmbedded()
              ? postToNative({ type: "navigate", target: "practice" })
              : navigate("/student/practice")
          }
        >
          Xem tất cả chủ đề
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() =>
            isEmbedded()
              ? postToNative({ type: "navigate", target: "competency" })
              : navigate("/student/competency")
          }
        >
          Xem năng lực
        </Button>
      </div>
    </Card>
  );
}
