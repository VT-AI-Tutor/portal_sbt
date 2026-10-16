import { useState } from "react";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Progress } from "@/core/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/ui/select";
import { CheckCircle2, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useSubjects, useLevels } from "@/core/reference";
import { useAccessToken } from "@/core/auth/AuthContext";
import { useConfirm } from "@/core/ui/confirm";
import { useTeacherClasses } from "@/modules/teacher/hooks/useTeacherClasses";
import { useBlueprintCatalog } from "@/modules/teacher/hooks/useTeacherBlueprint";
import {
  useClassSessions,
  useCreateLecture,
  useFinalizeLecture,
  useRegenerateLectureSection,
  useUpdateLectureSection,
} from "@/modules/teacher/hooks/useTeacherLectures";
import type {
  LectureBlock,
  LectureSectionKey,
  LectureSlide,
  TeacherLecture,
} from "@/modules/teacher/api/teacherLectureApi";
import {
  generateLectureDraft,
  generateSectionWithQuiz,
  type LectureGenProgress,
} from "@/modules/teacher/lib/lectureDraft";
import {
  blockingSectionGroups,
  blockingSectionKeys,
  sectionMissingQuiz,
} from "@/modules/teacher/lib/lectureFinalizeGate";
import { LectureSectionReview } from "@/modules/teacher/ui/shared/lecture/LectureSectionReview";
import { LectureAttachDialog } from "@/modules/teacher/ui/shared/lecture/LectureAttachDialog";

type Step = "form" | "generating" | "review";
type SectionOp = "regenerate" | "save";

/** KhoÃ¡ má»™t thao tÃ¡c Ä‘ang báº­n theo Cáº¶P (hoáº¡t Ä‘á»™ng, hÃ nh Ä‘á»™ng) â€” má»™t Ã´ Ä‘Æ¡n
 * (`busyKey`/`busyAction`) tá»«ng bá»‹ hai hoáº¡t Ä‘á»™ng khÃ¡c nhau tranh nhau ghi Ä‘Ã¨
 * (review Task 13 vÃ²ng 1, PhÃ¡t hiá»‡n 2): Sinh láº¡i á»Ÿ A cÃ²n Ä‘ang bay, báº¥m LÆ°u á»Ÿ
 * B thÃ¬ tráº¡ng thÃ¡i báº­n cá»§a A bá»‹ xoÃ¡ máº¥t â€” nÃºt A má»Ÿ láº¡i dÃ¹ mutation váº«n cháº¡y. */
function opKey(key: LectureSectionKey, action: SectionOp): string {
  return `${key}:${action}`;
}

export interface LectureFlowProps {
  /** Gá»i khi luá»“ng káº¿t thÃºc â€” huá»· á»Ÿ bÆ°á»›c khai, hoáº·c Ä‘Ã³ng há»™p thoáº¡i gáº¯n vÃ o tiáº¿t
   * sau khi hoÃ n táº¥t (gáº¯n xong hay bá» qua Ä‘á»u coi lÃ  xong luá»“ng). */
  onDone: () => void;
  /**
   * Tiáº¿p tá»¥c má»™t báº£n nhÃ¡p cÃ³ sáºµn â€” nháº£y THáº²NG vÃ o bÆ°á»›c duyá»‡t thay vÃ¬ bÆ°á»›c
   * khai (review Task 13 vÃ²ng 1, PhÃ¡t hiá»‡n 3): lÆ°u-trÆ°á»›c-khi-sinh chá»‰ cÃ³ Ã½
   * nghÄ©a náº¿u cÃ²n Ä‘Æ°á»ng quay láº¡i báº£n nhÃ¡p khi rá»›t máº¡ng/táº£i láº¡i trang giá»¯a
   * chá»«ng. DÃ¹ng cho nÃºt "Tiáº¿p tá»¥c soáº¡n" á»Ÿ TeacherLecturesPage.
   */
  initialLecture?: TeacherLecture;
}

