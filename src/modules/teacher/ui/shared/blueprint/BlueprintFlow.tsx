import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Switch } from "@/core/ui/switch";
import { Progress } from "@/core/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/ui/select";
import { ArrowLeft, Lightbulb, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useSubjects, useLevels } from "@/core/reference";
import { useAccessToken } from "@/core/auth/AuthContext";
import { KIND_LABEL, type PaperKind } from "@/core/lib/paperKind";
import {
  useBlueprintCatalog,
  useCreateBlueprint,
  useDeleteBlueprint,
  useSuggestBlueprint,
  useTeacherBlueprints,
} from "@/modules/teacher/hooks/useTeacherBlueprint";
import { useTeacherClasses } from "@/modules/teacher/hooks/useTeacherClasses";
import { useCreatePaper } from "@/modules/teacher/hooks/useTeacherPaper";
import type {
  BlueprintCatalog,
  BlueprintCell,
  PaperBlueprint,
  PaperBlueprintInput,
} from "@/modules/teacher/api/teacherBlueprintApi";
import {
  estimateMinutes,
  generateDraft,
  totalCells,
  type DraftCellResult,
  type GenerateProgress,
} from "@/modules/teacher/lib/blueprintDraft";
import {
  buildDefaultMatrix,
  DEFAULT_TOTAL,
} from "@/modules/teacher/lib/blueprintDefaults";
import { BlueprintMatrixGrid } from "@/modules/teacher/ui/shared/blueprint/BlueprintMatrixGrid";
import { BlueprintDraftReview } from "@/modules/teacher/ui/shared/blueprint/BlueprintDraftReview";
import { PaperPreviewDialog } from "@/modules/teacher/ui/shared/blueprint/PaperPreviewDialog";

type Step = "matrix" | "review";

/**
 * Ô ma trận cần tập trung vào, đến từ màn "Đọc theo ma trận" — giáo viên bấm
 * một ô lớp đang yếu thì bảng mở ra với đúng ô đó điền sẵn.
 */
export interface BlueprintFocus {
  contentCode: string;
  levelCode: string;
  subjectCode?: string;
  level?: string;
  classId?: string;
}

export interface BlueprintFlowProps {
  kind?: PaperKind;
  focus?: BlueprintFocus;
  /**
   * Gọi sau khi lưu đề xong. Trang riêng điều hướng về ngân hàng đề; hộp thoại
   * chỉ đóng lại — giáo viên đang đứng sẵn ở ngân hàng đề rồi.
   */
  onSaved?: () => void;
}

/**
 * Luồng MA TRẬN ĐỀ (PAPER-R7..R18): khai ma trận → sinh đề → duyệt từng câu →
 * lưu thành đề.
 *
 * Chạy TRONG hộp thoại ở Ngân hàng đề/phiếu — không có màn ma trận đứng riêng.
 * Vẫn tách khỏi hộp thoại vì đây là phần dài nhất và là phần đáng đọc riêng.
 *
 * Ma trận lưu lại và dùng lại được — một ma trận sinh nhiều đề cho nhiều lớp,
 * và mở lại được ở kỳ sau.
 */
