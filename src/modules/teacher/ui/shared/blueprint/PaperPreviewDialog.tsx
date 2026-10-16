import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import { QuestionPlayer } from "@/core/exercise/QuestionPlayer";
import { KIND_LABEL, type PaperKind } from "@/core/lib/paperKind";
import type { QuestionOption } from "@/core/api/assessmentTypes";
import { mapBackendQuestion } from "@/modules/books/ui/shared/mapBackendQuestion";
import type { DraftItem } from "@/modules/teacher/lib/blueprintDraft";

/**
 * XEM THỬ đề bằng ĐÚNG bộ player học sinh sẽ thấy, trước khi lưu và giao.
 *
 * Hôm nay giáo viên giao "mù" — chỉ thấy danh sách chữ, và câu vỡ khuôn hiển
 * thị chỉ lộ ra khi nó đã tới tay lớp. Ở đây câu được dựng thật, khoá thao tác
 * (`disabled`) chứ không phải "đã nộp": đây là xem trước, không phải bài làm
 * xong.
 *
 * Đáp án KHÔNG có trong bản nháp (máy chủ đã lược đi) nên xem thử hiện đúng
 * những gì học sinh nhìn thấy lúc mở đề.
 *
 * Dùng CHÍNH `mapBackendQuestion` mà runner của học sinh đang dùng, không tự
 * ghép payload: payload rút gọn của câu ngân hàng chở options là chuỗi thuần và
 * KHÔNG chở đề bài, nên đưa thẳng vào player thì đề trống trơn còn phương án
 * rỗng — đúng cái bẫy mà bộ chuyển đó đã ghi lại và xử lý sẵn.
 */
/**
 * Phương án của câu ngân hàng có hai hình dạng cùng tồn tại: chuỗi thuần
 * (`"2/4"`) và đối tượng (`{id, content}`). Đưa cả hai về một khuôn để bộ
 * chuyển không phải đoán.
 */
function toOption(option: unknown, index: number): QuestionOption {
  if (option !== null && typeof option === "object") {
    const o = option as { id?: unknown; content?: unknown };
    return {
      id: String(o.id ?? index),
      content: typeof o.content === "string" ? o.content : String(o.content ?? ""),
    };
  }
  return { id: String(index), content: String(option ?? "") };
}

export function PaperPreviewDialog({
  open,
  onOpenChange,
  title,
  kind,
  durationMinutes,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  kind: PaperKind;
  durationMinutes: number | null;
  items: DraftItem[];
}) {
  const totalPoints = items.reduce((s, q) => s + q.points, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            👁️ Xem thử — {title || KIND_LABEL[kind]}
          </DialogTitle>
          <DialogDescription>
            {[
              KIND_LABEL[kind],
              `${items.length} câu`,
              kind === "exam" ? `${totalPoints} điểm` : null,
              durationMinutes ? `${durationMinutes} phút` : null,
            ]
              .filter(Boolean)
              .join(" · ")}{" "}
            — đây đúng là những gì học sinh nhìn thấy khi mở đề.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-xl border-2 p-3">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-muted-foreground">
                  Câu {index + 1}
                </span>
                {kind === "exam" && (
                  <span className="text-xs text-muted-foreground">
                    {item.points} điểm
                  </span>
                )}
              </div>
              <QuestionPlayer
                question={mapBackendQuestion({
                  id: item.id,
                  type: item.question_type,
                  content: item.question_text,
                  options: item.options.map((opt, i) => toOption(opt, i)),
                  payload: item.payload,
                })}
                index={index}
                disabled
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
