import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Skeleton } from "@/core/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/core/ui/tabs";
import {
  Dumbbell,
  Gamepad2,
  Award,
  BookOpen,
  Sparkles,
  ArrowRight,
  Library,
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  PlayCircle,
  AlertTriangle,
  SlidersHorizontal,
  Route,
} from "lucide-react";
import { cn } from "@/core/lib/utils";
import { getSubjectDisplay } from "@/core/reference";
import { useAuth } from "@/core/auth/AuthContext";
import {
  usePracticeSuggestions,
  usePracticeTopics,
  usePracticeLibrary,
  usePracticeTopicsBySubject,
  usePracticeLibraryBySubject,
  useCreatePracticeSession,
  useCurrentPracticeSession,
} from "@/modules/student/api/hooks";
import type { SubjectSlice } from "@/modules/student/api/hooks";
import type {
  CreateSessionInput,
  PracticeSuggestion,
  LibrarySet,
} from "@/modules/student/api/practiceApi";
import { masteryColor } from "./competency/masteryColor";
import { modeToApi, type UiModeId } from "./modeToApi";
import { getStudentSubjects, getStudentSubjectCodes } from "./studentSubjects";
import { CustomPracticeBuilder } from "./CustomPracticeBuilder";
import { StudyPathPracticeTab } from "./StudyPathPracticeTab";
import { useUnitReviewSuggestions } from "@/modules/student/api/hooks";

const MODES = [
  {
    id: "practice",
    label: "Luyá»‡n táº­p",
    icon: Dumbbell,
    desc: "CÃ³ gá»£i Ã½, khÃ´ng tÃ­nh giá»",
    color: "bg-info/15 text-info",
  },
  {
    id: "game",
    label: "ChÆ¡i game",
    icon: Gamepad2,
    desc: "Vui nhá»™n, cÃ³ XP & huy hiá»‡u",
    color: "bg-fun/15 text-fun",
  },
  {
    id: "test",
    label: "Thi thá»­",
    icon: Award,
    desc: "TÃ­nh giá», cháº¥m Ä‘iá»ƒm",
    color: "bg-warning/15 text-warning",
  },
] as const satisfies readonly { id: UiModeId; label: string; icon: typeof Dumbbell; desc: string; color: string }[];

type ModeId = UiModeId;
type SubjectKey = string;
type TabId = "path" | "suggestions" | "custom" | "library";

const PRIORITY_LABEL: Record<PracticeSuggestion["priority"], string> = {
  high: "Æ¯u tiÃªn cao",
  should: "NÃªn luyá»‡n",
  reinforce: "Cá»§ng cá»‘",
};
const PRIORITY_COLOR: Record<PracticeSuggestion["priority"], string> = {
  high: "bg-destructive/15 text-destructive border-destructive/40",
  should: "bg-warning/15 text-warning border-warning/40",
  reinforce: "bg-success/15 text-success border-success/40",
};

const MISSING_LEVEL_MESSAGE =
  "Vui lÃ²ng cáº­p nháº­t khá»‘i lá»›p trong há»“ sÆ¡ Ä‘á»ƒ báº¯t Ä‘áº§u luyá»‡n táº­p nhÃ©.";

