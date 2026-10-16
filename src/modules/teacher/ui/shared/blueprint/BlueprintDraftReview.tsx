import { useMemo, useState } from "react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/lib/utils";
import { plainTextFromAuthoredMath } from "@/core/math/plainTextFromAuthoredMath";
import {
  AlertTriangle,
  Eye,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAccessToken } from "@/core/auth/AuthContext";
import {
  teacherBlueprintApi,
  type BlueprintCatalog,
  type PaperBlueprintInput,
} from "@/modules/teacher/api/teacherBlueprintApi";
import {
  distributePoints,
  estimateMinutes,
  generateCell,
  round2,
  type DraftCellResult,
  type DraftItem,
} from "@/modules/teacher/lib/blueprintDraft";

const SOURCE_LABEL: Record<string, string> = {
  library: "Kho há»c liá»‡u",
  ai: "AI sinh",
  personal: "CÃ¡ nhÃ¢n",
};

const SOURCE_CLASS: Record<string, string> = {
  library: "bg-info/15 text-info",
  ai: "bg-fun/15 text-fun",
  personal: "bg-warning/20 text-warning",
};

/**
 * MÃ n DUYá»†T Báº¢N NHÃP (PAPER-R11) â€” khÃ´ng cÃ¢u nÃ o cá»§a trá»£ lÃ½ AI vÃ o Ä‘á» mÃ  giÃ¡o
 * viÃªn chÆ°a nhÃ¬n qua.
 *
 * CÃ¢u bÃ y theo tá»«ng Ã´ cá»§a ma tráº­n, má»—i cÃ¢u cÃ³ nguá»“n, Ä‘iá»ƒm sá»­a Ä‘Æ°á»£c, vÃ  bá»‘n
 * thao tÃ¡c: Ä‘á»•i cÃ¢u khÃ¡c tá»« kho Â· sinh láº¡i báº±ng AI Â· sá»­a tay Â· bá».
 */
