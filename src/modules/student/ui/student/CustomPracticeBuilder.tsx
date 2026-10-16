import { useMemo, useState } from "react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Layers, Puzzle, Hash, ArrowRight, SlidersHorizontal } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { getSubjectDisplay } from "@/core/reference";
import {
  useCompetencyOverview,
  useStudyPaths,
  useStudyPathTree,
} from "@/modules/student/api/hooks";
import type { SubjectSlice } from "@/modules/student/api/hooks";
import type {
  CreateSessionInput,
  PracticeTopic,
} from "@/modules/student/api/practiceApi";
import { modeToApi, type UiModeId } from "./modeToApi";
import {
  buildStudyTopicChips,
  buildTopicChips,
  parseCustomCount,
  COUNT_PRESETS,
  COUNT_MIN,
  COUNT_MAX,
  practiceBlockedReason,
  type TopicChipItem,
} from "./customPracticeLogic";

/**
 * Tab "Tá»± luyá»‡n" â€” há»c sinh tá»± build bÃ i luyá»‡n: Ä‘á»™ khÃ³ (má»©c nháº­n thá»©c cá»§a
 * framework) + chá»§ Ä‘á» + sá»‘ cÃ¢u. MÃ´n láº¥y tá»« bá»™ lá»c "Lá»c theo mÃ´n" dÃ¹ng chung;
 * khi lá»c "Táº¥t cáº£" cÃ¡c chip chá»§ Ä‘á» mang prefix mÃ´n vÃ  tá»± suy ra mÃ´n khi chá»n.
 */
