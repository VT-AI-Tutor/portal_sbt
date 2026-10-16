/**
 * Popover "Câu hỏi cần rèn luyện" cho MỘT kiến thức cần nắm (KC) yếu.
 *
 * Được mở khi user click vào badge "Cần luyện lại" trên một KC yếu
 * (mastery < 0.85) trong danh sách KC của lesson. Popover hiển thị:
 *   - Tên KC yếu + tỉ lệ thông thạo
 *   - Danh sách câu hỏi thuộc RIÊNG KC đó (đã filter ở parent) để user
 *     biết cần rèn luyện những câu nào
 *
 * Data lấy từ `lesson.redoQuestions` (nhúng sẵn trong overview) — không
 * cần gọi thêm API. Parent filter theo kcId trước khi truyền vào.
 */
import { RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/ui/popover";
import type { RedoQuestion } from "@/modules/student-sbt/api/masteryApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const pct = (rate: number) => Math.round((rate ?? 0) * 100);

/**
 * Format số thứ tự câu hỏi để hiển thị.
 *
 * `question_index` trong DB là 0-based (0, 1, 2, ...). Khi hiển thị cho
 * user ta cần 1-based (Câu 1, Câu 2, ...). Một số bản ghi cũ có giá trị
 * không phải số nguyên (vd "0_2") — giữ nguyên trong trường hợp đó.
 */
function formatQuestionNum(code: string | null, id: string): string {
  if (code == null || code === "") return id;
  const n = Number(code);
  if (Number.isFinite(n) && Number.isInteger(n)) {
    return String(n + 1);
  }
  return code;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RedoQuestionItem({ q }: { q: RedoQuestion }) {
  const qNum = formatQuestionNum(q.questionCode, q.questionId);
  return (
    <li className="rounded-md border border-border/60 px-3 py-2 bg-card">
      <div className="text-xs text-foreground">
        <span className="font-bold text-primary">Câu {qNum}:</span>{" "}
        {q.name || "(Chưa có tên câu hỏi)"}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LessonRedoPopover({
  lessonName,
  kcName,
  redoQuestions,
}: {
  lessonName: string;
  kcName: string;
  redoQuestions: RedoQuestion[];
}) {
  const total = redoQuestions.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning hover:bg-warning/25 transition-colors cursor-pointer"
        >
          <Sparkles className="size-3" />
          Cần luyện lại
          {total > 0 && (
            <span className="ml-0.5 rounded-full bg-warning/30 px-1.5 text-[10px] font-bold">
              {total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 sm:w-[28rem] p-0"
        align="start"
        side="bottom"
      >
        <div className="p-3 border-b border-border/60 bg-gradient-to-br from-primary/5 to-warning/5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h4 className="font-display font-bold text-sm">
              Câu hỏi cần rèn luyện
            </h4>
            <Badge variant="secondary" className="ml-auto">
              {total} câu
            </Badge>
          </div>
          <div className="mt-1.5">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Kiến thức cần nắm
            </div>
            <div className="text-sm font-medium text-foreground line-clamp-2">
              {kcName}
            </div>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
            Thuộc bài: {lessonName}
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto p-3">
          {total === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Tuyệt vời! Em đã thông thạo kiến thức cần nắm này.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {redoQuestions.map((q) => (
                <RedoQuestionItem key={q.questionId} q={q} />
              ))}
            </ul>
          )}
        </div>

        {total > 0 && (
          <div className="p-2 border-t border-border/60 bg-muted/30">
            {/* TODO: link tới exercise player khi có route. Hiện tại chỉ là nút
                placeholder — bài tập thuộc lesson này có thể mở qua
                /hoc-sinh/bai-tap?lessonId=… */}
            <Button
              variant="outline"
              size="sm"
              disabled
              className="w-full"
              title="Tính năng đang phát triển"
            >
              <RefreshCw className="size-3.5 mr-1.5" /> Làm lại các câu này
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