export function BlueprintDraftReview({
  input,
  catalog,
  results,
  onResultsChange,
  onPreview,
  onSave,
  saving,
}: {
  input: PaperBlueprintInput;
  catalog: BlueprintCatalog;
  results: DraftCellResult[];
  onResultsChange: (results: DraftCellResult[]) => void;
  onPreview: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const token = useAccessToken();
  const [busyCell, setBusyCell] = useState<string | null>(null);

  const topicLabel = (code: string) =>
    catalog.topics.find((t) => t.content_code === code)?.label ?? code;
  const levelLabel = (code: string) =>
    catalog.levels.find((l) => l.code === code)?.label ?? code;

  const items = useMemo(() => results.flatMap((r) => r.items), [results]);
  const totalPoints = round2(items.reduce((s, q) => s + q.points, 0));
  const declaredPoints = input.total_points ?? 10;
  const isExam = input.kind === "exam";
  const estimated = estimateMinutes(
    items.map((q) => q.question_type),
    catalog.minutes_per_type,
  );
  const overTime =
    input.duration_minutes != null && estimated > input.duration_minutes;
  const pointsOff = isExam && Math.abs(totalPoints - declaredPoints) > 0.01;
  const missingTotal = results.reduce((s, r) => s + r.missing, 0);

  const setItems = (cellIndex: number, next: DraftItem[]) => {
    const copy = [...results];
    copy[cellIndex] = { ...copy[cellIndex], items: next };
    onResultsChange(copy);
  };

  /** Chia láº¡i Ä‘á»u tá»•ng Ä‘iá»ƒm cho cÃ¡c cÃ¢u Ä‘ang cÃ³ â€” nÃºt "chia láº¡i thang Ä‘iá»ƒm". */
  const redistribute = () => {
    const points = distributePoints(items.length, declaredPoints);
    let cursor = 0;
    const copy = results.map((r) => ({
      ...r,
      items: r.items.map((q) => ({ ...q, points: points[cursor++] ?? q.points })),
    }));
    onResultsChange(copy);
  };

  /** Bá»‘c cÃ¢u khÃ¡c tá»« kho thay cho má»™t cÃ¢u â€” giá»¯ nguyÃªn Ã´. */
  const swapFromBank = async (cellIndex: number, itemId: string) => {
    if (!token) return;
    const result = results[cellIndex];
    const key = `${cellIndex}-swap-${itemId}`;
    setBusyCell(key);
    try {
      const used = results.flatMap((r) => r.items.map((q) => q.id));
      const picked = await teacherBlueprintApi.pickCell(
        {
          subject_code: input.subject_code,
          level: input.level,
          content_code: result.cell.content_code,
          level_code: result.cell.level_code,
          count: 1,
          printable_only: input.printable_only,
          exclude_ids: used,
        },
        token,
      );
      const fresh = picked.questions[0];
      if (!fresh) {
        toast.error("Kho khÃ´ng cÃ²n cÃ¢u nÃ o khÃ¡c cho Ã´ nÃ y.");
        return;
      }
      const old = result.items.find((q) => q.id === itemId);
      setItems(
        cellIndex,
        result.items.map((q) =>
          q.id === itemId ? { ...fresh, points: old?.points ?? 1 } : q,
        ),
      );
      toast.success("ÄÃ£ Ä‘á»•i cÃ¢u khÃ¡c tá»« kho.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "KhÃ´ng Ä‘á»•i Ä‘Æ°á»£c cÃ¢u.");
    } finally {
      setBusyCell(null);
    }
  };

  /** Nhá» trá»£ lÃ½ AI sinh má»™t cÃ¢u khÃ¡c thay cho cÃ¢u Ä‘ang chá»n. */
  const regenerate = async (cellIndex: number, itemId: string) => {
    if (!token) return;
    const result = results[cellIndex];
    const key = `${cellIndex}-gen-${itemId}`;
    setBusyCell(key);
    try {
      const generated = await teacherBlueprintApi.generateCell(
        {
          subject: input.subject,
          subject_code: input.subject_code,
          level: input.level,
          content_code: result.cell.content_code,
          level_code: result.cell.level_code,
          count: 1,
          printable_only: input.printable_only,
        },
        token,
      );
      if (generated.ai_disabled) {
        toast.error("Trá»£ lÃ½ AI Ä‘ang táº¯t nÃªn chÆ°a sinh cÃ¢u má»›i Ä‘Æ°á»£c.");
        return;
      }
      const fresh = generated.saved[0];
      if (!fresh) {
        const reason = generated.rejected[0]?.reason;
        toast.error(reason ?? "Trá»£ lÃ½ AI chÆ°a sinh Ä‘Æ°á»£c cÃ¢u Ä‘áº¡t yÃªu cáº§u.");
        return;
      }
      const old = result.items.find((q) => q.id === itemId);
      setItems(
        cellIndex,
        result.items.map((q) =>
          q.id === itemId ? { ...fresh, points: old?.points ?? 1 } : q,
        ),
      );
      toast.success("ÄÃ£ sinh cÃ¢u má»›i.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "KhÃ´ng sinh Ä‘Æ°á»£c cÃ¢u.");
    } finally {
      setBusyCell(null);
    }
  };

  /**
   * Bá» cÃ¢u khá»i Ä‘á». Vá»›i cÃ¢u AI há»i thÃªm: giá»¯ trong ngÃ¢n hÃ ng (cÃ¢u váº«n tá»‘t, chá»‰
   * khÃ´ng há»£p Ä‘á» nÃ y) hay xoÃ¡ luÃ´n (cÃ¢u sinh há»ng). Thiáº¿u lá»±a chá»n nÃ y thÃ¬
   * ngÃ¢n hÃ ng "AI sinh" phÃ¬nh Ä‘áº§y cÃ¢u bá»‹ chÃª mÃ  khÃ´ng cÃ³ Ä‘Æ°á»ng dá»n ngay chá»—
   * vá»«a nhÃ¬n tháº¥y nÃ³.
   */
  const removeItem = (cellIndex: number, item: DraftItem) => {
    const result = results[cellIndex];
    setItems(
      cellIndex,
      result.items.filter((q) => q.id !== item.id),
    );
    if (item.source === "ai") {
      toast("ÄÃ£ bá» cÃ¢u khá»i Ä‘á».", {
        description: "CÃ¢u váº«n náº±m trong ngÃ¢n hÃ ng â€œAI sinhâ€ cá»§a tháº§y cÃ´.",
        action: {
          label: "XoÃ¡ khá»i ngÃ¢n hÃ ng",
          onClick: () => void deleteFromBank(item.id),
        },
      });
    }
  };

  const deleteFromBank = async (questionId: string) => {
    if (!token) return;
    try {
      const { teacherBankApi } = await import(
        "@/modules/teacher/api/teacherBankApi"
      );
      await teacherBankApi.remove(questionId, token);
      toast.success("ÄÃ£ xoÃ¡ cÃ¢u khá»i ngÃ¢n hÃ ng.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "KhÃ´ng xoÃ¡ Ä‘Æ°á»£c cÃ¢u.");
    }
  };

  const retryCell = async (cellIndex: number) => {
    if (!token) return;
    const key = `${cellIndex}-retry`;
    setBusyCell(key);
    try {
      const used = new Set(
        results.flatMap((r, i) =>
          i === cellIndex ? [] : r.items.map((q) => q.id),
        ),
      );
      const fresh = await generateCell(
        results[cellIndex].cell,
        input,
        token,
        used,
        topicLabel,
      );
      const copy = [...results];
      copy[cellIndex] = fresh;
      onResultsChange(copy);
    } finally {
      setBusyCell(null);
    }
  };

  return (
    <div className="space-y-4">
      {(pointsOff || overTime || missingTotal > 0) && (
        <div className="space-y-2">
          {missingTotal > 0 && (
            <Warning>
              Äá» cÃ²n thiáº¿u <strong>{missingTotal} cÃ¢u</strong> so vá»›i ma tráº­n â€”
              kho khÃ´ng Ä‘á»§ vÃ  trá»£ lÃ½ AI chÆ°a bÃ¹ Ä‘Æ°á»£c. Tháº§y cÃ´ chÃ¨n tay, báº¥m sinh
              láº¡i á»Ÿ Ã´ thiáº¿u, hoáº·c háº¡ sá»‘ cÃ¢u trong ma tráº­n.
            </Warning>
          )}
          {pointsOff && (
            <Warning>
              Tá»•ng Ä‘iá»ƒm Ä‘ang lÃ  <strong>{totalPoints}</strong> trong khi ma tráº­n
              khai <strong>{declaredPoints}</strong>.{" "}
              <button
                type="button"
                onClick={redistribute}
                className="underline font-medium"
              >
                Chia láº¡i Ä‘á»u
              </button>
            </Warning>
          )}
          {overTime && (
            <Warning>
              {items.length} cÃ¢u nÃ y Æ°á»›c khoáº£ng <strong>{estimated} phÃºt</strong>
              , trong khi Ä‘á» khai <strong>{input.duration_minutes} phÃºt</strong>.
            </Warning>
          )}
        </div>
      )}

      {results.map((result, cellIndex) => {
        const label = `${topicLabel(result.cell.content_code)} Â· ${levelLabel(result.cell.level_code)}`;
        return (
          <Card key={`${result.cell.content_code}-${result.cell.level_code}`} className="p-4 border-2">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <div className="font-bold">{label}</div>
                <div className="text-xs text-muted-foreground">
                  {result.items.length}/{result.cell.count} cÃ¢u
                  {result.missing > 0 && ` Â· cÃ²n thiáº¿u ${result.missing}`}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busyCell !== null}
                onClick={() => void retryCell(cellIndex)}
              >
                {busyCell === `${cellIndex}-retry` ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                <span className="ml-1">Sinh láº¡i Ã´</span>
              </Button>
            </div>

            {result.error && <Warning>{result.error}</Warning>}
            {result.aiDisabled && result.missing > 0 && (
              <Warning>
                Trá»£ lÃ½ AI Ä‘ang táº¯t nÃªn chÆ°a bÃ¹ Ä‘Æ°á»£c {result.missing} cÃ¢u cÃ²n
                thiáº¿u á»Ÿ Ã´ nÃ y.
              </Warning>
            )}
            {result.rejected.length > 0 && (
              <details className="text-xs text-muted-foreground mb-2">
                <summary className="cursor-pointer">
                  {result.rejected.length} cÃ¢u trá»£ lÃ½ AI tráº£ vá» bá»‹ loáº¡i
                </summary>
                <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                  {result.rejected.map((r, i) => (
                    <li key={i}>{r.reason}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="space-y-2">
              {result.items.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border p-2.5"
                >
                  <span className="text-xs font-bold text-muted-foreground mt-1 w-5 shrink-0">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      {plainTextFromAuthoredMath(item.question_text)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          SOURCE_CLASS[item.source] ?? "bg-muted",
                        )}
                      >
                        {SOURCE_LABEL[item.source] ?? item.source}
                      </span>
                      {isExam && (
                        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          Äiá»ƒm
                          <Input
                            type="number"
                            min={0}
                            step={0.25}
                            value={item.points}
                            aria-label={`Äiá»ƒm cÃ¢u ${i + 1}`}
                            onChange={(e) =>
                              setItems(
                                cellIndex,
                                result.items.map((q) =>
                                  q.id === item.id
                                    ? {
                                        ...q,
                                        points: Math.max(
                                          0,
                                          Number(e.target.value) || 0,
                                        ),
                                      }
                                    : q,
                                ),
                              )
                            }
                            className="h-6 w-16 text-center text-xs"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton
                      title="Äá»•i cÃ¢u khÃ¡c tá»« kho"
                      busy={busyCell === `${cellIndex}-swap-${item.id}`}
                      disabled={busyCell !== null}
                      onClick={() => void swapFromBank(cellIndex, item.id)}
                    >
                      <RefreshCw className="size-3.5" />
                    </IconButton>
                    <IconButton
                      title="Nhá» trá»£ lÃ½ AI sinh cÃ¢u khÃ¡c"
                      busy={busyCell === `${cellIndex}-gen-${item.id}`}
                      disabled={busyCell !== null}
                      onClick={() => void regenerate(cellIndex, item.id)}
                    >
                      <Sparkles className="size-3.5" />
                    </IconButton>
                    <IconButton
                      title="Bá» cÃ¢u khá»i Ä‘á»"
                      onClick={() => removeItem(cellIndex, item)}
                      destructive
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </div>
                </div>
              ))}
              {result.items.length === 0 && (
                <div className="text-sm text-muted-foreground p-2">
                  Ã” nÃ y chÆ°a cÃ³ cÃ¢u nÃ o.
                </div>
              )}
            </div>
          </Card>
        );
      })}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 bg-background/95 p-3 backdrop-blur">
        <div className="text-sm">
          <strong>{items.length} cÃ¢u</strong>
          {isExam && (
            <>
              {" Â· "}
              <span className={cn(pointsOff && "text-destructive font-bold")}>
                {totalPoints} Ä‘iá»ƒm
              </span>
            </>
          )}
          {" Â· Æ°á»›c "}
          <span className={cn(overTime && "text-destructive font-bold")}>
            {estimated} phÃºt
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onPreview} disabled={items.length === 0}>
            <Eye className="size-4 mr-1" /> Xem thá»­
          </Button>
          <Button
            onClick={onSave}
            disabled={items.length === 0 || saving}
            className="bg-success hover:bg-success/90"
          >
            {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
            LÆ°u thÃ nh Ä‘á»
          </Button>
        </div>
      </div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border-2 border-warning/40 bg-warning/10 p-2.5 text-sm mb-2">
      <AlertTriangle className="size-4 mt-0.5 text-warning shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function IconButton({
  title,
  children,
  onClick,
  busy,
  disabled,
  destructive,
}: {
  title: string;
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      title={title}
      aria-label={title}
      disabled={disabled || busy}
      onClick={onClick}
      className={cn("h-7 w-7 p-0", destructive && "text-destructive")}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : children}
    </Button>
  );
}
