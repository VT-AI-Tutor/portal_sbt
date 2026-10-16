/**
 * Gắn bài giảng ĐÃ HOÀN TẤT vào một tiết của lớp — Việc 2 (lát "gắn liên kết
 * bài giảng"): POST /api/v1/teacher/lectures/{id}/attach, đường RIÊNG cho bài
 * giảng (`teacherLectureApi.attach`) — KHÔNG còn dùng chung
 * `POST /classes/{id}/materials` (`attachMaterial`) của học liệu lớp nói
 * chung. KHÔNG truyền `material_type` — máy chủ tự điền 'lecture', đúng ý đồ
 * hợp đồng mới (client không gõ sai được).
 *
 * Mở được từ hai chỗ: LectureFlow ngay sau khi Hoàn tất, và TeacherLecturesPage
 * cho bài giảng cũ đã 'ready' muốn gắn thêm lớp khác.
 *
 * Đổ SẴN `class_context` (lớp/tiết chọn LÚC SOẠN, trường tuỳ chọn) làm giá
 * trị mặc định cho form — vẫn là tiện ích hợp lý (đỡ chọn lại nếu gắn đúng
 * lớp lúc soạn), nhưng KHÔNG còn liên quan gì tới việc mở khoá nút "Tiến độ"
 * nữa: nút đó nay chỉ cần bài giảng `ready` (xem TeacherLecturesPage), và
 * `LectureProgressDialog` tự hỏi `GET /links` — nguồn sự thật thật sự — mỗi
 * lần mở, không còn dựa vào `class_context` hay bất kỳ cache nào ở đây.
 *
 * Lỗi từ máy chủ (404/409/403/422) đã kèm sẵn `message` tiếng Việt đúng ca
 * (xem TeacherLectureController::attach) — hiện thẳng qua toast, không cần tự
 * suy diễn lại theo mã lỗi.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/ui/select";
import { CalendarClock, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useTeacherClasses } from "@/modules/teacher/hooks/useTeacherClasses";
import {
  useAttachLectureMaterial,
  useClassSessions,
} from "@/modules/teacher/hooks/useTeacherLectures";
import type { TeacherLecture } from "@/modules/teacher/api/teacherLectureApi";

export interface LectureAttachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lecture: TeacherLecture;
}

/** datetime-local ("yyyy-MM-ddTHH:mm") → ISO cho `release_at`; rỗng → undefined
 * (khuôn `toLocalInput`/ISO của SessionsTab.tsx, chiều ngược lại). */
function toIsoOrUndefined(localValue: string): string | undefined {
  if (!localValue.trim()) return undefined;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function LectureAttachDialog({
  open,
  onOpenChange,
  lecture,
}: LectureAttachDialogProps) {
  const [classId, setClassId] = useState(
    lecture.class_context?.class_id ?? "",
  );
  const [sessionId, setSessionId] = useState(
    lecture.class_context?.session_id ?? "",
  );
  const [releaseAt, setReleaseAt] = useState("");

  const classes = useTeacherClasses();
  const sessions = useClassSessions(classId || undefined);
  const attach = useAttachLectureMaterial();

  const reset = () => {
    setClassId("");
    setSessionId("");
    setReleaseAt("");
  };

  const submit = () => {
    if (!classId || !sessionId) return;
    attach.mutate(
      {
        lectureId: lecture.id,
        input: {
          class_id: classId,
          session_id: sessionId,
          visibility: "enrolled_only",
          release_at: toIsoOrUndefined(releaseAt),
        },
      },
      {
        onSuccess: () => {
          toast.success("Đã gắn bài giảng vào tiết.", {
            description: lecture.title,
          });
          reset();
          onOpenChange(false);
        },
        // Máy chủ đã trả `message` tiếng Việt đúng ca cho từng lỗi (404 không
        // sở hữu · 409 chưa hoàn tất · 403 không có quyền lớp · 422 tiết sai
        // · 409 đã gắn đúng cặp lớp+tiết này rồi) — hiện thẳng, không suy diễn lại.
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            📌 Gắn bài giảng vào tiết
          </DialogTitle>
          <DialogDescription>
            Chọn lớp và tiết học để phát <strong>{lecture.title}</strong> cho
            học sinh.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Lớp</Label>
            <Select
              value={classId}
              onValueChange={(v) => {
                setClassId(v);
                setSessionId("");
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chọn lớp" />
              </SelectTrigger>
              <SelectContent>
                {(classes.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tiết học</Label>
            <Select
              value={sessionId}
              onValueChange={setSessionId}
              disabled={!classId || sessions.isLoading}
            >
              <SelectTrigger className="mt-1">
                <SelectValue
                  placeholder={
                    !classId
                      ? "Chọn lớp trước"
                      : sessions.isLoading
                        ? "Đang tải…"
                        : "Chọn tiết"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(sessions.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {classId &&
              !sessions.isLoading &&
              (sessions.data ?? []).length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Lớp này chưa có tiết học nào — tạo tiết trước ở màn Lớp học.
                </p>
              )}
          </div>

          <div>
            <Label
              htmlFor="lecture-release-at"
              className="flex items-center gap-1"
            >
              <CalendarClock className="size-3.5" /> Phát vào lúc (tuỳ chọn)
            </Label>
            <Input
              id="lecture-release-at"
              type="datetime-local"
              value={releaseAt}
              onChange={(e) => setReleaseAt(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Bỏ trống thì học sinh thấy ngay khi gắn xong.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            onClick={submit}
            disabled={!classId || !sessionId || attach.isPending}
          >
            {attach.isPending ? (
              <Loader2 className="size-4 mr-1 animate-spin" />
            ) : (
              <Send className="size-4 mr-1" />
            )}
            Gắn vào tiết
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