/**
 * Luá»“ng SOáº N BÃ€I GIáº¢NG: khai thÃ´ng tin â†’ sinh (dÃ¢y chuyá»n `generateLectureDraft`
 * cá»§a Task 12, khuÃ´n save-before-generate cá»§a BlueprintFlow) â†’ duyá»‡t tá»«ng
 * hoáº¡t Ä‘á»™ng â†’ hoÃ n táº¥t (khoÃ¡ láº¡i) â†’ gáº¯n vÃ o tiáº¿t cá»§a má»™t lá»›p.
 *
 * Chá»‰ Ä‘iá»u phá»‘i láº¡i cÃ¡c lÆ°á»£t gá»i API cho láº§n SINH TRá»ŒN BÃ€I (Ä‘Ãºng dÃ¢y chuyá»n cÃ³
 * sáºµn); "Sinh láº¡i pháº§n nÃ y" cá»§a tá»«ng hoáº¡t Ä‘á»™ng thÆ°á»ng lÃ  Má»˜T lá»‡nh gá»i Ä‘Æ¡n láº»
 * (`useRegenerateLectureSection`) â€” TRá»ª hoáº¡t Ä‘á»™ng Ä‘ang thiáº¿u quiz (ná»™i dung cÃ³
 * nhÆ°ng `question_ids` rá»—ng, dáº¥u váº¿t "Tiáº¿p tá»¥c soáº¡n" má»™t báº£n nhÃ¡p rá»›t máº¡ng
 * Ä‘Ãºng bÆ°á»›c bá»‘c/gáº¯n quiz), lÃºc Ä‘Ã³ gá»i tháº³ng `generateSectionWithQuiz` cá»§a
 * lectureDraft.ts Ä‘á»ƒ Ä‘i trá»n bÆ°á»›c â€” khÃ´ng tá»± dá»±ng láº¡i logic bá»‘c cÃ¢u quiz.
 */
