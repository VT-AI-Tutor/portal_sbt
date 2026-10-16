import { Button } from "@/core/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/core/ui/dialog";

export function UnansweredConfirmDialog({
  open,
  onOpenChange,
  count,
  onStay,
  onProceed,
  proceedLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  /** "Ở lại làm tiếp" — close + jump to first unanswered. */
  onStay: () => void;
  /** "Vẫn hoàn thành/Nộp bài" — close + proceed. */
  onProceed: () => void;
  proceedLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Còn câu chưa làm</DialogTitle>
          <DialogDescription>
            Em còn {count} câu chưa làm. Em muốn làm tiếp hay vẫn hoàn thành?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl font-semibold" onClick={onStay}>
            Ở lại làm tiếp
          </Button>
          <Button type="button" className="rounded-xl font-bold" onClick={onProceed}>
            {proceedLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
