/**
 * "Xem lời giải" → modal "Đáp án/ Gợi ý" cho câu ĐANG làm.
 *
 * Chỉ render khi câu có `payload.explanation` là RichContent có blocks. Với bài
 * chấm-server (SubmissionRunner) server đã lột explanation khỏi payload lúc đang
 * làm, nên nút mở modal này tự tắt — không lộ lời giải cho bài kiểm tra.
 */
import { Lightbulb } from "lucide-react";
import {
  ContentBlocksView,
  type RichContent,
} from "@/core/content/ContentBlocksView";
import { Button } from "@/core/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";

/** Lời giải RichContent của câu, hoặc null nếu không có gì để hiện. */
export function questionExplanation(payload: unknown): RichContent | null {
  const rich = (payload as { explanation?: RichContent } | null)?.explanation;
  return rich?.blocks?.length ? rich : null;
}

export function ExplanationDialog({
  open,
  onOpenChange,
  explanation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  explanation: RichContent;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10">
              <Lightbulb className="size-5 text-warning-foreground" />
            </span>
            <span className="text-lg font-bold text-success">Đáp án/ Gợi ý</span>
          </DialogTitle>
        </DialogHeader>

        <ContentBlocksView
          content={explanation}
          className="text-base md:text-lg leading-relaxed space-y-2"
        />

        <div className="mt-2 border-t border-dashed pt-4 flex justify-end">
          <Button
            type="button"
            className="rounded-xl font-bold px-6"
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
