import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs";
import {
  Sparkles,
  Plus,
  FileText,
  ClipboardList,
  Trash2,
  Loader2,
  Printer,
} from "lucide-react";
import { KIND_LABEL, type PaperKind } from "@/core/lib/paperKind";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CreatePaperDialog } from "@/modules/teacher/ui/shared/CreatePaperDialog";
import { BlueprintDialog } from "@/modules/teacher/ui/shared/blueprint/BlueprintDialog";
import type { BlueprintFocus } from "@/modules/teacher/ui/shared/blueprint/BlueprintFlow";
import {
  useTeacherPapers,
  useDeletePaper,
} from "@/modules/teacher/hooks/useTeacherPaper";

export function TeacherExamPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Màn "Đọc theo ma trận" gửi giáo viên về đây kèm ô lớp đang yếu — mở thẳng
  // hộp thoại với ô đó điền sẵn. Không còn màn ma trận đứng riêng để nhảy sang.
  const focus = useMemo<BlueprintFocus | undefined>(() => {
    const contentCode = params.get("focus_content");
    const levelCode = params.get("focus_level");
    if (!contentCode || !levelCode) return undefined;
    return {
      contentCode,
      levelCode,
      subjectCode: params.get("subject_code") ?? undefined,
      level: params.get("level") ?? undefined,
      classId: params.get("class_id") ?? undefined,
    };
  }, [params]);

  const [kind, setKind] = useState<PaperKind>(() =>
    params.get("kind") === "exam" ? "exam" : "worksheet",
  );
  const [manualOpen, setManualOpen] = useState(false);
  // Luồng ma trận mở NGAY TẠI TRANG này, không điều hướng đi đâu — xem
  // BlueprintDialog.
  const [blueprintOpen, setBlueprintOpen] = useState(
    () => params.get("blueprint") === "1",
  );

  const papersQuery = useTeacherPapers();
  const deletePaper = useDeletePaper();

  const kindLabel = KIND_LABEL[kind];
  const kindLower = kindLabel.toLowerCase();
  const filtered = (papersQuery.data ?? []).filter((p) => p.kind === kind);

  const onDelete = (id: string) =>
    deletePaper.mutate(id, {
      onSuccess: () => toast.success("Đã xoá đề/phiếu."),
      onError: (e) => toast.error(e.message),
    });

  return (
    <>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
        <div>
          {/* GAP-101: tiêu đề khớp nhãn điều hướng — trang là NGÂN HÀNG đề/phiếu đã tạo,
              kèm lối vào tạo mới (thủ công từ ngân hàng câu hỏi của giáo viên). */}
          <h1 className="font-display text-3xl font-bold">
            📝 Ngân hàng đề/phiếu
          </h1>
          <p className="text-muted-foreground">
            Tạo <strong>phiếu bài tập</strong> và <strong>đề kiểm tra</strong>{" "}
            từ ngân hàng câu hỏi của bạn, rồi giao cho lớp.
          </p>
        </div>

        <Tabs value={kind} onValueChange={(v) => setKind(v as PaperKind)}>
          <TabsList className="grid grid-cols-2 max-w-md">
            <TabsTrigger value="worksheet" className="gap-1">
              <ClipboardList className="size-4" /> Phiếu bài tập
            </TabsTrigger>
            <TabsTrigger value="exam" className="gap-1">
              <FileText className="size-4" /> Đề kiểm tra
            </TabsTrigger>
          </TabsList>

          <TabsContent value={kind} className="space-y-5 mt-5">
            <div className="grid md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="text-left rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/10 to-transparent p-5 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/15 p-2.5 group-hover:scale-110 transition-transform">
                    <Plus className="size-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-display font-bold text-lg text-primary">
                      ➕ Tạo {kindLower} thủ công
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Chọn câu hỏi từ ngân hàng của bạn (Cá nhân + AI) & giao
                      theo lớp.
                    </p>
                  </div>
                </div>
              </button>

              {/* Ma trận đề (PAPER-R7..R18): khai chủ đề × mức nhận thức, bốc câu
                  từ kho và nhờ trợ lý AI sinh bù chỗ thiếu. */}
              <button
                type="button"
                onClick={() => setBlueprintOpen(true)}
                className="text-left rounded-2xl border-2 border-fun bg-gradient-to-br from-fun/10 to-transparent p-5 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-fun/15 p-2.5 group-hover:scale-110 transition-transform">
                    <Sparkles className="size-6 text-fun" />
                  </div>
                  <div>
                    <div className="font-display font-bold text-lg text-fun">
                      ✨ Sinh theo ma trận
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Khai chủ đề × mức nhận thức, hệ lấy câu từ kho và nhờ trợ
                      lý AI sinh bù chỗ thiếu.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-xl font-bold">
                  📂 {kindLabel} đã tạo ({filtered.length})
                </h2>
              </div>

              {papersQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">
                  <Loader2 className="size-4 animate-spin" /> Đang tải…
                </div>
              ) : papersQuery.error ? (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-4">
                  Không tải được danh sách đề/phiếu. Thử lại sau.
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">
                  Chưa có {kindLower} nào. Bấm “Tạo {kindLower} thủ công” để bắt
                  đầu.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {filtered.map((p) => (
                    <Card
                      key={p.id}
                      className="p-4 border-2 hover:border-primary transition-colors"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="font-bold">{p.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {[
                              p.subject,
                              p.level && `Lớp ${p.level}`,
                              `${p.questions.length} câu`,
                              p.total_points ? `${p.total_points} điểm` : null,
                              p.duration_minutes
                                ? `${p.duration_minutes} phút`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/teacher/exam/${p.id}/print`)}
                        >
                          <Printer className="size-3.5 mr-1" /> Xuất giấy
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={deletePaper.isPending}
                          onClick={() => onDelete(p.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <CreatePaperDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        kind={kind}
      />

      <BlueprintDialog
        open={blueprintOpen}
        onOpenChange={setBlueprintOpen}
        kind={kind}
        focus={focus}
      />
    </>
  );
}
