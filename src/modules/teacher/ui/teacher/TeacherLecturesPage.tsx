import { useState } from "react";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  Pencil,
  Plus,
  Presentation,
  Send,
} from "lucide-react";
import { useTeacherLectures } from "@/modules/teacher/hooks/useTeacherLectures";
import { LectureFlow } from "@/modules/teacher/ui/shared/lecture/LectureFlow";
import { LectureAttachDialog } from "@/modules/teacher/ui/shared/lecture/LectureAttachDialog";
import { LectureProgressDialog } from "@/modules/teacher/ui/shared/lecture/LectureProgressDialog";
import type { TeacherLecture } from "@/modules/teacher/api/teacherLectureApi";

const STATUS_LABEL: Record<TeacherLecture["status"], string> = {
  draft: "Đang soạn",
  ready: "Đã hoàn tất",
};

/** "new" = soạn bài giảng mới; một `TeacherLecture` = tiếp tục bản nháp đó
 * (LectureFlow nhảy thẳng vào bước duyệt — xem `initialLecture`). */
type ActiveFlow = "new" | TeacherLecture;

/**
 * Danh sách bài giảng số của giáo viên + lối vào luồng soạn mới (LectureFlow).
 *
 * Bản nháp dở ('draft') có nút "Tiếp tục soạn" — bịt lỗ hổng review Task 13
 * vòng 1 (Phát hiện 3): trước đây thẻ "Đang soạn" là ngõ cụt, rớt mạng/tải lại
 * trang giữa chừng là mất lối vào dù dữ liệu vẫn còn nguyên trên máy chủ.
 *
 * Bài giảng đã hoàn tất ('ready') gắn được vào tiết của lớp khác ngay từ đây,
 * không chỉ ngay sau lúc soạn.
 */
export function TeacherLecturesPage() {
  const [activeFlow, setActiveFlow] = useState<ActiveFlow | null>(null);
  const [attaching, setAttaching] = useState<TeacherLecture | null>(null);
  const [viewingProgress, setViewingProgress] = useState<TeacherLecture | null>(
    null,
  );

  const lectures = useTeacherLectures();

  if (activeFlow) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => setActiveFlow(null)}>
          <ArrowLeft className="size-4 mr-1" /> Quay lại danh sách
        </Button>
        <LectureFlow
          initialLecture={activeFlow === "new" ? undefined : activeFlow}
          onDone={() => setActiveFlow(null)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">🎬 Bài giảng số</h1>
            <p className="text-muted-foreground">
              Trợ lý AI soạn khung bài giảng 4 hoạt động — thầy cô duyệt lại rồi
              gắn vào tiết học của lớp.
            </p>
          </div>
          <Button
            onClick={() => setActiveFlow("new")}
            className="bg-fun hover:bg-fun/90 text-fun-foreground"
          >
            <Plus className="size-4 mr-1" /> Soạn bài giảng mới
          </Button>
        </div>

        {lectures.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">
            <Loader2 className="size-4 animate-spin" /> Đang tải…
          </div>
        ) : lectures.error ? (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-4">
            Không tải được danh sách bài giảng. Thử lại sau.
          </div>
        ) : (lectures.data ?? []).length === 0 ? (
          <div className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có bài giảng nào. Bấm “Soạn bài giảng mới” để bắt đầu.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {(lectures.data ?? []).map((l) => (
              <Card key={l.id} className="p-4 border-2 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Presentation className="size-4 text-fun shrink-0" />{" "}
                      {l.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {l.subject} · Lớp {l.level}
                    </div>
                  </div>
                  <Badge variant={l.status === "ready" ? "default" : "outline"}>
                    {STATUS_LABEL[l.status]}
                  </Badge>
                </div>
                {l.status === "draft" ? (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveFlow(l)}
                    >
                      <Pencil className="size-3.5 mr-1" /> Tiếp tục soạn
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    {/* Việc 2 — không còn khoá theo `class_context` (trường
                    ghi một lần lúc tạo, tuỳ chọn, không theo kịp khi gắn
                    thêm/gắn muộn). Bài giảng `ready` là mở được hộp thoại;
                    chuyện chưa gắn lớp nào thì `LectureProgressDialog` tự
                    hỏi `/links` và báo rõ, không cần đoán trước ở đây. */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewingProgress(l)}
                    >
                      <BarChart3 className="size-3.5 mr-1" /> Tiến độ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAttaching(l)}
                    >
                      <Send className="size-3.5 mr-1" /> Gắn vào tiết
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {attaching && (
        <LectureAttachDialog
          open
          onOpenChange={(v) => {
            if (!v) setAttaching(null);
          }}
          lecture={attaching}
        />
      )}

      {viewingProgress && (
        <LectureProgressDialog
          open
          onOpenChange={(v) => {
            if (!v) setViewingProgress(null);
          }}
          lecture={viewingProgress}
        />
      )}
    </>
  );
}
