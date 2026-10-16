import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Label } from "@/core/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import {
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  Check,
  ChevronRight,
  ArrowLeft,
  BookOpen,
  FolderOpen,
  Library,
  Building2,
  User,
  Bot,
  Loader2,
} from "lucide-react";
import { TYPE_LABELS } from "@/core/interactions/QuestionRenderer";
import { callAIJson } from "@/modules/ai/application/ai-client";
import type { Question } from "@/core/lib/types";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLevels, useSubjects } from "@/core/reference";
import {
  useTeacherBank,
  useCreateTeacherQuestion,
  useDeleteTeacherQuestion,
  useSaveAiQuestions,
} from "@/modules/teacher/hooks/useTeacherBank";
import type { TeacherQuestion } from "@/modules/teacher/api/teacherBankApi";
import { toCanonical, toLabel } from "@/modules/teacher/lib/questionDifficulty";

/* ============================================================ */
/* Types & mock data                                            */
/* ============================================================ */

type BankItem = {
  id: string;
  topic: string;
  subject: string;
  type: Question["type"];
  text: string;
  level: "Dễ" | "TB" | "Khó";
  options?: string[];
  correctIndex?: number[];
  explanation?: string;
  /** Đáp án thô sinh bởi AI (chưa qua payload) — chỉ dùng để lưu vào
   * ngân hàng qua saveFromAi (Task 6), không hiển thị ở QuestionList. */
  answer?: string;
};

type NxbBank = {
  id: string;
  name: string;
  questions: BankItem[];
};
type NxbTopic = { id: string; name: string; banks: NxbBank[] };
type NxbSubject = {
  id: string;
  name: string;
  emoji: string;
  topics: NxbTopic[];
};
type NxbGrade = { id: string; name: string; subjects: NxbSubject[] };

const mkQ = (
  id: string,
  topic: string,
  subject: string,
  type: Question["type"],
  text: string,
  level: BankItem["level"],
): BankItem => ({ id, topic, subject, type, text, level });


/** Map một dòng BE (`TeacherQuestion`) sang `BankItem` cục bộ của trang này.
 * Độ khó BE (`easy|medium|hard`) → nhãn hiển thị qua `toLabel` (Task 4). */
function toBankItem(row: TeacherQuestion): BankItem {
  const payload = (row.payload ?? {}) as {
    options?: string[];
    explanation?: string;
  };
  return {
    id: row.id,
    topic: row.topic,
    subject: row.subject ?? "",
    type: row.question_type as Question["type"],
    text: row.question_text,
    level: toLabel(row.difficulty),
    options: payload.options,
    explanation:
      typeof payload.explanation === "string" ? payload.explanation : undefined,
  };
}

/* ============================================================ */
/* Page                                                          */
/* ============================================================ */