export function BlueprintFlow({
  kind: initialKind,
  focus,
  onSaved,
}: BlueprintFlowProps) {
  const token = useAccessToken();

  const [step, setStep] = useState<Step>("matrix");
  const [kind, setKind] = useState<PaperKind>(initialKind ?? "exam");
  const [title, setTitle] = useState(() => (focus ? "Phiếu củng cố" : ""));
  // Môn và khối có thể đến sẵn từ màn "Đọc theo ma trận" — giáo viên bấm một ô
  // lớp đang yếu là bảng mở ra ngay, không phải chọn lại.
  const [subjectCode, setSubjectCode] = useState(focus?.subjectCode ?? "");
  const [level, setLevel] = useState(focus?.level ?? "");
  const [duration, setDuration] = useState(45);
  const [totalPoints, setTotalPoints] = useState(10);
  const [printableOnly, setPrintableOnly] = useState(true);
  const [avoidReuse, setAvoidReuse] = useState(true);
  const [cells, setCells] = useState<BlueprintCell[]>(() =>
    focus
      ? [
          {
            content_code: focus.contentCode,
            level_code: focus.levelCode as BlueprintCell["level_code"],
            count: 5,
          },
        ]
      : [],
  );
  /**
   * Chủ đề đang nằm trong ma trận — tách khỏi `cells` vì một chủ đề vừa thêm
   * hoàn toàn có thể chưa có câu nào ở mức nào. Gộp hai thứ lại thì thêm xong
   * hàng biến mất ngay, chẳng thêm được gì.
   */
  const [selectedCodes, setSelectedCodes] = useState<string[]>(() =>
    focus ? [focus.contentCode] : [],
  );

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerateProgress | null>(null);
  const [results, setResults] = useState<DraftCellResult[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  // PAPER-R14: ma trận đã sinh ra bản nháp này. Giữ lại để GHIM vào đề lúc lưu
  // — thiếu nó thì đề không biết mình từ ma trận nào, và bản in lẫn màn đọc kết
  // quả mất đường tra ngược về môn/khối.
  const [savedBlueprint, setSavedBlueprint] = useState<PaperBlueprint | null>(
    null,
  );

  // Lát 3: lớp đích. Dùng cho HAI việc — xin gợi ý ma trận theo chỗ lớp yếu, và
  // loại câu các em lớp đó đã gặp khi ra ĐỀ KIỂM TRA (chống trúng tủ). Phiếu
  // bài tập thì gặp lại câu cũ là chuyện tốt nên không loại.
  const [targetClassId, setTargetClassId] = useState(focus?.classId ?? "");

  const subjects = useSubjects();
  const levels = useLevels();
  const classes = useTeacherClasses();
  const suggest = useSuggestBlueprint();
  const catalog = useBlueprintCatalog(subjectCode, level, printableOnly);
  const blueprints = useTeacherBlueprints();
  const createBlueprint = useCreateBlueprint();
  const deleteBlueprint = useDeleteBlueprint();
  const createPaper = useCreatePaper();

  /**
   * Điền sẵn MA TRẬN MẪU ngay khi bảng của môn + khối vừa chọn về tới.
   *
   * Chạy đúng MỘT lần cho mỗi cặp môn+khối: giáo viên sửa xong rồi mà bảng tự
   * điền lại thì mọi thao tác của họ bị nuốt. Đổi sang môn khác lại điền mẫu
   * mới — và tiện thể dọn các ô của môn cũ, vốn trỏ vào chủ đề không còn tồn
   * tại trong bảng nhưng vẫn được cộng vào tổng số câu.
   *
   * Đến từ màn "Đọc theo ma trận" thì KHÔNG điền: ô giáo viên vừa bấm mới là
   * thứ họ muốn, thêm mẫu vào chỉ làm loãng phiếu củng cố.
   */
  const subjectLabel =
    subjects.data?.find((s) => s.code === subjectCode)?.label ?? "";

  const applyDefault = (data: BlueprintCatalog) => {
    const next = buildDefaultMatrix(data, DEFAULT_TOTAL[kind]);
    setCells(next);
    setSelectedCodes([...new Set(next.map((c) => c.content_code))]);
    // Tên đề cũng điền sẵn: nút Sinh đòi có tên, nên bỏ trống thì "chọn môn +
    // khối rồi bấm Sinh" vẫn tắc ở một ô bắt buộc. Chỉ điền khi giáo viên chưa
    // gõ gì — không đạp lên tên họ đặt.
    setTitle((current) =>
      current.trim() === ""
        ? [KIND_LABEL[kind], subjectLabel, level && `${level}`]
            .filter(Boolean)
            .join(" — ")
        : current,
    );
  };

  const scopeKey = `${subjectCode}|${level}`;
  const filledScope = useRef<string | null>(focus ? scopeKey : null);
  useEffect(() => {
    if (!catalog.data || filledScope.current === scopeKey) return;
    filledScope.current = scopeKey;
    applyDefault(catalog.data);
  }, [catalog.data, scopeKey, kind]);

  const isExam = kind === "exam";
  const total = totalCells(cells);
  // Trợ lý AI coi như dùng được cho tới khi máy chủ nói ngược lại — lần sinh
  // đầu tiên sẽ trả về cờ ai_disabled nếu nó đang tắt.
  const aiAvailable = !results.some((r) => r.aiDisabled);

  const input: PaperBlueprintInput = useMemo(
    () => ({
      title: title.trim(),
      kind,
      subject: subjectLabel,
      subject_code: subjectCode,
      level,
      duration_minutes: isExam ? duration : null,
      total_points: isExam ? totalPoints : undefined,
      printable_only: printableOnly,
      avoid_reuse: avoidReuse,
      cells,
    }),
    [
      title,
      kind,
      subjectLabel,
      subjectCode,
      level,
      isExam,
      duration,
      totalPoints,
      printableOnly,
      avoidReuse,
      cells,
    ],
  );

  const estimatedMinutes = catalog.data
    ? estimateMinutes(
        // Chưa sinh nên chưa biết dạng câu — ước theo dạng phổ biến nhất của đề
        // để giáo viên có một con số ngay lúc khai, rồi tinh lại ở màn duyệt.
        Array(total).fill("single_choice"),
        catalog.data.minutes_per_type,
      )
    : 0;
  const overTime = isExam && total > 0 && estimatedMinutes > duration;

  const canGenerate =
    title.trim().length > 0 &&
    subjectCode.length > 0 &&
    level.length > 0 &&
    total > 0 &&
    !generating;

  const loadBlueprint = (bp: PaperBlueprint) => {
    setKind(bp.kind);
    setTitle(bp.title);
    setSubjectCode(bp.subject_code);
    setLevel(bp.level);
    setDuration(bp.duration_minutes ?? 45);
    setTotalPoints(bp.total_points ?? 10);
    setPrintableOnly(bp.printable_only);
    setAvoidReuse(bp.avoid_reuse);
    setCells(bp.cells);
    setSelectedCodes([...new Set(bp.cells.map((c) => c.content_code))]);
    setSavedBlueprint(bp);
    // Ma trận vừa mở là lựa chọn CÓ CHỦ Ý của giáo viên — đánh dấu phạm vi này
    // đã điền để hiệu ứng điền mẫu không đạp lên ngay sau đó.
    filledScope.current = `${bp.subject_code}|${bp.level}`;
    setStep("matrix");
    toast.success("Đã mở ma trận.", { description: bp.title });
  };

  /**
   * Xin ma trận điền sẵn theo chỗ lớp đang yếu. Giữ nguyên số câu giáo viên đã
   * khai (hoặc 20 nếu bảng còn trống) để gợi ý bám ý định của họ, không tự đổi
   * quy mô đề.
   */
  const askSuggestion = async () => {
    if (!targetClassId || !subjectCode || !level) return;
    try {
      const result = await suggest.mutateAsync({
        class_id: targetClassId,
        subject_code: subjectCode,
        level,
        total_questions: total > 0 ? total : 20,
        printable_only: printableOnly,
      });
      if (result.cells.length === 0) {
        toast.warning("Chưa gợi ý được.", {
          description:
            "Kho chưa có câu cho môn và khối này, hoặc lớp chưa có dữ liệu luyện tập.",
        });
        return;
      }
      setCells(result.cells);
      setSelectedCodes([...new Set(result.cells.map((c) => c.content_code))]);
      const weakest = result.weak_topics[0];
      toast.success("Đã điền ma trận theo chỗ lớp yếu.", {
        description: weakest
          ? `Nặng nhất ở chủ đề lớp đang thành thạo ${Math.round(weakest.mastery_percent)}% — thầy cô chỉnh lại tuỳ ý.`
          : `Dựa trên ${result.based_on_students} học sinh của lớp.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xin được gợi ý.");
    }
  };

  const generate = async () => {
    if (!token || !catalog.data) return;
    setGenerating(true);
    setProgress({ done: 0, total: cells.length, current: "" });
    try {
      // Lưu ma trận TRƯỚC khi sinh: giáo viên vừa gõ xong bảng thì đó đã là
      // công sức đáng giữ, kể cả khi lần sinh này hỏng giữa chừng.
      const saved = await createBlueprint.mutateAsync(input).catch(() => null);
      setSavedBlueprint(saved ?? null);

      const draft = await generateDraft(input, token, {
        topicLabel: (code) =>
          catalog.data.topics.find((t) => t.content_code === code)?.label ??
          code,
        levelLabel: (code) =>
          catalog.data.levels.find((l) => l.code === code)?.label ?? code,
        onProgress: setProgress,
        // Chống trúng tủ: chỉ áp cho ĐỀ KIỂM TRA. Phiếu bài tập gặp lại câu đã
        // luyện là chuyện tốt — ôn tập vốn là lặp lại.
        excludeSeenByClassId: isExam ? targetClassId || undefined : undefined,
      });
      setResults(draft);
      setStep("review");

      const made = draft.reduce((s, r) => s + r.items.length, 0);
      const missing = draft.reduce((s, r) => s + r.missing, 0);
      if (missing > 0) {
        toast.warning(`Sinh được ${made}/${total} câu.`, {
          description: `Còn thiếu ${missing} câu — thầy cô chèn tay hoặc hạ số câu.`,
        });
      } else {
        toast.success(`Đã sinh ${made} câu theo ma trận.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không sinh được đề.");
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  const save = () => {
    const items = results.flatMap((r) => r.items);
    if (items.length === 0) return;

    createPaper.mutate(
      {
        kind,
        title: title.trim(),
        subject: subjectLabel,
        level,
        duration_minutes: isExam ? duration : null,
        question_ids: items.map((q) => q.id),
        total_points: isExam ? totalPoints : undefined,
        question_points: Object.fromEntries(
          items.map((q) => [q.id, q.points]),
        ),
        blueprint_id: savedBlueprint?.id,
        blueprint_snapshot: savedBlueprint ?? undefined,
        blueprint_cells: Object.fromEntries(
          items.map((q) => [
            q.id,
            {
              ...q.cell,
              // Nhãn chủ đề đi cùng đề để bảng ma trận in ra đọc được (xem
              // blueprint_cell trong teacherPaperApi).
              label:
                catalog.data?.topics.find(
                  (t) => t.content_code === q.cell.content_code,
                )?.label ?? q.cell.content_code,
            },
          ]),
        ),
      },
      {
        onSuccess: () => {
          toast.success("Đã lưu thành đề.", {
            description: `${KIND_LABEL[kind]} · ${items.length} câu`,
          });
          onSaved?.();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  if (step === "review") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setStep("matrix")}>
            <ArrowLeft className="size-4 mr-1" /> Sửa ma trận
          </Button>
        </div>


        {catalog.data && (
          <BlueprintDraftReview
            input={input}
            catalog={catalog.data}
            results={results}
            onResultsChange={setResults}
            onPreview={() => setPreviewOpen(true)}
            onSave={save}
            saving={createPaper.isPending}
          />
        )}

        <PaperPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={title}
          kind={kind}
          durationMinutes={isExam ? duration : null}
          items={results.flatMap((r) => r.items)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <Card className="p-4 border-2 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Label htmlFor="bp-title">Tên đề</Label>
            <Input
              id="bp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Kiểm tra giữa học kỳ I — Toán 6"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Loại</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as PaperKind)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exam">Đề kiểm tra</SelectItem>
                <SelectItem value="worksheet">Phiếu bài tập</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Môn</Label>
            <Select value={subjectCode} onValueChange={setSubjectCode}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chọn môn" />
              </SelectTrigger>
              <SelectContent>
                {(subjects.data ?? []).map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Khối lớp</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chọn khối" />
              </SelectTrigger>
              <SelectContent>
                {(levels.data ?? []).map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isExam && (
            <>
              <div>
                <Label htmlFor="bp-duration">Thời lượng (phút)</Label>
                <Input
                  id="bp-duration"
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) =>
                    setDuration(Math.max(1, Number(e.target.value) || 0))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="bp-points">Tổng điểm</Label>
                <Input
                  id="bp-points"
                  type="number"
                  min={1}
                  max={100}
                  step={0.5}
                  value={totalPoints}
                  onChange={(e) =>
                    setTotalPoints(Math.max(1, Number(e.target.value) || 0))
                  }
                  className="mt-1"
                />
              </div>
            </>
          )}
        </div>

        <div>
          <Label>Lớp sẽ giao (tuỳ chọn)</Label>
          <Select
            value={targetClassId || "none"}
            onValueChange={(v) => setTargetClassId(v === "none" ? "" : v)}
          >
            <SelectTrigger className="mt-1 max-w-sm">
              <SelectValue placeholder="Chưa chọn lớp" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Chưa chọn lớp</SelectItem>
              {(classes.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Chọn lớp thì xin được gợi ý ma trận theo chỗ lớp yếu
            {isExam ? ", và đề tránh những câu các em đã gặp khi luyện tập" : ""}
            .
          </p>
        </div>

        <div className="flex flex-wrap gap-5 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={printableOnly}
              onCheckedChange={setPrintableOnly}
              aria-label="Đề in được ra giấy"
            />
            <span>
              <strong>In được ra giấy</strong>
              <span className="block text-xs text-muted-foreground">
                Chỉ lấy câu in ra giấy được, bỏ dạng kéo thả và tương tác.
              </span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={avoidReuse}
              onCheckedChange={setAvoidReuse}
              aria-label="Tránh câu đã dùng"
            />
            <span>
              <strong>Tránh câu đã dùng</strong>
              <span className="block text-xs text-muted-foreground">
                Ra đề cho nhiều lớp thì mỗi lớp một bộ câu khác nhau.
              </span>
            </span>
          </label>
        </div>
      </Card>

      {subjectCode && level ? (
        catalog.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">
            <Loader2 className="size-4 animate-spin" /> Đang tải khung nội dung…
          </div>
        ) : catalog.error ? (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-4">
            Không tải được khung nội dung của môn và khối này. Thử lại sau.
          </div>
        ) : catalog.data ? (
          <BlueprintMatrixGrid
            catalog={catalog.data}
            cells={cells}
            onChange={setCells}
            selectedCodes={selectedCodes}
            onSelectedChange={setSelectedCodes}
            aiAvailable={aiAvailable}
            onRefill={() => applyDefault(catalog.data!)}
          />
        ) : null
      ) : (
        <div className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
          Chọn môn và khối lớp để mở bảng ma trận.
        </div>
      )}

      {generating && progress && (
        <Card className="p-4 border-2 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-fun animate-pulse" />
            Đang sinh ô {Math.min(progress.done + 1, progress.total)}/
            {progress.total}
            {progress.current && <span className="text-muted-foreground">· {progress.current}</span>}
          </div>
          <Progress
            value={
              progress.total > 0 ? (progress.done / progress.total) * 100 : 0
            }
          />
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 bg-muted/30 p-3">
        <div className="text-sm">
          <strong>{total} câu</strong>
          {isExam && ` · ${totalPoints} điểm`}
          {total > 0 && (
            <>
              {" · ước "}
              <span className={overTime ? "text-destructive font-bold" : ""}>
                {estimatedMinutes} phút
              </span>
              {overTime && ` (đề khai ${duration} phút)`}
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => void askSuggestion()}
          disabled={
            !targetClassId || !subjectCode || !level || suggest.isPending
          }
          title={
            targetClassId
              ? "Điền sẵn ma trận nghiêng về chủ đề lớp đang yếu"
              : "Chọn lớp đích để xin gợi ý"
          }
        >
          {suggest.isPending ? (
            <Loader2 className="size-4 mr-1 animate-spin" />
          ) : (
            <Lightbulb className="size-4 mr-1" />
          )}
          Gợi ý theo lớp
        </Button>
        <Button
          onClick={() => void generate()}
          disabled={!canGenerate}
          className="bg-fun hover:bg-fun/90 text-fun-foreground"
        >
          {generating ? (
            <Loader2 className="size-4 mr-1 animate-spin" />
          ) : (
            <Wand2 className="size-4 mr-1" />
          )}
          Sinh {KIND_LABEL[kind].toLowerCase()}
        </Button>
        </div>
      </div>

      {(blueprints.data ?? []).length > 0 && (
        <div>
          <h2 className="font-display text-lg font-bold mb-2">
            📐 Ma trận đã lưu ({blueprints.data?.length})
          </h2>
          <div className="grid md:grid-cols-2 gap-2">
            {(blueprints.data ?? []).map((bp) => (
              <Card key={bp.id} className="p-3 border-2 flex items-center gap-2">
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => loadBlueprint(bp)}
                >
                  <div className="font-medium text-sm">{bp.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      KIND_LABEL[bp.kind],
                      bp.subject,
                      bp.level && `Lớp ${bp.level}`,
                      `${totalCells(bp.cells)} câu`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive h-7 w-7 p-0"
                  aria-label={`Xoá ma trận ${bp.title}`}
                  disabled={deleteBlueprint.isPending}
                  onClick={() =>
                    deleteBlueprint.mutate(bp.id, {
                      onSuccess: () => toast.success("Đã xoá ma trận."),
                      onError: (e) => toast.error(e.message),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