function SubjectChips({
  subject,
  onChange,
  level,
}: {
  subject: SubjectKey;
  onChange: (k: SubjectKey) => void;
  level: string | null;
}) {
  const subjects = getStudentSubjects(level);
  return (
    <div className="flex flex-wrap gap-2">
      {subjects.map((s) => (
        <button
          key={s.code}
          onClick={() => onChange(s.code)}
          className={cn(
            "px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-all",
            subject === s.code
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:border-primary/60",
          )}
        >
          <span className="mr-1">{s.emoji}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}

function ModePicker({
  mode,
  onChange,
}: {
  mode: ModeId;
  onChange: (m: ModeId) => void;
}) {
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            "text-left p-3 rounded-xl border-2 transition-all",
            mode === m.id
              ? "border-primary bg-primary/5 -translate-y-0.5 shadow-sm"
              : "border-border bg-card hover:border-primary/60",
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "size-9 rounded-lg flex items-center justify-center",
                m.color,
              )}
            >
              <m.icon className="size-4" />
            </div>
            <div>
              <div className="font-bold text-sm">{m.label}</div>
              <div className="text-[11px] text-muted-foreground">{m.desc}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function StudentPracticePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const level = typeof user?.level === "string" ? user.level : null;

  const [tab, setTab] = useState<TabId>("custom");
  const [subject, setSubject] = useState<SubjectKey>("all");
  const [mode, setMode] = useState<ModeId>("practice");
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const apiSubject = subject === "all" ? undefined : subject;
  const isSubjectPicked = subject !== "all";
  const allSubjectCodes = getStudentSubjectCodes(level);

  const {
    data: suggestions,
    isLoading: suggestionsLoading,
    isError: suggestionsIsError,
  } = usePracticeSuggestions(apiSubject, allSubjectCodes);

  const { data: topicsData, isLoading: topicsLoading } = usePracticeTopics(subject);

  const {
    data: libraryData,
    isLoading: libraryLoading,
    isError: libraryIsError,
    error: libraryError,
  } = usePracticeLibrary(subject);

  // "Táº¥t cáº£" â†’ Netflix-style rows per subject (fan out one query per subject).
  const topicsBySubject = usePracticeTopicsBySubject(allSubjectCodes, !isSubjectPicked);
  const libraryBySubject = usePracticeLibraryBySubject(allSubjectCodes, !isSubjectPicked);

  const { data: currentSession } = useCurrentPracticeSession();

  const createSession = useCreatePracticeSession();
  const { data: unitReview } = useUnitReviewSuggestions(subject);

  const topics = topicsData?.topics ?? [];
  const sets = libraryData?.sets ?? [];

  function startSession(key: string, input: CreateSessionInput) {
    if (!level) {
      toast.error(MISSING_LEVEL_MESSAGE);
      return;
    }
    setPendingKey(key);
    createSession.mutate(input, {
      onSuccess: (session) => {
        navigate(`/student/practice/session/${session.id}`);
      },
      onError: (err) => {
        toast.error(err.message || "KhÃ´ng táº¡o Ä‘Æ°á»£c phiÃªn luyá»‡n táº­p, em thá»­ láº¡i nhÃ©.");
      },
      onSettled: () => setPendingKey(null),
    });
  }

  function handleSuggestionCta(item: PracticeSuggestion) {
    startSession(item.key, {
      mode: modeToApi(mode),
      source: "ai_suggested",
      subject_code: item.subject_code,
      level: level ?? "",
      ref: item.ref,
      question_count: item.question_count,
    });
  }

  function handleLibraryCta(
    set: LibrarySet,
    lvl: LibrarySet["levels"][number],
    subjectCode: string,
  ) {
    startSession(`library-${set.content_code}-${lvl.level_code}`, {
      mode: modeToApi(mode),
      source: "library",
      subject_code: subjectCode,
      level: level ?? "",
      ref: lvl.ref,
      question_count: lvl.suggested_count,
    });
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Dumbbell className="text-primary" /> Luyá»‡n táº­p
        </h1>
        <p className="text-muted-foreground">
          Luyá»‡n thÃªm bÃ i cÃ´ giao khÃ´ng báº¯t buá»™c, hoáº·c khÃ¡m phÃ¡ kho sÃ¡ch bÃ i
          táº­p cá»§a NXBGDVN â€” há»c theo Ã½ em!
        </p>
      </div>

      {/* Resume banner */}
      {currentSession && currentSession.status === "in_progress" && (
        <Card className="p-4 border-2 border-fun/30 bg-fun/5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <PlayCircle className="size-5 text-fun shrink-0" />
              <div className="text-sm">
                <b className="text-fun">Em Ä‘ang cÃ³ bÃ i luyá»‡n dá»Ÿ</b> â€” tiáº¿p tá»¥c
                Ä‘á»ƒ khÃ´ng máº¥t tiáº¿n Ä‘á»™ nhÃ©!
              </div>
            </div>
            <Button
              size="sm"
              className="btn-pop rounded-full"
              onClick={() => navigate(`/student/practice/session/${currentSession.id}`)}
            >
              Tiáº¿p tá»¥c
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Mode picker */}
      <Card className="p-4 border-2">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-4 text-primary" />
          <div className="text-xs uppercase font-bold text-muted-foreground">
            Chá»n cháº¿ Ä‘á»™ luyá»‡n táº­p
          </div>
        </div>
        <ModePicker mode={mode} onChange={setMode} />
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList className="grid grid-cols-4 w-full max-w-3xl">
          <TabsTrigger value="path" className="gap-2">
            <Route className="size-4" />
            Lá»™ trÃ¬nh
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2">
            <Brain className="size-4" />
            AI gá»£i Ã½ theo nÄƒng lá»±c
            {!suggestionsLoading && (
              <Badge variant="secondary" className="ml-1">
                {(suggestions?.length ?? 0).toLocaleString("vi-VN")}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-2">
            <SlidersHorizontal className="size-4" />
            Tá»± luyá»‡n
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-2">
            <Library className="size-4" />
            ThÆ° viá»‡n SBT
            {isSubjectPicked && !libraryLoading && (
              <Badge variant="secondary" className="ml-1">
                {sets.length.toLocaleString("vi-VN")}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Subject filter */}
        <Card className="p-4 border-2 mt-4">
          <div className="text-xs uppercase font-bold text-muted-foreground mb-2">
            Lá»c theo mÃ´n
          </div>
          <SubjectChips subject={subject} onChange={setSubject} level={level} />
        </Card>

        {/* TAB Lá»™ trÃ¬nh (LÃ¡t L3): Ä‘Æ°á»ng vÃ o chÃ­nh â€” Ä‘iá»u hÆ°á»›ng chÆ°Æ¡ng trÃ¬nh há»c,
            luyá»‡n theo scope unit cá»§a bÃ i/chÆ°Æ¡ng (Â§8.1.1). */}
        <TabsContent value="path" className="mt-4">
          <StudyPathPracticeTab
            subject={subject}
            level={level}
            mode={modeToApi(mode)}
            onStart={startSession}
            pendingKey={pendingKey}
            isPending={createSession.isPending}
          />
        </TabsContent>

        {/* TAB 1: AI gá»£i Ã½ theo nÄƒng lá»±c */}
        <TabsContent value="suggestions" className="mt-4">
          {/* LÃ¡t L5 (Â§8.2 spaced_review): Ã´n giÃ£n cÃ¡ch theo ÄÆ N Vá»Š KIáº¾N THá»¨C â€”
              Æ°u tiÃªn ká»¹ nÄƒng Ã­t lÆ°á»£t lÃ m Ã— lÃ¢u chÆ°a gáº·p, chá»‰ trÃªn nhá»¯ng gÃ¬ em
              Ä‘Ã£ tá»«ng luyá»‡n. áº¨n khi chÆ°a chá»n mÃ´n hoáº·c chÆ°a cÃ³ dá»¯ liá»‡u. */}
          {subject && (unitReview?.length ?? 0) > 0 && (
            <Card className="p-4 border-2 border-warning/40 bg-warning/5 mb-4">
              <div className="text-xs uppercase font-bold text-muted-foreground mb-2">
                Ã”n láº¡i káº»o quÃªn â€” theo ká»¹ nÄƒng
              </div>
              <div className="space-y-2">
                {(unitReview ?? []).slice(0, 4).map((item) => {
                  const key = `unit-review-${item.key}`;
                  return (
                    <div key={item.key} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round(item.mastery_percent)}% thÃ nh tháº¡o
                          {item.stale ? " Â· lÃ¢u chÆ°a Ã´n" : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={createSession.isPending}
                        onClick={() =>
                          startSession(key, {
                            mode: modeToApi(mode),
                            source: "unit",
                            subject_code: item.subject_code,
                            level: level ?? "",
                            ref: { unit_code: item.key },
                            question_count: Math.max(3, Math.min(10, item.question_count)),
                          })
                        }
                      >
                        {pendingKey === key && createSession.isPending ? "Äang táº¡oâ€¦" : "Ã”n láº¡i"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="p-4 border-2 border-primary/30 bg-primary/5 mb-4">
            <div className="flex items-start gap-3">
              <Brain className="size-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <b className="text-primary">AI gá»£i Ã½ theo nÄƒng lá»±c cá»§a em</b>{" "}
                â€” phÃ¢n tÃ­ch tá»« káº¿t quáº£ bÃ i táº­p gáº§n Ä‘Ã¢y. Táº­p trung nhá»¯ng ká»¹
                nÄƒng cÃ²n yáº¿u Ä‘á»ƒ tiáº¿n bá»™ nhanh nháº¥t!
              </div>
            </div>
          </Card>

          {suggestionsLoading ? (
            <LoadingGrid />
          ) : suggestionsIsError ? (
            <ErrorState text="KhÃ´ng táº£i Ä‘Æ°á»£c gá»£i Ã½. Thá»­ láº¡i sau nhÃ©!" />
          ) : !suggestions || suggestions.length === 0 ? (
            <EmptyState text="ChÆ°a cÃ³ gá»£i Ã½ nÃ o á»Ÿ mÃ´n nÃ y. HÃ£y luyá»‡n táº­p thÃªm Ä‘á»ƒ AI gá»£i Ã½ nhÃ©!" />
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {suggestions.map((item) => (
                <CompetencyCard
                  key={item.key}
                  item={item}
                  mode={mode}
                  pending={pendingKey === item.key && createSession.isPending}
                  onCta={() => handleSuggestionCta(item)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Tá»± luyá»‡n */}
        <TabsContent value="custom" className="mt-4">
          <Card className="p-4 border-2 border-info/30 bg-info/5 mb-4">
            <div className="flex items-start gap-3">
              <SlidersHorizontal className="size-5 text-info shrink-0 mt-0.5" />
              <div className="text-sm">
                <b className="text-info">Tá»± luyá»‡n theo Ã½ em</b> â€” tá»± chá»n Ä‘á»™
                khÃ³, chá»§ Ä‘á» vÃ  sá»‘ lÆ°á»£ng cÃ¢u há»i Ä‘á»ƒ cÃ³ má»™t buá»•i luyá»‡n táº­p vá»«a
                sá»©c nháº¥t.
              </div>
            </div>
          </Card>
          <CustomPracticeBuilder
            mode={mode}
            subject={subject}
            level={level}
            topics={topics}
            topicsBySubject={topicsBySubject}
            topicsLoading={
              isSubjectPicked
                ? topicsLoading
                : topicsBySubject.some((s) => s.isLoading)
            }
            pending={
              pendingKey?.startsWith("custom-") === true && createSession.isPending
            }
            onStart={startSession}
          />
        </TabsContent>

        {/* TAB 3: ThÆ° viá»‡n luyá»‡n táº­p */}
        <TabsContent value="library" className="mt-4">
          <Card className="p-4 border-2 border-fun/30 bg-fun/5 mb-4">
            <div className="flex items-start gap-3">
              <BookOpen className="size-5 text-fun shrink-0 mt-0.5" />
              <div className="text-sm">
                <b className="text-fun">Kho cÃ¢u há»i NXBGDVN</b> â€” chá»n má»©c Ä‘á»™
                phÃ¹ há»£p trong tá»«ng chá»§ Ä‘á» Ä‘á»ƒ luyá»‡n thÃªm.
              </div>
            </div>
          </Card>

          {!isSubjectPicked ? (
            <SubjectLibraryRows
              rows={libraryBySubject}
              mode={mode}
              pendingKey={pendingKey}
              isPending={createSession.isPending}
              onSeeAll={setSubject}
              onCta={handleLibraryCta}
            />
          ) : libraryLoading ? (
            <LoadingGrid />
          ) : libraryIsError ? (
            <ErrorState text={libraryError?.message ?? "KhÃ´ng táº£i Ä‘Æ°á»£c thÆ° viá»‡n luyá»‡n táº­p."} />
          ) : sets.length === 0 ? (
            <EmptyState text="KhÃ´ng cÃ³ bÃ i nÃ o trong mÃ´n nÃ y." />
          ) : (
            <div className="space-y-3">
              {sets.map((set) => (
                <LibrarySetCard
                  key={set.content_code}
                  set={set}
                  mode={mode}
                  pendingKey={pendingKey}
                  isPending={createSession.isPending}
                  onCta={(lvl) => handleLibraryCta(set, lvl, subject)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompetencyCard({
  item,
  mode,
  pending,
  onCta,
}: {
  item: PracticeSuggestion;
  mode: ModeId;
  pending: boolean;
  onCta: () => void;
}) {
  const modeObj = MODES.find((m) => m.id === mode)!;
  const TrendIcon =
    item.trend === "up"
      ? TrendingUp
      : item.trend === "down"
        ? TrendingDown
        : Target;
  const trendColor =
    item.trend === "up"
      ? "text-success"
      : item.trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  const color = masteryColor(item.mastery_percent);
  return (
    <Card className="p-4 border-2 hover:border-primary transition-all hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase font-bold text-muted-foreground">
            {getSubjectDisplay(item.subject_code).label}
          </div>
          <div className="font-display font-bold mt-0.5">{item.title}</div>
        </div>
        <span
          className={cn(
            "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border",
            PRIORITY_COLOR[item.priority],
          )}
        >
          {PRIORITY_LABEL[item.priority]}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Má»©c Ä‘á»™ thÃ nh tháº¡o</span>
          <span
            className={cn(
              "font-bold inline-flex items-center gap-1",
              trendColor,
            )}
          >
            <TrendIcon className="size-3.5" />
            {item.mastery_percent}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${item.mastery_percent}%`, backgroundColor: color.hex }}
          />
        </div>
      </div>

      <div className="mt-3 text-xs text-muted-foreground italic">
        ðŸ’¡ {item.reason_text}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold",
            modeObj.color,
          )}
        >
          <modeObj.icon className="size-3" />
          {modeObj.label} Â· {item.question_count.toLocaleString("vi-VN")} cÃ¢u
        </span>
        <Button size="sm" className="btn-pop rounded-full" disabled={pending} onClick={onCta}>
          {pending ? "Äang táº¡o..." : "Luyá»‡n ngay"}
          {!pending && <ArrowRight className="size-3.5 ml-1" />}
        </Button>
      </div>
    </Card>
  );
}

function LibrarySetCard({
  set,
  mode,
  pendingKey,
  isPending,
  onCta,
}: {
  set: LibrarySet;
  mode: ModeId;
  pendingKey: string | null;
  isPending: boolean;
  onCta: (lvl: LibrarySet["levels"][number]) => void;
}) {
  const modeObj = MODES.find((m) => m.id === mode)!;
  return (
    <Card className="p-4 border-2">
      <div className="flex items-center gap-2 mb-3">
        <Library className="size-4 text-fun" />
        <div className="font-display font-bold">{set.label}</div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {set.levels.map((lvl) => {
          const key = `library-${set.content_code}-${lvl.level_code}`;
          const pending = pendingKey === key && isPending;
          return (
            <div
              key={lvl.level_code}
              className="rounded-lg border p-3 bg-card flex flex-col gap-2"
            >
              <div className="text-xs font-bold">{lvl.label}</div>
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <BookOpen className="size-3" />
                {lvl.question_available.toLocaleString("vi-VN")} cÃ¢u kháº£ dá»¥ng
              </div>
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                  modeObj.color,
                )}
              >
                <modeObj.icon className="size-3" />
                {modeObj.label}
              </span>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full mt-auto"
                disabled={pending}
                onClick={() => onCta(lvl)}
              >
                {pending
                  ? "Äang táº¡o..."
                  : `Luyá»‡n ${lvl.suggested_count.toLocaleString("vi-VN")} cÃ¢u`}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Cards shown per subject before "Xem háº¿t" in the "Táº¥t cáº£" (Netflix) view. */
const PREVIEW_COUNT = 6;

/** A titled subject row with a "Xem háº¿t" shortcut that filters by that subject. */
function SubjectRowShell({
  subjectCode,
  onSeeAll,
  children,
}: {
  subjectCode: string;
  onSeeAll: () => void;
  children: ReactNode;
}) {
  const disp = getSubjectDisplay(subjectCode);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="font-display font-bold text-lg flex items-center gap-2">
          <span>{disp.emoji}</span>
          {disp.label}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-muted-foreground hover:text-primary"
          onClick={onSeeAll}
        >
          Xem háº¿t
          <ArrowRight className="size-3.5 ml-1" />
        </Button>
      </div>
      {children}
    </div>
  );
}

function SubjectLibraryRows({
  rows,
  mode,
  pendingKey,
  isPending,
  onSeeAll,
  onCta,
}: {
  rows: SubjectSlice<LibrarySet>[];
  mode: ModeId;
  pendingKey: string | null;
  isPending: boolean;
  onSeeAll: (subjectCode: string) => void;
  onCta: (
    set: LibrarySet,
    lvl: LibrarySet["levels"][number],
    subjectCode: string,
  ) => void;
}) {
  const anyLoading = rows.some((r) => r.isLoading);
  const hasAny = rows.some((r) => (r.data?.length ?? 0) > 0);
  if (!anyLoading && !hasAny) {
    return <EmptyState text="ChÆ°a cÃ³ bÃ i luyá»‡n nÃ o á»Ÿ khá»‘i lá»›p nÃ y." />;
  }
  return (
    <div className="space-y-6">
      {rows.map((row) => {
        if (row.isLoading) return <RowSkeleton key={row.subjectCode} />;
        const items = (row.data ?? []).slice(0, PREVIEW_COUNT);
        if (items.length === 0) return null;
        return (
          <SubjectRowShell
            key={row.subjectCode}
            subjectCode={row.subjectCode}
            onSeeAll={() => onSeeAll(row.subjectCode)}
          >
            <div className="space-y-3">
              {items.map((set) => (
                <LibrarySetCard
                  key={set.content_code}
                  set={set}
                  mode={mode}
                  pendingKey={pendingKey}
                  isPending={isPending}
                  onCta={(lvl) => onCta(set, lvl, row.subjectCode)}
                />
              ))}
            </div>
          </SubjectRowShell>
        );
      })}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div>
      <Skeleton className="h-6 w-40 mb-2" />
      <div className="grid md:grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  );
}

function ErrorState({ text }: { text: string }) {
  return (
    <Card className="p-8 border-2 border-dashed border-destructive/40 text-center">
      <AlertTriangle className="size-10 text-destructive mx-auto mb-2" />
      <p className="text-sm text-destructive">{text}</p>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="p-8 border-2 border-dashed text-center">
      <BookOpen className="size-10 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  );
}
