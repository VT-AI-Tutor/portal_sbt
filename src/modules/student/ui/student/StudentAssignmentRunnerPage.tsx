import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SubmissionRunner } from "@/modules/books/ui/shared/SubmissionRunner";

/**
 * Trang làm một bài giao (GAP-083). Nhận exerciseId (= assignment_id) và tái dùng
 * SubmissionRunner — cùng luồng khởi tạo lượt/nộp/kết quả như bài tập trong sách.
 * Bài GV GIAO chấm KÍN (Owner 31/7, phương án B): marking="sealed" — không lộ
 * verdict khi đang làm, điểm chỉ hiện sau khi Nộp bài. Bài học trong sách giữ
 * mặc định instant.
 */
export function StudentAssignmentRunnerPage() {
  const { exerciseId } = useParams();

  if (!exerciseId) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <p className="text-muted-foreground">Không tìm thấy bài giao.</p>
        <Link
          to="/student/assignments"
          className="text-primary hover:underline"
        >
          ← Về Bài tập của tôi
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <Link
        to="/student/assignments"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Bài tập của tôi
      </Link>
      <SubmissionRunner
        exerciseId={exerciseId}
        lessonTitle="Bài giao"
        marking="sealed"
      />
    </div>
  );
}
