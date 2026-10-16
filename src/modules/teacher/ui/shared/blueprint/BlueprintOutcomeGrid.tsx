import { cn } from "@/core/lib/utils";
import type {
  BlueprintOutcome,
  OutcomeCell,
} from "@/modules/teacher/api/teacherBlueprintApi";

/**
 * Äá»ŒC Káº¾T QUáº¢ Lá»šP THEO Ã” MA TRáº¬N â€” lÃ¡t 3.
 *
 * CÃ¹ng báº£ng chá»§ Ä‘á» Ã— má»©c nháº­n thá»©c mÃ  giÃ¡o viÃªn Ä‘Ã£ khai lÃºc ra Ä‘á», nhÆ°ng giá»
 * má»—i Ã´ lÃ  Tá»¶ Lá»† ÄÃšNG cá»§a lá»›p. ÄÃ³ lÃ  bÆ°á»›c biáº¿n ma tráº­n tá»« cÃ´ng cá»¥ ra Ä‘á» thÃ nh
 * cÃ´ng cá»¥ Ä‘á»c lá»›p: thay vÃ¬ "Ä‘iá»ƒm trung bÃ¬nh 6,4" â€” thá»© khÃ´ng chá»‰ Ä‘Æ°á»£c chá»— nÃ o
 * Ä‘á»ƒ dáº¡y láº¡i â€” giÃ¡o viÃªn tháº¥y tháº³ng "Váº­n dá»¥ng Ã— PhÃ¢n sá»‘ Ä‘Ãºng 34%".
 */
export function BlueprintOutcomeGrid({
  outcome,
  onDrillDown,
}: {
  outcome: BlueprintOutcome;
  /** Báº¥m vÃ o má»™t Ã´ yáº¿u Ä‘á»ƒ giao bÃ i cá»§ng cá»‘ Ä‘Ãºng chá»— Ä‘Ã³. */
  onDrillDown?: (contentCode: string, levelCode: string) => void;
}) {
  if (!outcome.has_matrix) {
    return (
      <div className="rounded-xl border-2 border-dashed p-5 text-center text-sm text-muted-foreground">
        BÃ i nÃ y khÃ´ng sinh tá»« ma tráº­n nÃªn khÃ´ng Ä‘á»c theo Ã´ Ä‘Æ°á»£c. Äá» sinh tá»« mÃ n
        â€œMa tráº­n Ä‘á»â€ sáº½ cÃ³ báº£ng nÃ y.
      </div>
    );
  }

  if (outcome.graded_students === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed p-5 text-center text-sm text-muted-foreground">
        ChÆ°a cÃ³ bÃ i ná»™p nÃ o Ä‘Æ°á»£c cháº¥m. Báº£ng sáº½ hiá»‡n khi lá»›p lÃ m xong.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">
        TÃ­nh trÃªn <strong>{outcome.graded_students}</strong> bÃ i ná»™p Ä‘Ã£ cháº¥m.
        CÃ¢u Ä‘ang chá» cháº¥m khÃ´ng tÃ­nh vÃ o Ä‘Ã¢y.
      </div>

      <div className="overflow-x-auto rounded-xl border-2">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/60">
              <th className="text-left p-2.5 font-bold sticky left-0 bg-muted/60 min-w-[160px]">
                Chá»§ Ä‘á»
              </th>
              {outcome.levels.map((level) => (
                <th key={level.code} className="p-2.5 font-bold min-w-[110px]">
                  {level.label}
                </th>
              ))}
              <th className="p-2.5 font-bold min-w-[90px]">Cáº£ chá»§ Ä‘á»</th>
            </tr>
          </thead>
          <tbody>
            {outcome.topics.map((topic) => (
              <tr key={topic.content_code} className="border-t">
                <td className="p-2.5 sticky left-0 bg-background font-medium">
                  {topic.label}
                </td>
                {outcome.levels.map((level) => (
                  <td key={level.code} className="p-1.5">
                    <CellBadge
                      cell={topic.cells[level.code]}
                      onClick={
                        onDrillDown
                          ? () => onDrillDown(topic.content_code, level.code)
                          : undefined
                      }
                    />
                  </td>
                ))}
                <td className="p-1.5">
                  <CellBadge cell={topic.total} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/40">
              <td className="p-2.5 sticky left-0 bg-muted/40 font-medium">
                Cáº£ lá»›p theo má»©c
              </td>
              {outcome.levels.map((level) => (
                <td key={level.code} className="p-1.5">
                  <CellBadge cell={outcome.level_totals[level.code]} />
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <Legend className="bg-destructive/15 text-destructive" label="DÆ°á»›i 50% â€” cáº§n dáº¡y láº¡i" />
        <Legend className="bg-warning/20 text-warning" label="50â€“79% â€” chÆ°a vá»¯ng" />
        <Legend className="bg-success/15 text-success" label="Tá»« 80% â€” Ä‘áº¡t" />
      </div>
    </div>
  );
}

function CellBadge({
  cell,
  onClick,
}: {
  cell?: OutcomeCell;
  onClick?: () => void;
}) {
  // Ã” chÆ°a em nÃ o lÃ m vÃ  Ã´ cáº£ lá»›p lÃ m sai lÃ  HAI CHUYá»†N KHÃC NHAU â€” gá»™p chÃºng
  // thÃ nh "0%" lÃ  cÃ¡ch nhanh nháº¥t Ä‘á»ƒ giÃ¡o viÃªn Ä‘i dáº¡y láº¡i má»™t chá»§ Ä‘á» chÆ°a ai
  // Ä‘Æ°á»£c há»i.
  if (!cell || cell.answered === 0 || cell.percent === null) {
    return (
      <div className="text-center text-xs text-muted-foreground py-1.5">â€”</div>
    );
  }

  const tone =
    cell.percent < 50
      ? "bg-destructive/15 text-destructive"
      : cell.percent < 80
        ? "bg-warning/20 text-warning"
        : "bg-success/15 text-success";

  const content = (
    <>
      <div className="font-bold">{Math.round(cell.percent)}%</div>
      <div className="text-[10px] opacity-80">
        {cell.correct}/{cell.answered} lÆ°á»£t
      </div>
    </>
  );

  if (!onClick) {
    return <div className={cn("rounded-lg py-1.5 text-center", tone)}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Giao bÃ i cá»§ng cá»‘ Ä‘Ãºng chá»— nÃ y"
      className={cn(
        "w-full rounded-lg py-1.5 text-center transition-all hover:ring-2 hover:ring-primary",
        tone,
      )}
    >
      {content}
    </button>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block size-3 rounded", className)} />
      {label}
    </span>
  );
}
