import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Switch } from "@/core/ui/switch";
import { ArrowLeft, FileDown, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useTeacherPapers } from "@/modules/teacher/hooks/useTeacherPaper";
import { downloadPaperAsWord } from "@/modules/teacher/lib/paperToWord";
import { preparePrintablePaper } from "@/modules/teacher/lib/paperPrint";
import { PaperPrintSheet } from "@/modules/teacher/ui/shared/paper-print/PaperPrintSheet";
import { AnswerKeySheet } from "@/modules/teacher/ui/shared/paper-print/AnswerKeySheet";
import { AnswerCardSheet } from "@/modules/teacher/ui/shared/paper-print/AnswerCardSheet";

/**
 * XUẤT ĐỀ RA GIẤY (PAPER-R16) — bản in PDF, tệp Word sửa được, trang đáp án và
 * phiếu trả lời trắc nghiệm.
 *
 * Ba tờ hiện ngay trên màn hình đúng khổ A4 để giáo viên soát trước khi in,
 * chứ không phải bấm in rồi mới biết tờ giấy trông thế nào.
 */
export function TeacherPaperPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const papers = useTeacherPapers();

  const [schoolName, setSchoolName] = useState("");
  const [withAnswerKey, setWithAnswerKey] = useState(true);
  const [withAnswerCard, setWithAnswerCard] = useState(false);

  const paper = papers.data?.find((p) => p.id === id);

  /**
   * Gắn cờ lên <body> quanh lệnh in: kiểu in dùng cờ này để giấu mọi thứ ngoài
   * các tờ đề. Gỡ cờ ở `afterprint` để màn hình trở lại bình thường kể cả khi
   * người dùng bấm huỷ trong hộp thoại in.
   */
  useEffect(() => {
    const clear = () => document.body.classList.remove("printing-papers");
    window.addEventListener("afterprint", clear);
    return () => {
      window.removeEventListener("afterprint", clear);
      clear();
    };
  }, []);

  const print = () => {
    document.body.classList.add("printing-papers");
    window.print();
  };

  const exportWord = () => {
    if (!paper) return;
    try {
      downloadPaperAsWord(paper, {
        schoolName: schoolName.trim() || undefined,
        includeAnswerKey: withAnswerKey,
      });
      toast.success("Đã tải tệp Word.", {
        description: "Mở bằng Word để sửa lại rồi in hoặc nộp hồ sơ.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xuất được tệp Word.");
    }
  };

  if (papers.isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Đang tải đề…
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-3">
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-4">
          Không tìm thấy đề này. Có thể nó đã bị xoá.
        </div>
        <Button variant="outline" onClick={() => navigate("/teacher/exam")}>
          <ArrowLeft className="size-4 mr-1" /> Về ngân hàng đề/phiếu
        </Button>
      </div>
    );
  }

  const { droppedCount, choice } = preparePrintablePaper(paper);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-5">
      <div className="print:hidden space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/teacher/exam")}
        >
          <ArrowLeft className="size-4 mr-1" /> Ngân hàng đề/phiếu
        </Button>

        <div>
          <h1 className="font-display text-3xl font-bold">🖨️ Xuất ra giấy</h1>
          <p className="text-muted-foreground">
            Soát lại tờ đề dưới đây rồi in ra PDF, hoặc tải tệp Word về sửa
            tiếp.
          </p>
        </div>

        <Card className="p-4 border-2 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="print-school">Tên trường (in ở đầu đề)</Label>
              <Input
                id="print-school"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Ví dụ: Trường THCS Lê Quý Đôn"
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={withAnswerKey}
                onCheckedChange={setWithAnswerKey}
                aria-label="Kèm đáp án và hướng dẫn chấm"
              />
              <span>
                <strong>Đáp án và hướng dẫn chấm</strong>
                <span className="block text-xs text-muted-foreground">
                  Kèm bảng ma trận — bộ hồ sơ nhà trường đòi nộp cùng đề.
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={withAnswerCard}
                onCheckedChange={setWithAnswerCard}
                disabled={choice.length === 0}
                aria-label="Kèm phiếu trả lời trắc nghiệm"
              />
              <span>
                <strong>Phiếu trả lời trắc nghiệm</strong>
                <span className="block text-xs text-muted-foreground">
                  {choice.length === 0
                    ? "Đề này không có câu trắc nghiệm."
                    : "Học sinh tô phiếu, chấm cả xấp bằng một tờ đáp án."}
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={print}>
              <Printer className="size-4 mr-1" /> In ra PDF
            </Button>
            <Button variant="outline" onClick={exportWord}>
              <FileDown className="size-4 mr-1" /> Tải tệp Word
            </Button>
          </div>

          {droppedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Lưu ý: {droppedCount} câu dạng tương tác không in ra giấy được nên
              bản in bỏ qua. Học sinh làm trên máy vẫn thấy đủ.
            </p>
          )}
        </Card>
      </div>

      <PaperPrintSheet paper={paper} schoolName={schoolName.trim() || undefined} />
      {withAnswerKey && <AnswerKeySheet paper={paper} />}
      {withAnswerCard && choice.length > 0 && (
        <AnswerCardSheet
          paper={paper}
          schoolName={schoolName.trim() || undefined}
        />
      )}
    </div>
  );
}
