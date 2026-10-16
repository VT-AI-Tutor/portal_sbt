import { useEffect, useMemo, useState } from "react";
import { RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/core/ui/dialog";
import { StandaloneExerciseRunner } from "@/modules/books/ui/shared/StandaloneExerciseRunner";
import type { PlayerQuestion } from "@/core/exercise/QuestionPlayer";
import { DigitizedExercisePassDialog } from "./DigitizedExercisePassDialog";
import {
  assetUrl,
  getDigitizedLesson,
} from "../api/loader";
import type { DigitizedLesson } from "../api/types";

interface DigitizedExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookCode: string;
  lessonCode: string;
  /**
   * BỎ QUA bước nhập mật khẩu — mở thẳng runner. Dùng khi caller đã xác thực
   * pass ở dialog riêng (vd BookDetailPage: pass dialog → danh sách bài inline
   * → click bài → runner dialog).
   */
  skipPass?: boolean;
}

/**
 * Dialog làm bài tập nâng cao cho nội dung tự số hóa — thay cho trang riêng.
 *
 * Luồng:
 *  1. Mở dialog → hiện form nhập mật khẩu (DigitizedExercisePassDialog).
 *  2. Nhập đúng → đổi sang dialog runner (StandaloneExerciseRunner).
 *  3. Nhập sai → cho nhập lại (giữ nguyên dialog pass).
 *  4. Đóng dialog (nút X hoặc Thoát trong runner) → về trang sách.
 *
 * Hai Dialog Radix UI riêng biệt vì Radix không cho phép 2 DialogContent
 * trong cùng 1 Dialog root. Mỗi lần mount (chuyển bài, đóng/mở lại) phải
 * nhập lại pass — không nhớ.
 */
export function DigitizedExerciseDialog({
  open,
  onOpenChange,
  bookCode,
  lessonCode,
  skipPass = false,
}: DigitizedExerciseDialogProps) {
  const [unlocked, setUnlocked] = useState(skipPass);
  const [lesson, setLesson] = useState<DigitizedLesson | null>(null);
  const [loading, setLoading] = useState(false);

  // Khoá lại + reset mỗi khi đổi bài hoặc đóng dialog.
  useEffect(() => {
    if (!open) {
      setUnlocked(skipPass);
      setLesson(null);
      return;
    }
    setUnlocked(skipPass);
    setLesson(null);
    setLoading(true);
    let cancelled = false;
    getDigitizedLesson(bookCode, lessonCode).then((l) => {
      if (cancelled) return;
      setLesson(l);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, bookCode, lessonCode, skipPass]);

  const questions: PlayerQuestion[] = useMemo(() => {
    if (!lesson) return [];
    const all: PlayerQuestion[] = [];
    for (const item of lesson.lesson_items) {
      for (const q of item.questions) {
        all.push({
          id: q.id,
          question_type: q.question_type,
          payload: rewriteAssetUrls(q.payload, bookCode),
        });
      }
    }
    return all;
  }, [lesson, bookCode]);

  // Dialog pass: mở khi chưa unlock.
  if (!unlocked) {
    return (
      <DigitizedExercisePassDialog
        open={open}
        onOpenChange={onOpenChange}
        onVerified={() => setUnlocked(true)}
      />
    );
  }

  // Dialog runner: full-screen, ẩn nút X (runner có nút Thoát riêng).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="w-screen h-screen max-w-none max-h-none p-0 gap-0 overflow-hidden flex flex-col rounded-none border-0 left-0 top-0 translate-x-0 translate-y-0"
        // Lightbox ảnh portal ra `document.body` nên Radix thấy "outside" và
        // đóng dialog khi user click vào lightbox. Chặn ở đây: nếu pointerdown
        // outside mà target nằm trong lightbox thì KHÔNG đóng dialog — lightbox
        // tự xử lý onClick riêng để đóng chính nó.
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-testid="image-lightbox"]')) {
            event.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">
          {lesson?.title ?? "Bài tập nâng cao"}
        </DialogTitle>
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <RotateCw className="size-8 animate-spin text-primary" />
          </div>
        ) : !lesson ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Không tìm thấy bài học.
          </div>
        ) : questions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Bài học này chưa có câu hỏi nào trong content.json.
          </div>
        ) : (
          <StandaloneExerciseRunner
            key={`${bookCode}:${lessonCode}`}
            lessonTitle={lesson.title}
            questions={questions}
            onExit={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Payload trong content.json có thể chứa `imageUrl` / `url` dạng tương đối
 * ("assets/images/x.png"). Đổi sang URL tuyệt đối /digitized-content/<book>/...
 * để trình duyệt load được từ public/.
 */
function rewriteAssetUrls(
  payload: Record<string, unknown>,
  bookCode: string,
): Record<string, unknown> {
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") {
      return assetUrl(bookCode, value);
    }
    if (Array.isArray(value)) {
      return value.map(visit);
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = visit(v);
      }
      return out;
    }
    return value;
  };
  return visit(payload) as Record<string, unknown>;
}