export function TeacherBankPage() {
  const personalQuery = useTeacherBank("personal");
  const aiQuery = useTeacherBank("ai");
  const deleteQuestion = useDeleteTeacherQuestion();
  const saveAiQuestions = useSaveAiQuestions();
  const [openAdd, setOpenAdd] = useState(false);
  const [openAi, setOpenAi] = useState(false);

  const personal = useMemo(
    () => (personalQuery.data ?? []).map(toBankItem),
    [personalQuery.data],
  );
  const aiBank = useMemo(
    () => (aiQuery.data ?? []).map(toBankItem),
    [aiQuery.data],
  );

  const handleDelete = (id: string) => {
    deleteQuestion.mutate(id, {
      onSuccess: () => toast.success("Đã xoá câu hỏi"),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
        <div>
          <h1 className="font-display text-3xl font-bold">
            📚 Ngân hàng câu hỏi
          </h1>
          <p className="text-muted-foreground">
            Tổng hợp câu hỏi từ kho học liệu dùng chung, ngân hàng cá nhân của
            cô và AI sinh tự động.
          </p>
        </div>

        <Tabs defaultValue="nxb" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            {/* Tên tab mô tả VAI TRÒ của kho, không mang tên nhà xuất bản:
                tên brand thuộc khu Sách, và hệ chạy nhiều brand (Owner
                2026-08-15). Không có badge tổng số vì kho đếm theo (môn, lớp)
                chứ không có một con số chung. */}
            <TabsTrigger value="nxb" className="py-2.5 gap-2">
              <Building2 className="size-4" />
              <span>{"Kho học liệu"}</span>
            </TabsTrigger>
            <TabsTrigger value="personal" className="py-2.5 gap-2">
              <User className="size-4" />
              <span className="hidden sm:inline">Cá nhân</span>
              <span className="sm:hidden">Cá nhân</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                {personal.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="py-2.5 gap-2">
              <Bot className="size-4" />
              <span className="hidden sm:inline">AI sinh</span>
              <span className="sm:hidden">AI</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-fun/15 text-fun">
                {aiBank.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nxb" className="mt-4">
            <LibraryBrowser />
          </TabsContent>

          <TabsContent value="personal" className="mt-4">
            <FlatBank
              title="Ngân hàng cá nhân"
              description="Câu hỏi do cô tự tạo. Có thể chỉnh sửa, xoá thoải mái."
              items={personal}
              isLoading={personalQuery.isLoading}
              isError={personalQuery.isError}
              onDelete={handleDelete}
              actionLabel="Thêm thủ công"
              actionIcon={<Plus className="size-4 mr-1" />}
              onAction={() => setOpenAdd(true)}
            />
          </TabsContent>

          <TabsContent value="ai" className="mt-4">
            <FlatBank
              title="Ngân hàng AI sinh"
              description="Câu hỏi sinh tự động bởi AI. Cô có thể duyệt và chuyển sang ngân hàng cá nhân."
              items={aiBank}
              isLoading={aiQuery.isLoading}
              isError={aiQuery.isError}
              onDelete={handleDelete}
              actionLabel="AI sinh câu hỏi"
              actionIcon={<Sparkles className="size-4 mr-1 text-fun" />}
              actionVariant="outline"
              onAction={() => setOpenAi(true)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AddQuestionDialog open={openAdd} onOpenChange={setOpenAdd} />
      <AiGenerateDialog
        open={openAi}
        onOpenChange={setOpenAi}
        onGenerate={(qs) => {
          // GAP-099/TBANK-R6: lưu thật các câu AI sinh vào ngân hàng qua đường ghi
          // /questions/from-ai (mỗi câu được sàng AISAFE trước khi lưu). Tab "AI sinh"
          // tự cập nhật nhờ invalidate query trong useSaveAiQuestions — không push state cục bộ.
          saveAiQuestions.mutate(
            qs.map((q) => ({
              question_type: q.type,
              subject: q.subject,
              topic: q.topic,
              difficulty: toCanonical(q.level),
              question_text: q.text,
              payload: {
                options: q.options ?? [],
                answer: q.answer ?? "",
              },
            })),
            {
              onSuccess: (data) => {
                toast.success(
                  `Đã lưu ${data.saved.length} câu vào ngân hàng AI sinh`,
                );
                if (data.rejected.length)
                  toast.error(
                    `${data.rejected.length} câu bị bỏ do không phù hợp`,
                  );
              },
              onError: (e: Error) => toast.error(e.message),
            },
          );
        }}
      />
    </>
  );
}

/* ============================================================ */
/* NXB Browser: Lớp -> Môn -> Chủ đề -> Ngân hàng -> Câu hỏi    */
/* ============================================================ */

type NxbCrumb =
  | { level: "grade" }
  | { level: "subject"; gradeId: string }
  | { level: "topic"; gradeId: string; subjectId: string }
  | { level: "bank"; gradeId: string; subjectId: string; topicId: string }
  | {
      level: "question";
      gradeId: string;
      subjectId: string;
      topicId: string;
      bankId: string;
    };

/**
 * Duyệt KHO HỌC LIỆU dùng chung theo (môn, lớp).
 *
 * Bản trước dựng một cây 4 tầng viết cứng ngay trong tệp này (`NXB_TREE`) —
 * giáo viên thấy câu hỏi nhưng không mượn được: hộp tạo phiếu chỉ đọc câu cá
 * nhân + AI. Nay đọc kho thật, và chính những câu này tạo phiếu được.
 *
 * Kho có hàng nghìn câu nên PHẢI chọn môn + lớp trước; backend từ chối quét
 * toàn kho.
 */
function LibraryBrowser() {
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const { data: subjects = [] } = useSubjects();
  const { data: levels = [] } = useLevels();
  const query = useTeacherBank("library", { subject, level });
  const items = useMemo(
    () => (query.data ?? []).map(toBankItem),
    [query.data],
  );

  return (
    <div className="space-y-4">
      <Card className="p-4 border-2">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Môn học</div>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Chọn môn" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Lớp</div>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Chọn lớp" />
              </SelectTrigger>
              <SelectContent>
                {levels.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {!subject || !level ? (
        <Card className="p-10 text-center border-2 border-dashed">
          <p className="text-muted-foreground">
            {"Chọn môn và lớp để xem câu hỏi trong kho."}
          </p>
        </Card>
      ) : query.isLoading ? (
        <Card className="p-10 text-center border-2 border-dashed">
          <p className="text-muted-foreground">{"Đang tải câu hỏi…"}</p>
        </Card>
      ) : query.error ? (
        <Card className="p-10 text-center border-2 border-dashed">
          <p className="text-destructive">{query.error.message}</p>
        </Card>
      ) : (
        <QuestionList items={items} readOnly />
      )}
    </div>
  );
}

function FlatBank({
  title,
  description,
  items,
  isLoading,
  isError,
  onDelete,
  actionLabel,
  actionIcon,
  actionVariant = "default",
  onAction,
}: {
  title: string;
  description: string;
  items: BankItem[];
  isLoading?: boolean;
  isError?: boolean;
  onDelete: (id: string) => void;
  actionLabel: string;
  actionIcon: React.ReactNode;
  actionVariant?: "default" | "outline";
  onAction: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.text.toLowerCase().includes(q) ||
        it.topic.toLowerCase().includes(q) ||
        it.subject.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div className="space-y-3">
      <Card className="p-4 border-2 flex flex-wrap gap-3 items-center justify-between">
        <div className="min-w-0">
          <div className="font-bold flex items-center gap-2">
            <Library className="size-4 text-primary" /> {title}
          </div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <Button
          variant={actionVariant}
          className={
            actionVariant === "default"
              ? "btn-pop rounded-full"
              : "rounded-full"
          }
          onClick={onAction}
        >
          {actionIcon}
          {actionLabel}
        </Button>
      </Card>

      <div className="relative">
        <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          placeholder="Tìm câu hỏi theo từ khoá, chủ đề, môn học..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Card className="p-10 text-center border-2 border-dashed">
          <p className="text-muted-foreground">Đang tải câu hỏi…</p>
        </Card>
      ) : isError ? (
        <Card className="p-6 text-center border-2 border-destructive/40 bg-destructive/5">
          <p className="text-sm text-destructive">
            Không tải được ngân hàng câu hỏi. Thử lại sau.
          </p>
        </Card>
      ) : (
        <QuestionList items={filtered} onDelete={onDelete} />
      )}
    </div>
  );
}

function QuestionList({
  items,
  onDelete,
  readOnly,
}: {
  items: BankItem[];
  onDelete?: (id: string) => void;
  readOnly?: boolean;
}) {
  if (items.length === 0) {
    return (
      <Card className="p-10 text-center border-2 border-dashed">
        <p className="text-muted-foreground">Chưa có câu hỏi nào.</p>
      </Card>
    );
  }
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {items.map((q) => (
        <Card
          key={q.id}
          className="p-4 border-2 hover:border-primary transition-all"
        >
          <div className="flex justify-between items-start gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase text-primary">
              {q.subject} · {q.topic}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-fun/15 text-fun">
              {TYPE_LABELS[q.type] ?? q.type}
            </span>
          </div>
          <div className="font-medium text-sm">{q.text}</div>
          <div className="mt-3 flex justify-between items-center">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                q.level === "Dễ"
                  ? "bg-success/15 text-success"
                  : q.level === "TB"
                    ? "bg-warning/20 text-warning-foreground"
                    : "bg-destructive/15 text-destructive"
              }`}
            >
              {q.level}
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost">
                Xem
              </Button>

              {!readOnly && onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(q.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ============================================================ */
/* Dialog: Thêm câu hỏi thủ công                                */
/* ============================================================ */

const SUBJECT_OPTIONS = ["Khoa học 4", "Toán 4", "Tiếng Việt 4", "Lịch sử"];
const LEVEL_OPTIONS: BankItem["level"][] = ["Dễ", "TB", "Khó"];

const QUICK_TYPES: { value: Question["type"]; label: string; emoji: string }[] =
  [
    { value: "single_choice", label: "Trắc nghiệm 1 đáp án", emoji: "🔘" },
    { value: "multiple_choice", label: "Nhiều đáp án", emoji: "☑️" },
    { value: "true_false", label: "Đúng / Sai", emoji: "✅" },
    { value: "fill_blank", label: "Điền khuyết", emoji: "✍️" },
    { value: "short_answer", label: "Tự luận ngắn", emoji: "📝" },
    { value: "essay", label: "Tự luận dài", emoji: "📄" },
  ];

function AddQuestionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const createQuestion = useCreateTeacherQuestion();
  const [type, setType] = useState<Question["type"]>("single_choice");
  const [subject, setSubject] = useState("Khoa học 4");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<BankItem["level"]>("Dễ");
  const [text, setText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState<number[]>([0]);
  const [tfAnswer, setTfAnswer] = useState<"true" | "false">("true");

  const reset = () => {
    setType("single_choice");
    setSubject("Khoa học 4");
    setTopic("");
    setLevel("Dễ");
    setText("");
    setExplanation("");
    setOptions(["", "", "", ""]);
    setCorrectIndex([0]);
    setTfAnswer("true");
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const isChoice = type === "single_choice" || type === "multiple_choice";

  const updateOption = (i: number, v: string) =>
    setOptions((arr) => arr.map((o, idx) => (idx === i ? v : o)));
  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions((arr) => arr.filter((_, idx) => idx !== i));
    setCorrectIndex((ci) =>
      ci.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)),
    );
  };
  const addOption = () => {
    if (options.length >= 6) return;
    setOptions((arr) => [...arr, ""]);
  };
  const toggleCorrect = (i: number) => {
    if (type === "single_choice") setCorrectIndex([i]);
    else
      setCorrectIndex((ci) =>
        ci.includes(i) ? ci.filter((c) => c !== i) : [...ci, i],
      );
  };

  const validate = (): string | null => {
    if (!topic.trim()) return "Vui lòng nhập chủ đề";
    if (!text.trim()) return "Vui lòng nhập nội dung câu hỏi";
    if (isChoice) {
      const filled = options.filter((o) => o.trim()).length;
      if (filled < 2) return "Cần ít nhất 2 phương án";
      if (correctIndex.length === 0) return "Chọn ít nhất 1 đáp án đúng";
      if (correctIndex.some((i) => !options[i]?.trim()))
        return "Đáp án đúng đang trống";
    }
    return null;
  };

  const submit = () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    const payload: Record<string, unknown> = {};
    if (isChoice) {
      const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
      payload.options = trimmedOptions;
      payload.answer =
        type === "multiple_choice"
          ? correctIndex.map((i) => options[i]?.trim())
          : options[correctIndex[0]]?.trim();
    } else if (type === "true_false") {
      payload.answer = tfAnswer;
    }
    if (explanation.trim()) payload.explanation = explanation.trim();

    createQuestion.mutate(
      {
        question_type: type,
        subject,
        topic: topic.trim(),
        difficulty: toCanonical(level),
        question_text: text.trim(),
        payload,
      },
      {
        onSuccess: () => {
          toast.success("Đã thêm câu hỏi vào ngân hàng cá nhân");
          close(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            ➕ Thêm câu hỏi thủ công
          </DialogTitle>
          <DialogDescription>
            Tạo câu hỏi mới trong ngân hàng cá nhân. Bạn có thể chọn 1 trong các
            kiểu phổ biến.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-bold mb-1.5 block">
              Kiểu câu hỏi
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_TYPES.map((t) => {
                const active = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    <div className="text-base">{t.emoji}</div>
                    <div className="font-bold text-xs mt-0.5">{t.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-bold">Môn học</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Chủ đề</Label>
              <Input
                placeholder="VD: Vòng tuần hoàn"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Mức độ</Label>
              <Select
                value={level}
                onValueChange={(v) => setLevel(v as BankItem["level"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">Nội dung câu hỏi</Label>
            <Textarea
              rows={3}
              placeholder={
                type === "fill_blank"
                  ? "Dùng ___ cho chỗ trống. VD: Nước sôi ở ___ độ C."
                  : "Nhập nội dung câu hỏi..."
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {isChoice && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-bold">
                  Phương án{" "}
                  {type === "multiple_choice" && "(chọn nhiều đáp án đúng)"}
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={addOption}
                  disabled={options.length >= 6}
                >
                  <Plus className="size-3.5 mr-1" />
                  Thêm phương án
                </Button>
              </div>
              <div className="space-y-2">
                {options.map((opt, i) => {
                  const checked = correctIndex.includes(i);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCorrect(i)}
                        className={`size-8 shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors ${
                          checked
                            ? "bg-success border-success text-success-foreground"
                            : "bg-background border-border hover:border-success"
                        }`}
                        title="Đánh dấu đáp án đúng"
                      >
                        {checked && <Check className="size-4" />}
                      </button>
                      <Input
                        placeholder={`Phương án ${String.fromCharCode(65 + i)}`}
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeOption(i)}
                        disabled={options.length <= 2}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {type === "true_false" && (
            <div>
              <Label className="text-xs font-bold mb-1.5 block">
                Đáp án đúng
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(["true", "false"] as const).map((v) => {
                  const active = tfAnswer === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTfAnswer(v)}
                      className={`rounded-xl border-2 p-3 font-bold transition-all ${
                        active
                          ? v === "true"
                            ? "border-success bg-success/15 text-success"
                            : "border-destructive bg-destructive/15 text-destructive"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      {v === "true" ? "✅ Đúng" : "❌ Sai"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs font-bold">Giải thích (tuỳ chọn)</Label>
            <Textarea
              rows={2}
              placeholder="Giải thích sẽ hiển thị cho học sinh sau khi trả lời."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => close(false)}
            disabled={createQuestion.isPending}
          >
            Huỷ
          </Button>
          <Button
            className="btn-pop"
            onClick={submit}
            disabled={createQuestion.isPending}
          >
            {createQuestion.isPending ? (
              <>
                <Loader2 className="size-4 mr-1 animate-spin" /> Đang thêm...
              </>
            ) : (
              <>
                <Plus className="size-4 mr-1" />
                Thêm vào ngân hàng
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================ */
/* Dialog: AI sinh câu hỏi                                      */
/* ============================================================ */

function AiGenerateDialog({
  open,
  onOpenChange,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGenerate: (qs: BankItem[]) => void;
}) {
  const [subject, setSubject] = useState("Khoa học 4");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<BankItem["level"]>("TB");
  const [count, setCount] = useState(5);
  const [type, setType] = useState<Question["type"]>("single_choice");
  const [loading, setLoading] = useState(false);

  // GAP-098: gọi AI THẬT (cùng bề mặt /api/ai/json như panel Trợ lý AI) — trước đây chỉ chờ
  // 900ms rồi sinh chuỗi mẫu "[AI] Câu {i} về {topic}", nên hai bề mặt "AI sinh" hành xử khác
  // nhau và câu hỏi sinh ra vô nghĩa.
  const submit = async () => {
    if (!topic.trim()) {
      toast.error("Vui lòng nhập chủ đề");
      return;
    }
    setLoading(true);

    const { data, error } = await callAIJson<{
      questions: { question: string; options?: string[]; answer?: string }[];
    }>({
      system:
        "Bạn là chuyên gia thiết kế câu hỏi cho học sinh tiểu học Việt Nam, bám sát chương trình GDPT 2018. Ngôn ngữ trong sáng, phù hợp lứa tuổi.",
      prompt: `Tạo ${count} câu hỏi loại "${TYPE_LABELS[type] ?? type}", mức độ ${level}, môn ${subject}, chủ đề: ${topic.trim()}.`,
      tool: {
        name: "generate_bank_questions",
        description: "Sinh câu hỏi cho ngân hàng câu hỏi",
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  answer: { type: "string" },
                },
                required: ["question"],
              },
            },
          },
          required: ["questions"],
        },
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error);
      return;
    }
    const generated = data?.questions ?? [];
    if (generated.length === 0) {
      toast.error(
        "AI chưa sinh được câu hỏi nào. Cô thử mô tả chủ đề rõ hơn nhé!",
      );
      return;
    }

    const qs: BankItem[] = generated.map((q, i) => ({
      id: `ai_${Date.now()}_${i}`,
      topic: topic.trim(),
      subject,
      type,
      level,
      text: q.question,
      options: q.options,
      answer: q.answer,
    }));
    onGenerate(qs);
    onOpenChange(false);
    setTopic("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Sparkles className="size-5 text-fun" /> AI sinh câu hỏi
          </DialogTitle>
          <DialogDescription>
            Mô tả chủ đề, mức độ và số lượng — AI sẽ sinh câu hỏi vào ngân hàng
            AI.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold">Môn học</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Mức độ</Label>
              <Select
                value={level}
                onValueChange={(v) => setLevel(v as BankItem["level"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs font-bold">Chủ đề</Label>
            <Input
              placeholder="VD: Vòng tuần hoàn của nước"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold">Kiểu câu hỏi</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as Question["type"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUICK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Số câu ({count})</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) =>
                  setCount(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                  )
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Huỷ
          </Button>
          <Button className="btn-pop" onClick={submit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="size-4 mr-1 animate-spin" /> Đang sinh...
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-1" /> Sinh câu hỏi
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
