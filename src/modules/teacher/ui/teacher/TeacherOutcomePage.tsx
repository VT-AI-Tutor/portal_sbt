import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/core/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBlueprintOutcome } from "@/modules/teacher/hooks/useTeacherBlueprint";
import { BlueprintOutcomeGrid } from "@/modules/teacher/ui/shared/blueprint/BlueprintOutcomeGrid";

/**
 * Lát 3 — MÀN ĐỌC KẾT QUẢ LỚP THEO Ô MA TRẬN.
 *
 * Vòng khép lại ở đây: ra đề theo ma trận → lớp làm → đọc lại đúng bảng ma
 * trận đó, giờ tô theo tỷ lệ đúng. Bấm vào một ô yếu là đi thẳng sang màn ma
 * trận với ô đó đã điền sẵn — ra tiếp phiếu củng cố đúng chỗ hổng.
 */
export function TeacherOutcomePage() {
  const { classId, linkId } = useParams<{ classId: string; linkId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useBlueprintOutcome(classId, linkId);

  const drillDown = (contentCode: string, levelCode: string) => {
    const topic = data?.topics.find((t) => t.content_code === contentCode);
    toast.success("Mở ma trận cho chỗ này", {
      description: `${topic?.label ?? contentCode} · ${
        data?.levels.find((l) => l.code === levelCode)?.label ?? levelCode
      }`,
    });
    // Đích là NGÂN HÀNG ĐỀ với cờ mở hộp thoại ma trận — không còn màn ma trận
    // đứng riêng. Mang theo CẢ môn và khối: thiếu chúng thì bảng mở ra trống và
    // giáo viên phải chọn lại từ đầu, lời hứa "một chạm" không còn gì.
    const query = new URLSearchParams({
      blueprint: "1",
      kind: "worksheet",
      focus_content: contentCode,
      focus_level: levelCode,
      class_id: classId ?? "",
      subject_code: data?.subject_code ?? "",
      level: data?.level ?? "",
    });
    navigate(`/teacher/exam?${query.toString()}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/assign")}>
        <ArrowLeft className="size-4 mr-1" /> Bài đã giao
      </Button>

      <div>
        <h1 className="font-display text-3xl font-bold">📊 Đọc theo ma trận</h1>
        <p className="text-muted-foreground">
          Lớp làm tốt ở đâu và hổng ở đâu — theo đúng bảng ma trận đã dùng để ra
          đề. Bấm vào một ô để ra phiếu củng cố đúng chỗ đó.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">
          <Loader2 className="size-4 animate-spin" /> Đang tính kết quả…
        </div>
      ) : error ? (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-4">
          Không đọc được kết quả bài này. {error.message}
        </div>
      ) : data ? (
        <BlueprintOutcomeGrid outcome={data} onDrillDown={drillDown} />
      ) : null}
    </div>
  );
}
