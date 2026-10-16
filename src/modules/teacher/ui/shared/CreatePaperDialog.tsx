import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Checkbox } from "@/core/ui/checkbox";
import { Database, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/core/lib/utils";
import { plainTextFromAuthoredMath } from "@/core/math/plainTextFromAuthoredMath";
import type { PaperKind } from "@/core/lib/paperKind";
import { KIND_LABEL } from "@/core/lib/paperKind";
import { useTeacherBank } from "@/modules/teacher/hooks/useTeacherBank";
import { useCreatePaper } from "@/modules/teacher/hooks/useTeacherPaper";
import type { TeacherQuestion } from "@/modules/teacher/api/teacherBankApi";
import { toLabel } from "@/modules/teacher/lib/questionDifficulty";

const SOURCE_LABEL: Record<TeacherQuestion["source"], string> = {
  personal: "Cá nhân",
  ai: "AI sinh",
  library: "Kho học liệu",
};

/**
 * PAPER-R2/R3: tạo đề/phiếu THẬT từ ngân hàng câu hỏi của giáo viên (cá nhân +
 * AI) VÀ từ kho học liệu dùng chung. Câu được BE snapshot lại lúc tạo — sửa
 * ngân hàng sau đó không đổi đề/phiếu.
 *
 * Kho học liệu chỉ nạp khi đã chọn môn + lớp: nó có hàng nghìn câu nên hỏi
 * trống phạm vi là vô nghĩa (backend cũng từ chối).
 */
export function CreatePaperDialog({
  open,
  onOpenChange,
  kind,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: PaperKind;
}) {
  const kindLabel = KIND_LABEL[kind];
  const isExam = kind === "exam";

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [duration, setDuration] = useState(20);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const personal = useTeacherBank("personal");
  const ai = useTeacherBank("ai");
  const library = useTeacherBank("library", { subject, level });
  const createPaper = useCreatePaper();

  const questions = useMemo<TeacherQuestion[]>(
    () => [...(personal.data ?? []), ...(ai.data ?? []), ...(library.data ?? [])],
    [personal.data, ai.data, library.data],
  );
  const loading = personal.isLoading || ai.isLoading || library.isLoading;
  const error = personal.error ?? ai.error ?? library.error;

  const reset = () => {
    setTitle("");
    setSubject("");
    setLevel("");
    setDuration(20);
    setSelectedIds([]);
  };
  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const canSubmit =
    title.trim().length > 0 && selectedIds.length > 0 && !createPaper.isPending;

  const submit = () => {
    if (title.trim().length === 0) {
      toast.error("Nhập tiêu đề đề/phiếu.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Chọn ít nhất 1 câu hỏi.");
      return;
    }
    createPaper.mutate(
      {
        kind,
        title: title.trim(),
        subject: subject.trim() || undefined,
        level: level.trim() || undefined,
        duration_minutes: isExam ? duration : null,
        question_ids: selectedIds,
      },
      {
        onSuccess: () => {
          toast.success("Đã tạo đề/phiếu.", {
            description: `${kindLabel} · ${selectedIds.length} câu`,
          });
          close();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            ➕ Tạo {kindLabel.toLowerCase()} thủ công
          </DialogTitle>
          <DialogDescription>
            Chọn câu hỏi từ ngân hàng của bạn (Cá nhân + AI) để tạo{" "}
            {kindLabel.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="paper-title">Tiêu đề</Label>
            <Input
              id="paper-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Ví dụ: ${kindLabel} tuần 1`}
              className="mt-1"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="paper-subject" className="text-xs">
                Môn (tuỳ chọn)
              </Label>
              <Input
                id="paper-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="paper-level" className="text-xs">
                Khối (tuỳ chọn)
              </Label>
              <Input
                id="paper-level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="mt-1"
              />
            </div>
            {isExam && (
              <div>
                <Label htmlFor="paper-duration" className="text-xs">
                  Thời gian (phút)
                </Label>
                <Input
                  id="paper-duration"
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block flex items-center gap-1.5">
              <Database className="size-4 text-info" />
              Chọn câu hỏi
              {selectedIds.length > 0 && (
                <span className="text-primary font-bold">
                  ({selectedIds.length} đã chọn)
                </span>
              )}
            </Label>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
                <Loader2 className="size-4 animate-spin" /> Đang tải ngân hàng…
              </div>
            ) : error ? (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                Không tải được ngân hàng câu hỏi. Thử lại sau.
              </div>
            ) : questions.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
                {subject && level
                  ? "Chưa có câu hỏi nào cho môn và lớp này. Thêm câu ở Ngân hàng câu hỏi, hoặc chọn môn/lớp khác."
                  : "Chọn môn và lớp để lấy câu từ Kho học liệu, hoặc thêm câu ở Ngân hàng câu hỏi."}
              </div>
            ) : (
              <div className="space-y-1 max-h-[320px] overflow-y-auto rounded-lg border p-2">
                {questions.map((q) => {
                  const active = selectedIds.includes(q.id);
                  return (
                    <label
                      key={q.id}
                      className={cn(
                        "flex items-start gap-2 text-sm cursor-pointer p-2 rounded-lg border-2 transition-all",
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <Checkbox
                        checked={active}
                        onCheckedChange={(v) =>
                          setSelectedIds((arr) =>
                            v ? [...arr, q.id] : arr.filter((x) => x !== q.id),
                          )
                        }
                        className="mt-0.5"
                      />
                      <span className="flex-1">{plainTextFromAuthoredMath(q.question_text)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-info/15 text-info whitespace-nowrap">
                        {SOURCE_LABEL[q.source]}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                        {toLabel(q.difficulty)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between mt-4 pt-3 border-t">
          <Button variant="outline" onClick={close}>
            Huỷ
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="bg-success hover:bg-success/90"
          >
            {createPaper.isPending ? (
              <Loader2 className="size-4 mr-1 animate-spin" />
            ) : (
              <Send className="size-4 mr-1" />
            )}
            Tạo {kindLabel.toLowerCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
