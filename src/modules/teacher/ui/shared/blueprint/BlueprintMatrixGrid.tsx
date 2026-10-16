import { useMemo } from "react";
import { cn } from "@/core/lib/utils";
import { Input } from "@/core/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/core/ui/select";
import {
  AlertTriangle,
  Database,
  Eraser,
  Plus,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import type {
  BlueprintCatalog,
  BlueprintCell,
  CognitiveLevelCode,
} from "@/modules/teacher/api/teacherBlueprintApi";
import { levelShares, totalCells } from "@/modules/teacher/lib/blueprintDraft";

/**
 * PAPER-R8/R9 â€” Báº¢NG KHAI MA TRáº¬N: hÃ ng lÃ  chá»§ Ä‘á» ná»™i dung, cá»™t lÃ  bá»‘n má»©c
 * nháº­n thá»©c, Ã´ lÃ  sá»‘ cÃ¢u.
 *
 * Má»—i Ã´ hiá»‡n Sá» CÃ‚U KHO ÄANG CÃ“ ngay táº¡i chá»—. ÄÃ¢y khÃ´ng pháº£i trang trÃ­: giÃ¡o
 * viÃªn pháº£i biáº¿t TRÆ¯á»šC KHI báº¥m sinh ráº±ng Ä‘á» cá»§a mÃ¬nh bao nhiÃªu pháº§n dá»±a kho,
 * bao nhiÃªu pháº§n nhá» mÃ¡y â€” Ã´ nÃ o kho khÃ´ng Ä‘á»§ thÃ¬ nÃ³i tháº³ng "kho cÃ³ 2/5, AI sáº½
 * sinh 3".
 */
export function BlueprintMatrixGrid({
  catalog,
  cells,
  onChange,
  selectedCodes,
  onSelectedChange,
  aiAvailable,
  onRefill,
}: {
  catalog: BlueprintCatalog;
  cells: BlueprintCell[];
  onChange: (cells: BlueprintCell[]) => void;
  /**
   * Chá»§ Ä‘á» ÄANG Náº°M TRONG ma tráº­n. Báº£ng chá»‰ bÃ y cÃ¡c chá»§ Ä‘á» nÃ y, khÃ´ng bÃ y cáº£
   * cÃ¢y ná»™i dung: má»™t mÃ´n cÃ³ hÆ¡n mÆ°á»i chá»§ Ä‘á», dá»±ng háº¿t ra thÃ¬ báº£ng dÃ i dáº±ng dáº·c
   * vÃ  toÃ n sá»‘ 0 â€” thao tÃ¡c "thÃªm/bá»›t chá»§ Ä‘á»" chÃ¬m máº¥t trong Ä‘Ã³.
   */
  selectedCodes: string[];
  onSelectedChange: (codes: string[]) => void;
  aiAvailable: boolean;
  /** Äiá»n láº¡i ma tráº­n máº«u â€” bá» qua náº¿u bá» máº·t khÃ´ng cáº§n. */
  onRefill?: () => void;
}) {
  const countOf = useMemo(() => {
    const map = new Map<string, number>();
    cells.forEach((c) => map.set(`${c.content_code}|${c.level_code}`, c.count));
    return map;
  }, [cells]);

  const setCell = (
    contentCode: string,
    levelCode: CognitiveLevelCode,
    value: number,
  ) => {
    const next = cells.filter(
      (c) => !(c.content_code === contentCode && c.level_code === levelCode),
    );
    // Ã” 0 cÃ¢u khÃ´ng Ä‘Æ°á»£c lÆ°u â€” nÃ³ khÃ´ng pháº£i má»™t Ã´, chá»‰ lÃ  má»™t Ã´ trá»‘ng.
    if (value > 0) {
      next.push({
        content_code: contentCode,
        level_code: levelCode,
        count: value,
      });
    }
    onChange(next);
  };

  /** Giá»¯ Ä‘Ãºng thá»© tá»± cá»§a khung ná»™i dung, khÃ´ng theo thá»© tá»± giÃ¡o viÃªn báº¥m thÃªm. */
  const shownTopics = useMemo(
    () => catalog.topics.filter((t) => selectedCodes.includes(t.content_code)),
    [catalog.topics, selectedCodes],
  );
  const addableTopics = useMemo(
    () => catalog.topics.filter((t) => !selectedCodes.includes(t.content_code)),
    [catalog.topics, selectedCodes],
  );

  const addTopic = (contentCode: string) => {
    onSelectedChange([...selectedCodes, contentCode]);
  };

  const removeTopic = (contentCode: string) => {
    onSelectedChange(selectedCodes.filter((c) => c !== contentCode));
    // Bá» chá»§ Ä‘á» thÃ¬ bá» luÃ´n sá»‘ cÃ¢u cá»§a nÃ³ â€” Ä‘á»ƒ láº¡i thÃ¬ tá»•ng váº«n cá»™ng nhá»¯ng Ã´
    // khÃ´ng cÃ²n hiá»‡n trÃªn báº£ng, Ä‘Ãºng cÃ¡i báº«y Ä‘Ã£ gáº·p khi Ä‘á»•i mÃ´n.
    onChange(cells.filter((c) => c.content_code !== contentCode));
  };

  const shares = levelShares(cells, catalog.levels);
  const total = totalCells(cells);

  /**
   * NhÃ£n chá»§ Ä‘á» trong khung ná»™i dung cÃ³ thá»ƒ TRÃ™NG NHAU â€” Ngá»¯ vÄƒn 6 cháº³ng háº¡n cÃ³
   * sÃ¡u nÃºt lÃ¡ cÃ¹ng tÃªn "Äá»c hiá»ƒu vÄƒn báº£n vÄƒn há»c". SÃ¡u hÃ ng giá»‘ng há»‡t thÃ¬ giÃ¡o
   * viÃªn khÃ´ng biáº¿t mÃ¬nh Ä‘ang gÃµ sá»‘ vÃ o hÃ ng nÃ o.
   *
   * NhÃ£n nÃ o láº·p thÃ¬ kÃ¨m mÃ£ chá»§ Ä‘á» Ä‘á»ƒ phÃ¢n biá»‡t; nhÃ£n duy nháº¥t giá»¯ nguyÃªn cho
   * báº£ng khá»i rá»‘i vÃ¬ mÃ£ mÃ¡y khÃ´ng ai cáº§n Ä‘á»c.
   */
  const duplicatedLabels = useMemo(() => {
    const seen = new Map<string, number>();
    catalog.topics.forEach((t) => seen.set(t.label, (seen.get(t.label) ?? 0) + 1));
    return new Set(
      [...seen.entries()].filter(([, n]) => n > 1).map(([label]) => label),
    );
  }, [catalog.topics]);

  if (catalog.topics.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
        MÃ´n vÃ  khá»‘i nÃ y chÆ°a cÃ³ khung ná»™i dung, kho cÅ©ng chÆ°a cÃ³ cÃ¢u nÃ o. Tháº§y cÃ´
        chá»n mÃ´n/khá»‘i khÃ¡c, hoáº·c táº¡o Ä‘á» thá»§ cÃ´ng tá»« ngÃ¢n hÃ ng cÃ¢u há»i cá»§a mÃ¬nh.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!catalog.has_bank && (
        <div className="flex items-start gap-2 rounded-xl border-2 border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="size-4 mt-0.5 text-warning shrink-0" />
          <span>
            Kho há»c liá»‡u chÆ°a cÃ³ cÃ¢u nÃ o cho mÃ´n vÃ  khá»‘i nÃ y â€”{" "}
            {aiAvailable
              ? "toÃ n bá»™ Ä‘á» sáº½ do trá»£ lÃ½ AI sinh."
              : "mÃ  trá»£ lÃ½ AI Ä‘ang táº¯t, nÃªn chÆ°a sinh Ä‘Æ°á»£c Ä‘á». Tháº§y cÃ´ táº¡o Ä‘á» thá»§ cÃ´ng tá»« ngÃ¢n hÃ ng cÃ¢u há»i cá»§a mÃ¬nh nhÃ©."}
          </span>
        </div>
      )}

      {onRefill && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            {total > 0
              ? "Ma tráº­n máº«u Ä‘Ã£ Ä‘iá»n sáºµn theo sá»‘ cÃ¢u kho Ä‘ang cÃ³ â€” tháº§y cÃ´ sá»­a sá»‘ á»Ÿ Ã´ báº¥t ká»³, hoáº·c báº¥m Sinh luÃ´n."
              : "Báº£ng Ä‘ang trá»‘ng â€” tháº§y cÃ´ gÃµ sá»‘ cÃ¢u vÃ o Ã´, hoáº·c Ä‘iá»n láº¡i ma tráº­n máº«u."}
          </span>
          <span className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onRefill}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-medium hover:bg-muted"
            >
              <Wand2 className="size-3" /> Äiá»n láº¡i máº«u
            </button>
            <button
              type="button"
              onClick={() => {
                onChange([]);
                onSelectedChange([]);
              }}
              disabled={total === 0 && selectedCodes.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-medium hover:bg-muted disabled:opacity-40"
            >
              <Eraser className="size-3" /> XoÃ¡ háº¿t
            </button>
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border-2">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/60">
              <th className="text-left p-2.5 font-bold sticky left-0 bg-muted/60 min-w-[180px]">
                Chá»§ Ä‘á»
              </th>
              {catalog.levels.map((level) => (
                <th key={level.code} className="p-2.5 font-bold min-w-[120px]">
                  {level.label}
                </th>
              ))}
              <th className="p-2.5 font-bold w-16">Tá»•ng</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {shownTopics.map((topic) => {
              const rowTotal = catalog.levels.reduce(
                (sum, l) =>
                  sum + (countOf.get(`${topic.content_code}|${l.code}`) ?? 0),
                0,
              );
              return (
                <tr
                  key={topic.content_code}
                  className="border-t hover:bg-muted/20"
                >
                  <td className="p-2.5 sticky left-0 bg-background font-medium">
                    {topic.label}
                    {duplicatedLabels.has(topic.label) && (
                      <span className="ml-1.5 font-normal text-[10px] text-muted-foreground">
                        {topic.content_code}
                      </span>
                    )}
                    {topic.total === 0 && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">
                        (kho trá»‘ng)
                      </span>
                    )}
                  </td>
                  {catalog.levels.map((level) => {
                    const key = `${topic.content_code}|${level.code}`;
                    const want = countOf.get(key) ?? 0;
                    const have = topic.counts[level.code] ?? 0;
                    const gap = Math.max(0, want - have);
                    return (
                      <td
                        key={level.code}
                        className={cn(
                          "p-1.5 align-top",
                          gap > 0 && "bg-fun/5",
                        )}
                      >
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          value={want || ""}
                          placeholder="0"
                          aria-label={`Sá»‘ cÃ¢u ${topic.label} má»©c ${level.label}`}
                          onChange={(e) =>
                            setCell(
                              topic.content_code,
                              level.code,
                              // Káº¹p ngay trong state: thuá»™c tÃ­nh min/max cá»§a tháº»
                              // nháº­p chá»‰ lÃ  gá»£i Ã½, gÃµ tay vÃ  dÃ¡n váº«n lá»t.
                              Math.max(
                                0,
                                Math.min(50, Number(e.target.value) || 0),
                              ),
                            )
                          }
                          className="h-8 text-center"
                        />
                        <div className="mt-1 text-[10px] leading-tight text-center">
                          {gap > 0 ? (
                            <span className="text-fun font-medium inline-flex items-center gap-0.5">
                              <Sparkles className="size-2.5" />
                              kho cÃ³ {have}/{want}
                              {aiAvailable
                                ? `, AI sinh ${gap}`
                                : `, thiáº¿u ${gap}`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground inline-flex items-center gap-0.5">
                              <Database className="size-2.5" />
                              kho cÃ³ {have}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2.5 text-center font-bold">
                    {rowTotal || "â€”"}
                  </td>
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeTopic(topic.content_code)}
                      title={`Bá» chá»§ Ä‘á» ${topic.label}`}
                      aria-label={`Bá» chá»§ Ä‘á» ${topic.label}`}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {shownTopics.length === 0 && (
              <tr>
                <td
                  colSpan={catalog.levels.length + 3}
                  className="p-6 text-center text-sm text-muted-foreground"
                >
                  Ma tráº­n chÆ°a cÃ³ chá»§ Ä‘á» nÃ o. Báº¥m <strong>ThÃªm chá»§ Ä‘á»</strong>{" "}
                  bÃªn dÆ°á»›i, hoáº·c <strong>Äiá»n láº¡i máº«u</strong>.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/40 font-medium">
              <td className="p-2.5 sticky left-0 bg-muted/40">Tá»· lá»‡ theo má»©c</td>
              {shares.map((s) => (
                <td key={s.code} className="p-2.5 text-center">
                  {s.count > 0 ? (
                    <>
                      {s.count} cÃ¢u{" "}
                      <span className="text-muted-foreground">
                        ({s.percent}%)
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">â€”</span>
                  )}
                </td>
              ))}
              <td className="p-2.5 text-center font-bold">{total}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ThÃªm chá»§ Ä‘á» â€” thao tÃ¡c RÃ• RÃ€NG, khÃ´ng báº¯t giÃ¡o viÃªn Ä‘oÃ¡n ráº±ng "gÃµ sá»‘
          vÃ o má»™t hÃ ng cÃ³ sáºµn" chÃ­nh lÃ  thÃªm chá»§ Ä‘á». Danh sÃ¡ch chá»‰ cÃ²n nhá»¯ng chá»§
          Ä‘á» chÆ°a náº±m trong ma tráº­n, kÃ¨m sá»‘ cÃ¢u kho cÃ³ Ä‘á»ƒ chá»n cho biáº¿t Ä‘Æ°á»ng. */}
      {addableTopics.length > 0 ? (
        <Select value="" onValueChange={addTopic}>
          <SelectTrigger className="w-full sm:w-80" aria-label="ThÃªm chá»§ Ä‘á» vÃ o ma tráº­n">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Plus className="size-4" /> ThÃªm chá»§ Ä‘á»
            </span>
          </SelectTrigger>
          <SelectContent>
            {addableTopics.map((topic) => (
              <SelectItem key={topic.content_code} value={topic.content_code}>
                <span className="flex items-baseline gap-2">
                  <span>{topic.label}</span>
                  {duplicatedLabels.has(topic.label) && (
                    <span className="text-[10px] text-muted-foreground">
                      {topic.content_code}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {topic.total > 0 ? `kho cÃ³ ${topic.total}` : "kho trá»‘ng"}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-xs text-muted-foreground">
          Ma tráº­n Ä‘Ã£ dÃ¹ng háº¿t chá»§ Ä‘á» cá»§a mÃ´n vÃ  khá»‘i nÃ y.
        </p>
      )}
    </div>
  );
}
