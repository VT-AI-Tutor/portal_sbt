/**
 * Duyệt/sửa MỘT hoạt động của bài giảng — 1/4 khối của LectureFlow.
 *
 * Component THUẦN HIỂN THỊ: giữ bản nháp sửa tay cục bộ (blocks/slides), báo
 * lên qua `onRegenerate`/`onSave`, KHÔNG tự gọi API. LectureFlow là nơi thực
 * hiện lệnh gọi và cập nhật `lecture` — tách vậy để test được mà không phải
 * giả lập mạng.
 *
 * Bản nháp cục bộ reset theo khuôn "reset = remount" của repo (xem
 * exercise players): cha (LectureFlow) phải KEY component này theo
 * `generated_at`/`edited_at` của section để bản sửa cũ không dính lại sau khi
 * sinh lại/lưu xong.
 */
import { useState } from "react";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Loader2, RefreshCw, Save } from "lucide-react";
import type {
  LectureBlock,
  LectureSection,
  LectureSectionKey,
  LectureSlide,
} from "@/modules/teacher/api/teacherLectureApi";

const BLOCK_TYPE_LABEL: Record<LectureBlock["type"], string> = {
  heading: "Tiêu đề",
  text: "Văn bản",
  formula: "Công thức",
  example: "Ví dụ",
};

const SLIDE_LAYOUT_LABEL: Record<LectureSlide["layout"], string> = {
  title: "Trang tiêu đề",
  bullets: "Gạch đầu dòng",
  text: "Văn bản",
  example: "Ví dụ",
};

/** Có ký tự riêng của tiếng Việt không — đủ để phân biệt thông điệp lỗi mạng
 * tiếng Anh (rò từ tầng fetch, phát hiện ở review Task 12) khỏi thông điệp
 * tiếng Việt thật của dây chuyền/máy chủ. */
const VIETNAMESE_CHARS =
  /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i;

const FALLBACK_ERROR_MESSAGE =
  "Không sinh được hoạt động này. Thầy cô thử lại nhé!";

function toDisplayError(raw: string): string {
  return VIETNAMESE_CHARS.test(raw) ? raw : FALLBACK_ERROR_MESSAGE;
}

export interface LectureSectionReviewProps {
  section: LectureSection;
  /** Thông điệp lỗi thô từ `sectionErrors[key]` — có thể là tiếng Anh (lỗi mạng). */
  errorMessage?: string;
  regenerating?: boolean;
  saving?: boolean;
  onRegenerate: (key: LectureSectionKey) => void;
  onSave: (
    key: LectureSectionKey,
    input: { blocks: LectureBlock[]; slides: LectureSlide[] },
  ) => void;
}

export function LectureSectionReview({
  section,
  errorMessage,
  regenerating,
  saving,
  onRegenerate,
  onSave,
}: LectureSectionReviewProps) {
  const [blocks, setBlocks] = useState<LectureBlock[]>(section.blocks);
  const [slides, setSlides] = useState<LectureSlide[]>(section.slides);

  const updateBlock = (index: number, content: string) =>
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, content } : b)),
    );

  const updateSlide = (index: number, patch: Partial<LectureSlide>) =>
    setSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );

  return (
    <Card className="p-4 border-2 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg">{section.title}</h3>
          {section.objective && (
            <p className="text-sm text-muted-foreground">{section.objective}</p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={regenerating}
          onClick={() => onRegenerate(section.key)}
        >
          {regenerating ? (
            <Loader2 className="size-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="size-4 mr-1" />
          )}
          Sinh lại phần này
        </Button>
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-2">
          {toDisplayError(errorMessage)}
        </p>
      )}

      {blocks.length > 0 && (
        <div className="space-y-2">
          {blocks.map((block, i) => (
            <div key={i} className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {BLOCK_TYPE_LABEL[block.type]}
              </span>
              <Textarea
                value={block.content}
                onChange={(e) => updateBlock(i, e.target.value)}
                rows={block.type === "text" ? 3 : 2}
              />
            </div>
          ))}
        </div>
      )}

      {slides.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Slide trình chiếu</h4>
          {slides.map((slide, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                {SLIDE_LAYOUT_LABEL[slide.layout]}
              </span>
              <Input
                value={slide.title}
                onChange={(e) => updateSlide(i, { title: e.target.value })}
                placeholder="Tiêu đề slide"
              />
              {slide.bullets && (
                <Textarea
                  value={slide.bullets.join("\n")}
                  onChange={(e) =>
                    updateSlide(i, { bullets: e.target.value.split("\n") })
                  }
                  rows={3}
                  placeholder="Mỗi dòng một gạch đầu dòng"
                />
              )}
              {slide.content !== undefined && (
                <Textarea
                  value={slide.content}
                  onChange={(e) => updateSlide(i, { content: e.target.value })}
                  rows={2}
                />
              )}
              <Textarea
                value={slide.notes ?? ""}
                onChange={(e) => updateSlide(i, { notes: e.target.value })}
                rows={2}
                placeholder="Ghi chú cho giáo viên (không hiện với học sinh)"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {section.question_ids.length > 0
            ? `${section.question_ids.length} câu hỏi trắc nghiệm đã gắn`
            : "Chưa có câu hỏi trắc nghiệm"}
        </span>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => onSave(section.key, { blocks, slides })}
        >
          {saving ? (
            <Loader2 className="size-4 mr-1 animate-spin" />
          ) : (
            <Save className="size-4 mr-1" />
          )}
          Lưu phần này
        </Button>
      </div>
    </Card>
  );
}
