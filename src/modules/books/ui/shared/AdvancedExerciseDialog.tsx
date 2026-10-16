import { useEffect, useMemo, useState } from "react";
import { RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/core/ui/dialog";
import { StandaloneExerciseRunner } from "@/modules/books/ui/shared/StandaloneExerciseRunner";
import type { PlayerQuestion } from "@/core/exercise/QuestionPlayer";
import { DigitizedExercisePassDialog } from "@/modules/digitized-content/ui/DigitizedExercisePassDialog";
import { useCatalogBookLesson } from "@/modules/catalog/hooks/useCatalog";
import { resolveQuestionType } from "@/core/exercise/questionType";
import { resolveAssetUrl } from "@/core/content/assetUrl";
import type { BookLessonDetail } from "@/core/api/catalogTypes";

interface AdvancedExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookCode: string;
  lessonCode: string;
  /**
   * Dữ liệu bài học nâng cao đã fetch sẵn từ caller.
   *
   * - Có truyền (vd `BookLessonPage` đã gọi `useCatalogBookLesson(..., true)`
   *   để check `hasAdvanced`): dialog dùng data này, KHÔNG gọi API lại.
   * - Không truyền (vd `BookDetailPage` chỉ lấy `chapterAdvanced` từ
   *   `useCatalogBook`, không fetch từng bài): dialog tự gọi
   *   `useCatalogBookLesson(..., true)` on-demand khi user click bài.
   */
  lessonData?: BookLessonDetail;
  /**
   * BỎ QUA bước nhập mật khẩu — mở thẳng runner. Dùng khi caller đã xác thực
   * pass ở dialog riêng (vd BookLessonPage: pass dialog → runner dialog).
   */
  skipPass?: boolean;
}

/**
 * Dialog làm bài tập nâng cao — lấy câu hỏi từ API
 * `GET /api/lcms/book-excercise/public/detail/{lessonId}?is_advanced=true`
 * thay vì đọc `public/digitized-content/<bookId>/content.json` (luồng cũ).
 *
 * Luồng:
 *  1. Mở dialog → hiện form nhập mật khẩu (DigitizedExercisePassDialog).
 *  2. Nhập đúng → đổi sang dialog runner (StandaloneExerciseRunner).
 *  3. Đóng dialog (nút X hoặc Thoát trong runner) → về trang bài học.
 *
 * Hai Dialog Radix UI riêng biệt vì Radix không cho phép 2 DialogContent
 * trong cùng 1 Dialog root. Mỗi lần mount (chuyển bài, đóng/mở lại) phải
 * nhập lại pass — không nhớ.
 *
 * Tách riêng DigitizedExerciseDialog (vẫn dùng cho BookDetailPage) vì
 * BookDetailPage vẫn chạy flow JSON cũ — sửa chung sẽ phá luồng đó.
 */
export function AdvancedExerciseDialog({
  open,
  onOpenChange,
  bookCode,
  lessonCode,
  lessonData,
  skipPass = false,
}: AdvancedExerciseDialogProps) {
  const [unlocked, setUnlocked] = useState(skipPass);

  // Khoá lại + reset mỗi khi đổi bài hoặc đóng dialog.
  useEffect(() => {
    if (!open) {
      setUnlocked(skipPass);
      return;
    }
    setUnlocked(skipPass);
  }, [open, bookCode, lessonCode, skipPass]);

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
        className="w-screen h-[100svh] max-w-none max-h-none p-0 gap-0 overflow-hidden flex flex-col rounded-none border-0 left-0 top-0 translate-x-0 translate-y-0"
        // Lightbox ảnh portal ra `document.body` nên Radix thấy "outside" và
        // đóng dialog khi user click vào/ra khỏi lightbox. Chặn ở đây: nếu
        // pointerdown outside mà event bubble qua lightbox thì KHÔNG đóng
        // dialog — lightbox tự xử lý onClick riêng để đóng chính nó.
        //
        // Dùng `composedPath()` thay vì `target.closest()`: khi user click nút
        // ✕ của lightbox, React unmount lightbox ngay trong cùng tick → target
        // đã bị remove khỏi DOM trước khi Radix xử lý event, `closest()` trả
        // null và dialog đóng luôn. `composedPath()` trả path của event kể cả
        // khi element đã unmount — chặn được race condition này.
        onPointerDownOutside={(event) => {
          const path = event.composedPath();
          if (
            path.some(
              (node) =>
                node instanceof HTMLElement &&
                node.dataset?.testid === "image-lightbox",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">Bài tập nâng cao</DialogTitle>
        <AdvancedRunnerContent
          bookCode={bookCode}
          lessonCode={lessonCode}
          lessonData={lessonData}
          onExit={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Phần nội dung runner — nhận `lessonData` qua props (đã fetch ở caller) HOẶC
 * tự gọi `useCatalogBookLesson(..., true)` on-demand khi caller không truyền.
 *
 * Hai luồng:
 * - Có `lessonData` (vd `BookLessonPage` đã fetch sẵn để check `hasAdvanced`):
 *   dùng data, KHÔNG gọi API lại — tránh call lặp vì `staleTime: 0`.
 * - Không có `lessonData` (vd `BookDetailPage` chỉ lấy `chapterAdvanced`):
 *   tự fetch khi user click bài.
 */
function AdvancedRunnerContent({
  bookCode,
  lessonCode,
  lessonData: provided,
  onExit,
}: {
  bookCode: string;
  lessonCode: string;
  lessonData?: BookLessonDetail;
  onExit: () => void;
}) {
  // Chỉ fetch khi caller không truyền data. `enabled: provided == null` đảm bảo
  // không gọi API thừa khi đã có data sẵn.
  const { data: fetched, isLoading, isError } = useCatalogBookLesson(
    bookCode,
    lessonCode,
    true, // isAdvanced
    provided == null, // enabled
  );
  const data = provided ?? fetched;

  const questions: PlayerQuestion[] = useMemo(() => {
    if (!data) return [];
    const all: PlayerQuestion[] = [];
    for (const item of data.lesson.lesson_items ?? []) {
      for (const q of item.questions) {
        all.push({
          id: q.id,
          question_type: resolveQuestionType(q.type, q.payload),
          payload: rewriteAssetUrls(q.payload),
        });
      }
    }
    return all;
  }, [data]);

  if (provided == null && isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RotateCw className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (provided == null && (isError || !data)) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Không tìm thấy bài học.
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Bài học này chưa có câu hỏi nâng cao.
      </div>
    );
  }

  return (
    <StandaloneExerciseRunner
      key={`${bookCode}:${lessonCode}`}
      lessonTitle={data!.lesson.title}
      questions={questions}
      onExit={onExit}
    />
  );
}

/**
 * Payload từ API có thể chứa `imageUrl` / `url` dạng tương đối
 * ("assets/images/x.png"). Đổi sang URL tuyệt đối qua `resolveAssetUrl` để
 * trình duyệt load được. URL tuyệt đối (http(s)://, data:, /) giữ nguyên.
 */
function rewriteAssetUrls(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") {
      return resolveAssetUrl(value);
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