export function LectureFlow({ onDone, initialLecture }: LectureFlowProps) {
  const token = useAccessToken();
  const confirm = useConfirm();

  const [step, setStep] = useState<Step>(initialLecture ? "review" : "form");
  const [title, setTitle] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [level, setLevel] = useState("");
  const [contentCode, setContentCode] = useState("");
  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState("");

  const [progress, setProgress] = useState<LectureGenProgress | null>(null);
  const [lecture, setLecture] = useState<TeacherLecture | null>(
    initialLecture ?? null,
  );
  const [sectionErrors, setSectionErrors] = useState<
    Partial<Record<LectureSectionKey, string>>
  >({});
  // Set cÃ¡c "hoáº¡t Ä‘á»™ng:hÃ nh Ä‘á»™ng" Ä‘ang báº­n â€” xem `opKey` á»Ÿ trÃªn.
  const [busyOps, setBusyOps] = useState<Set<string>>(() => new Set());
  const [attachOpen, setAttachOpen] = useState(false);

  const setOpBusy = (
    key: LectureSectionKey,
    action: SectionOp,
    busy: boolean,
  ) =>
    setBusyOps((prev) => {
      const next = new Set(prev);
      const k = opKey(key, action);
      if (busy) next.add(k);
      else next.delete(k);
      return next;
    });

  const subjects = useSubjects();
  const levels = useLevels();
  const classes = useTeacherClasses();
  const sessions = useClassSessions(classId || undefined);
  const catalog = useBlueprintCatalog(subjectCode, level, false);

  const createLecture = useCreateLecture();
  const updateSection = useUpdateLectureSection();
  const regenerateSection = useRegenerateLectureSection();
  const finalizeLecture = useFinalizeLecture();

  const subjectLabel =
    subjects.data?.find((s) => s.code === subjectCode)?.label ?? "";

  const canGenerate =
    !!token &&
    title.trim().length > 0 &&
    subjectCode.length > 0 &&
    level.length > 0 &&
    contentCode.length > 0 &&
    !createLecture.isPending;

  const generate = async () => {
    if (!canGenerate || !token) return;

    // LÆ°u-trÆ°á»›c-khi-sinh: táº¡o bÃ i giáº£ng NGAY khi báº¥m Sinh, trÆ°á»›c khi cháº¡y dÃ¢y
    // chuyá»n â€” dÃ¢y chuyá»n há»ng giá»¯a chá»«ng thÃ¬ báº£n nhÃ¡p váº«n cÃ²n trong danh sÃ¡ch
    // (khuÃ´n `BlueprintFlow.generate()`).
    let created: TeacherLecture;
    try {
      created = await createLecture.mutateAsync({
        title: title.trim(),
        subject_code: subjectCode,
        subject: subjectLabel,
        level,
        content_code: contentCode,
        class_context: classId
          ? { class_id: classId, session_id: sessionId || undefined }
          : null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "KhÃ´ng táº¡o Ä‘Æ°á»£c bÃ i giáº£ng.");
      return;
    }

    setLecture(created);
    setStep("generating");
    setProgress({ done: 0, total: 1, current: "" });

    try {
      const result = await generateLectureDraft(
        created.id,
        {
          subject: subjectLabel,
          subject_code: subjectCode,
          level,
          content_code: contentCode,
        },
        token,
        { onProgress: setProgress, onLectureUpdate: setLecture },
      );
      setLecture(result.lecture);
      setSectionErrors(result.sectionErrors);

      const failedCount = Object.keys(result.sectionErrors).length;
      if (failedCount > 0) {
        toast.warning(
          `Sinh xong, cÃ²n ${failedCount} hoáº¡t Ä‘á»™ng lá»—i â€” tháº§y cÃ´ xem láº¡i.`,
        );
      } else {
        toast.success(
          "ÄÃ£ sinh xong bÃ i giáº£ng â€” tháº§y cÃ´ duyá»‡t láº¡i tá»«ng hoáº¡t Ä‘á»™ng.",
        );
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "KhÃ´ng dá»±ng Ä‘Æ°á»£c dÃ n khung bÃ i giáº£ng. Báº£n nhÃ¡p váº«n cÃ²n trong danh sÃ¡ch, tháº§y cÃ´ thá»­ láº¡i.",
      );
    } finally {
      setStep("review");
    }
  };

  const handleRegenerate = async (key: LectureSectionKey) => {
    if (!lecture || !token) return;
    setOpBusy(key, "regenerate", true);
    try {
      // "Tiáº¿p tá»¥c soáº¡n" má»™t báº£n nhÃ¡p dá»Ÿ: dÃ¢y chuyá»n gá»‘c cÃ³ thá»ƒ Ä‘Ã£ rá»›t máº¡ng
      // Ä‘Ãºng á»Ÿ bÆ°á»›c bá»‘c/gáº¯n quiz, Ä‘á»ƒ láº¡i hoáº¡t Ä‘á»™ng cÃ³ ná»™i dung nhÆ°ng
      // `question_ids` rá»—ng â€” nÃºt "Sinh láº¡i pháº§n nÃ y" trÆ°á»›c Ä‘Ã¢y chá»‰ gá»i
      // generateSection nÃªn bá» sÃ³t luÃ´n bÆ°á»›c quiz (xem docstring
      // generateSectionWithQuiz á»Ÿ lectureDraft.ts). Khi hoáº¡t Ä‘á»™ng Ä‘ang thiáº¿u
      // quiz THáº¬T (`sectionMissingQuiz` â€” CÃ™NG má»™t hÃ m vá»›i cá»•ng hoÃ n táº¥t,
      // review vÃ²ng 2 má»©c NghiÃªm trá»ng: trÆ°á»›c Ä‘Ã¢y tá»± mÃ£ hoÃ¡ riÃªng
      // `question_ids.length===0` á»Ÿ Ä‘Ã¢y nÃªn coi nháº§m cáº£ hoáº¡t Ä‘á»™ng "Ä‘Ã£ xÃ©t,
      // khÃ´ng cáº§n quiz" lÃ  thiáº¿u, Ä‘áº©y vÃ o vÃ²ng láº·p sinh láº¡i vÃ´ Ã­ch), Ä‘i trá»n
      // bÆ°á»›c (ná»™i dung + quiz) báº±ng ÄÃšNG logic Ä‘Ã£ cÃ³ trong dÃ¢y chuyá»n chÃ­nh â€”
      // khÃ´ng viáº¿t báº£n thá»© hai. Hoáº¡t Ä‘á»™ng Ä‘Ã£ cÃ³ quiz (hoáº·c khÃ´ng cáº§n quiz)
      // thÃ¬ giá»¯ NGUYÃŠN Ä‘Æ°á»ng cÅ© (chá»‰ Ä‘á»•i blocks/slides), trÃ¡nh re-roll quiz
      // Ä‘Ã£ duyá»‡t.
      const currentSection = lecture.sections.find((s) => s.key === key);
      const needsQuiz = currentSection
        ? sectionMissingQuiz(currentSection)
        : false;

      let updatedLecture: TeacherLecture;
      let aiDisabled: boolean;

      if (needsQuiz) {
        const used = new Set(
          lecture.sections.flatMap((s) => s.question_ids),
        );
        const result = await generateSectionWithQuiz(
          lecture.id,
          key,
          {
            subject: lecture.subject,
            subject_code: lecture.subject_code,
            level: lecture.level,
            content_code: lecture.content_code,
          },
          token,
          used,
        );
        updatedLecture = result.lecture;
        aiDisabled = result.aiDisabled;
      } else {
        const res = await regenerateSection.mutateAsync({
          lectureId: lecture.id,
          key,
        });
        updatedLecture = res.lecture;
        aiDisabled = res.ai_disabled;
      }

      setLecture(updatedLecture);
      setSectionErrors((prev) => {
        const next = { ...prev };
        if (aiDisabled) next[key] = "Trá»£ lÃ½ AI Ä‘ang táº¯t.";
        else delete next[key];
        return next;
      });
      if (!aiDisabled) toast.success("ÄÃ£ sinh láº¡i pháº§n nÃ y.");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "KhÃ´ng sinh láº¡i Ä‘Æ°á»£c pháº§n nÃ y.";
      setSectionErrors((prev) => ({ ...prev, [key]: msg }));
      toast.error(msg);
    } finally {
      setOpBusy(key, "regenerate", false);
    }
  };

  const handleSaveSection = async (
    key: LectureSectionKey,
    input: { blocks: LectureBlock[]; slides: LectureSlide[] },
  ) => {
    if (!lecture || !token) return;
    setOpBusy(key, "save", true);
    try {
      const updated = await updateSection.mutateAsync({
        lectureId: lecture.id,
        key,
        input,
      });
      setLecture(updated);
      setSectionErrors((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success("ÄÃ£ lÆ°u pháº§n nÃ y.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "KhÃ´ng lÆ°u Ä‘Æ°á»£c pháº§n nÃ y.");
    } finally {
      setOpBusy(key, "save", false);
    }
  };

  const handleFinalize = async () => {
    if (!lecture) return;
    // Cá»­a cháº·n hoÃ n táº¥t má»™t báº£n dá»Ÿ/há»ng (review Task 13 vÃ²ng 1, PhÃ¡t hiá»‡n 1):
    // hoÃ n táº¥t khoÃ¡ VÄ¨NH VIá»„N, nÃªn má»™t báº£n cÃ²n hoáº¡t Ä‘á»™ng rá»—ng (dÃ¢y chuyá»n
    // rá»›t máº¡ng giá»¯a chá»«ng) hay cÃ²n sectionErrors treo khÃ´ng Ä‘Æ°á»£c Ä‘i tiáº¿p.
    if (blockingSectionKeys(lecture.sections, sectionErrors).length > 0) {
      return;
    }
    // HoÃ n táº¥t lÃ  Ä‘iá»ƒm KHÃ”NG QUAY Láº I â€” mÃ¡y chá»§ khoÃ¡ bÃ i giáº£ng (status='ready'),
    // má»i láº§n sá»­a hoáº¡t Ä‘á»™ng sau Ä‘Ã³ bá»‹ tá»« chá»‘i. Pháº£i nÃ³i rÃµ trÆ°á»›c khi báº¥m.
    const ok = await confirm({
      title: "HoÃ n táº¥t bÃ i giáº£ng?",
      description:
        "Sau khi hoÃ n táº¥t, bÃ i giáº£ng sáº½ KHOÃ Láº I â€” khÃ´ng sá»­a Ä‘Æ°á»£c cÃ¡c hoáº¡t Ä‘á»™ng ná»¯a. Tháº§y cÃ´ kiá»ƒm tra ká»¹ ná»™i dung trÆ°á»›c khi xÃ¡c nháº­n.",
      confirmText: "HoÃ n táº¥t",
      cancelText: "Xem láº¡i thÃªm",
    });
    if (!ok) return;

    try {
      const finalized = await finalizeLecture.mutateAsync(lecture.id);
      setLecture(finalized);
      toast.success("ÄÃ£ hoÃ n táº¥t bÃ i giáº£ng.");
      setAttachOpen(true);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "KhÃ´ng hoÃ n táº¥t Ä‘Æ°á»£c bÃ i giáº£ng.",
      );
    }
  };

  if (step === "generating") {
    const total = progress?.total ?? 1;
    const done = progress?.done ?? 0;
    return (
      <Card className="p-6 border-2 space-y-3 text-center">
        <Sparkles className="size-8 mx-auto text-fun animate-pulse" />
        <div className="font-display font-bold text-lg">
          Äang soáº¡n bÃ i giáº£ngâ€¦
        </div>
        <div className="text-sm text-muted-foreground">
          {progress?.current || "Chuáº©n bá»‹"} Â· {Math.min(done + 1, total)}/
          {total}
        </div>
        <Progress value={total > 0 ? (done / total) * 100 : 0} />
      </Card>
    );
  }

  if (step === "review" && lecture) {
    // Review vÃ²ng 2 (má»©c Quan trá»ng) â€” trÆ°á»›c Ä‘Ã¢y gá»™p CHUNG má»™t cÃ¢u "chÆ°a
    // xong ná»™i dung hoáº·c cÃ²n lá»—i" cho cáº£ ca chá»‰ thiáº¿u quiz, khiáº¿n giÃ¡o viÃªn
    // tÆ°á»Ÿng ná»™i dung há»ng rá»“i báº¥m sinh láº¡i nháº§m chá»—. TÃ¡ch theo Ä‘Ãºng ba nhÃ³m
    // cá»§a `blockingSectionGroups` Ä‘á»ƒ nÃªu Ä‘Ãºng lÃ½ do cho tá»«ng hoáº¡t Ä‘á»™ng.
    const blockingGroups = blockingSectionGroups(lecture.sections, sectionErrors);
    const titleOf = (key: LectureSectionKey) =>
      lecture.sections.find((s) => s.key === key)?.title ?? key;
    const incompleteTitles = blockingGroups.incomplete.map(titleOf);
    const missingQuizTitles = blockingGroups.missingQuiz.map(titleOf);
    const erroredTitles = blockingGroups.errored.map(titleOf);
    const blocking = blockingSectionKeys(lecture.sections, sectionErrors);
    const hasBlockers = blocking.length > 0;
    const canFinalize = lecture.status === "draft" && blocking.length === 0;

    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold">{lecture.title}</h2>
          <p className="text-sm text-muted-foreground">
            {lecture.subject} Â· Lá»›p {lecture.level}
          </p>
        </div>

        <div className="space-y-3">
          {lecture.sections.map((section) => (
            <LectureSectionReview
              key={`${section.key}-${section.generated_at ?? ""}-${section.edited_at ?? ""}`}
              section={section}
              errorMessage={sectionErrors[section.key]}
              regenerating={busyOps.has(opKey(section.key, "regenerate"))}
              saving={busyOps.has(opKey(section.key, "save"))}
              onRegenerate={(key) => void handleRegenerate(key)}
              onSave={(key, input) => void handleSaveSection(key, input)}
            />
          ))}
        </div>

        {lecture.status === "draft" && (
          <div className="space-y-2">
            {hasBlockers && (
              <div
                data-testid="lecture-finalize-blockers"
                className="text-sm text-warning bg-warning/10 rounded-lg p-2 space-y-1"
              >
                {incompleteTitles.length > 0 && (
                  <p>
                    CÃ²n {incompleteTitles.length} hoáº¡t Ä‘á»™ng chÆ°a xong ná»™i
                    dung: <strong>{incompleteTitles.join(", ")}</strong> â€”
                    sinh láº¡i hoáº·c lÆ°u ná»™i dung cho cÃ¡c hoáº¡t Ä‘á»™ng nÃ y trÆ°á»›c khi
                    hoÃ n táº¥t.
                  </p>
                )}
                {missingQuizTitles.length > 0 && (
                  <p>
                    CÃ²n {missingQuizTitles.length} hoáº¡t Ä‘á»™ng cÃ²n thiáº¿u cÃ¢u
                    há»i tráº¯c nghiá»‡m:{" "}
                    <strong>{missingQuizTitles.join(", ")}</strong> â€” báº¥m
                    "Sinh láº¡i pháº§n nÃ y" Ä‘á»ƒ bá»‘c/gáº¯n quiz trÆ°á»›c khi hoÃ n táº¥t.
                  </p>
                )}
                {erroredTitles.length > 0 && (
                  <p>
                    CÃ²n {erroredTitles.length} hoáº¡t Ä‘á»™ng cÃ²n lá»—i cáº§n thá»­ láº¡i:{" "}
                    <strong>{erroredTitles.join(", ")}</strong>.
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={() => void handleFinalize()}
                disabled={!canFinalize || finalizeLecture.isPending}
                className="bg-success hover:bg-success/90"
              >
                <CheckCircle2 className="size-4 mr-1" />
                {finalizeLecture.isPending
                  ? "Äang hoÃ n táº¥tâ€¦"
                  : "HoÃ n táº¥t bÃ i giáº£ng"}
              </Button>
            </div>
          </div>
        )}

        <LectureAttachDialog
          open={attachOpen}
          onOpenChange={(v) => {
            setAttachOpen(v);
            if (!v) onDone();
          }}
          lecture={lecture}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-2 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <Label htmlFor="lecture-title">TÃªn bÃ i giáº£ng</Label>
            <Input
              id="lecture-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VÃ­ dá»¥: PhÃ¢n sá»‘ â€” ToÃ¡n 6"
              className="mt-1"
            />
          </div>
          <div>
            <Label>MÃ´n</Label>
            <Select
              value={subjectCode}
              onValueChange={(v) => {
                setSubjectCode(v);
                setContentCode("");
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chá»n mÃ´n" />
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
            <Label>Khá»‘i lá»›p</Label>
            <Select
              value={level}
              onValueChange={(v) => {
                setLevel(v);
                setContentCode("");
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chá»n khá»‘i" />
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
          <div>
            <Label>Chá»§ Ä‘á»</Label>
            <Select
              value={contentCode}
              onValueChange={setContentCode}
              disabled={!catalog.data || catalog.data.topics.length === 0}
            >
              <SelectTrigger className="mt-1">
                <SelectValue
                  placeholder={catalog.isLoading ? "Äang táº£iâ€¦" : "Chá»n chá»§ Ä‘á»"}
                />
              </SelectTrigger>
              <SelectContent>
                {(catalog.data?.topics ?? []).map((t) => (
                  <SelectItem key={t.content_code} value={t.content_code}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Lá»›p sáº½ dáº¡y (tuá»³ chá»n)</Label>
            <Select
              value={classId || "none"}
              onValueChange={(v) => {
                const next = v === "none" ? "" : v;
                setClassId(next);
                setSessionId("");
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="ChÆ°a chá»n lá»›p" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ChÆ°a chá»n lá»›p</SelectItem>
                {(classes.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tiáº¿t há»c (tuá»³ chá»n)</Label>
            <Select
              value={sessionId || "none"}
              onValueChange={(v) => setSessionId(v === "none" ? "" : v)}
              disabled={!classId}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="ChÆ°a chá»n tiáº¿t" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ChÆ°a chá»n tiáº¿t</SelectItem>
                {(sessions.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Chá»‰ Ä‘á»ƒ ghi ngá»¯ cáº£nh cho bÃ i giáº£ng â€” gáº¯n tháº­t cho lá»›p lÃ m á»Ÿ bÆ°á»›c
              sau khi hoÃ n táº¥t.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Huá»·
        </Button>
        <Button
          onClick={() => void generate()}
          disabled={!canGenerate}
          className="bg-fun hover:bg-fun/90 text-fun-foreground"
        >
          {createLecture.isPending ? (
            <Loader2 className="size-4 mr-1 animate-spin" />
          ) : (
            <Wand2 className="size-4 mr-1" />
          )}
          Sinh bÃ i giáº£ng
        </Button>
      </div>
    </div>
  );
}