export function CustomPracticeBuilder({
  mode,
  subject,
  level,
  topics,
  topicsBySubject,
  topicsLoading,
  pending,
  onStart,
}: {
  mode: UiModeId;
  subject: string; // "all" hoáº·c mÃ£ mÃ´n Ä‘ang lá»c
  level: string | null;
  topics: PracticeTopic[];
  topicsBySubject: SubjectSlice<PracticeTopic>[];
  topicsLoading: boolean;
  pending: boolean;
  onStart: (key: string, input: CreateSessionInput) => void;
}) {
  const { data: overview } = useCompetencyOverview();
  const levels = overview?.framework.levels ?? [];

  // BÃ i cá»§a Lá»˜ TRÃŒNH cho mÃ´n Ä‘ang lá»c (Owner 21/08) â€” thay chip mÃ£ ContentNode
  // thÃ´; mÃ´n chÆ°a cÃ³ lá»™ trÃ¬nh rÆ¡i vá» chip chá»§ Ä‘á» cÅ©.
  const { data: paths } = useStudyPaths(subject !== "all" ? subject : null, level);
  const pathId = paths?.items?.[0]?.id ?? null;
  const { data: pathTree } = useStudyPathTree(pathId);

  const [levelCode, setLevelCode] = useState<string | null>(null);
  const [topicKey, setTopicKey] = useState("all");
  const [count, setCount] = useState(10);
  const [customRaw, setCustomRaw] = useState("");
  const [useCustomCount, setUseCustomCount] = useState(false);

  const chips = useMemo(
    () =>
      buildTopicChips(
        subject,
        topics,
        topicsBySubject,
        (c) => getSubjectDisplay(c).label,
        buildStudyTopicChips(subject, pathTree),
      ),
    [subject, topics, topicsBySubject, pathTree],
  );
  // Äá»•i bá»™ lá»c mÃ´n â†’ chip Ä‘Ã£ chá»n cÃ³ thá»ƒ biáº¿n máº¥t: quay vá» Tá»•ng há»£p.
  const chip: TopicChipItem = chips.find((c) => c.key === topicKey) ?? chips[0];

  const selectedLevel = levels.find((l) => l.code === levelCode) ?? levels[0];
  const parsed = useCustomCount ? parseCustomCount(customRaw) : null;
  const effectiveCount = parsed?.ok ? parsed.value : useCustomCount ? null : count;
  const needSubject = chip.subjectCode === null; // Tá»•ng há»£p khi lá»c "Táº¥t cáº£"
  const canStart =
    !!level && !!selectedLevel && !needSubject && effectiveCount !== null && !pending;

  const blockedReason = practiceBlockedReason({
    pending,
    needSubject,
    hasLevel: !!selectedLevel,
    count: effectiveCount,
  });

  function handleStart() {
    if (!canStart || !chip.subjectCode || !selectedLevel || effectiveCount === null) {
      return;
    }
    onStart(`custom-${chip.key}`, {
      mode: modeToApi(mode),
      source: "custom",
      subject_code: chip.subjectCode,
      level: level ?? "",
      // Chip bÃ i lá»™ trÃ¬nh â†’ phiÃªn scope theo unit cá»§a bÃ i (Â§8.1.1); chip chá»§
      // Ä‘á» cÅ© giá»¯ ref.content_code; Tá»•ng há»£p khÃ´ng gá»­i ref.
      ...(chip.studyTopicId
        ? { ref: { study_topic_id: chip.studyTopicId } }
        : chip.contentCode
          ? { ref: { content_code: chip.contentCode } }
          : {}),
      level_code: selectedLevel.code,
      question_count: effectiveCount,
    });
  }

  return (
    <Card className="p-4 border-2 space-y-4">
      {/* Chá»n Ä‘á»™ khÃ³ */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Layers className="size-4 text-primary" />
          <div className="text-xs uppercase font-bold text-muted-foreground">
            Chá»n Ä‘á»™ khÃ³
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {levels.map((l) => (
            <button
              key={l.code}
              onClick={() => setLevelCode(l.code)}
              className={cn(
                "text-left p-3 rounded-xl border-2 transition-all",
                selectedLevel?.code === l.code
                  ? "border-primary bg-primary/5 -translate-y-0.5 shadow-sm"
                  : "border-border bg-card hover:border-primary/60",
              )}
            >
              <div className="font-bold text-sm">{l.label}</div>
              <div className="text-[11px] text-muted-foreground">{l.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Chá»n chá»§ Ä‘á» */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Puzzle className="size-4 text-primary" />
          <div className="text-xs uppercase font-bold text-muted-foreground">
            Chá»n chá»§ Ä‘á»
          </div>
        </div>
        {topicsLoading ? (
          <div className="text-xs text-muted-foreground">Äang táº£i chá»§ Ä‘á»â€¦</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => {
              const disabled = c.subjectCode === null;
              return (
                <button
                  key={c.key}
                  disabled={disabled}
                  title={disabled ? "Chá»n mÃ´n á»Ÿ bá»™ lá»c trÃªn trÆ°á»›c em nhÃ©" : undefined}
                  onClick={() => setTopicKey(c.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-all",
                    chip.key === c.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/60",
                    disabled && "opacity-50 cursor-not-allowed hover:border-border",
                  )}
                >
                  {c.key === "all" && <span className="mr-1">âœ¨</span>}
                  {c.label}
                </button>
              );
            })}
          </div>
        )}
        {needSubject && !topicsLoading && (
          <div className="mt-2 text-xs text-warning">
            Chá»n mÃ´n á»Ÿ bá»™ lá»c trÃªn, hoáº·c chá»n má»™t chá»§ Ä‘á» cá»¥ thá»ƒ Ä‘á»ƒ báº¯t Ä‘áº§u nhÃ©.
          </div>
        )}
      </div>

      {/* Sá»‘ lÆ°á»£ng cÃ¢u há»i */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Hash className="size-4 text-primary" />
          <div className="text-xs uppercase font-bold text-muted-foreground">
            Sá»‘ lÆ°á»£ng cÃ¢u há»i
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {COUNT_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setCount(p);
                setUseCustomCount(false);
              }}
              className={cn(
                "size-11 rounded-full border-2 text-sm font-bold transition-all",
                !useCustomCount && count === p
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/60",
              )}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setUseCustomCount(true)}
            className={cn(
              "px-3 h-11 rounded-full border-2 text-xs font-bold transition-all",
              useCustomCount
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/60",
            )}
          >
            KhÃ¡câ€¦
          </button>
          {useCustomCount && (
            <Input
              type="number"
              min={COUNT_MIN}
              max={COUNT_MAX}
              value={customRaw}
              onChange={(e) => setCustomRaw(e.target.value)}
              placeholder={`${COUNT_MIN}â€“${COUNT_MAX}`}
              className="w-24 h-11 rounded-xl"
              autoFocus
            />
          )}
        </div>
        {useCustomCount && parsed && !parsed.ok && customRaw !== "" && (
          <div className="mt-1 text-xs text-destructive">{parsed.error}</div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Em sáº½ luyá»‡n <b className="text-foreground">{effectiveCount ?? "â€¦"} cÃ¢u</b> Â·{" "}
          {selectedLevel?.label ?? "â€¦"} Â· chá»§ Ä‘á»{" "}
          <b className="text-foreground">{chip.label}</b>
        </div>
        <div className="flex items-center gap-3">
          {blockedReason !== null && (
            <span className="text-sm text-muted-foreground" role="status">
              {blockedReason}
            </span>
          )}
          <Button className="btn-pop rounded-full" disabled={!canStart} onClick={handleStart}>
            <SlidersHorizontal className="size-4 mr-1" />
            {pending ? "Äang táº¡o..." : "Báº¯t Ä‘áº§u luyá»‡n táº­p"}
            {!pending && <ArrowRight className="size-3.5 ml-1" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
