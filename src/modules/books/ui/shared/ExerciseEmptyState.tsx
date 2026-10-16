import { ListChecks } from "lucide-react";
import { Button } from "@/core/ui/button";

/** `onClose` tuỳ chọn: khu /student đã có nút quay lại nằm ngoài runner. */
export function ExerciseEmptyState({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[280px] p-6 gap-3 text-center">
      <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
        <ListChecks className="size-8 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">
        Bài này chưa có câu hỏi
      </p>
      <p className="text-sm text-muted-foreground max-w-sm">
        Không tìm thấy câu hỏi nào cho bài tập này. Vui lòng quay lại và chọn
        bài khác.
      </p>
      {onClose && (
        <Button
          type="button"
          variant="outline"
          className="mt-1 rounded-full"
          onClick={onClose}
        >
          Đóng
        </Button>
      )}
    </div>
  );
}
