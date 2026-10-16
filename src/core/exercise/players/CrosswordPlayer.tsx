/**
 * Crossword / "crossword".
 * schema: crossword
 *
 * Render a crossword grid: blocked (black) cells where no entry passes, white
 * letter inputs where one or more entries cross. A clue list is shown split into
 * Across / Down. "Kiểm tra" grades every white cell against the entries'
 * answers (case-insensitive).
 *
 * Emitted answer: Record<cellKey, string> where cellKey = `${r}-${c}`.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, RichContentBlocks, useGrading, useHydratedRecordAnswer, useInstantGrading, type ContentBlock, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";
import { lastGrapheme, normalizeText } from "@/core/utils/single-character";

export interface CrosswordEntry {
  id: string;
  row: number;
  col: number;
  dir: "across" | "down";
  /** Canonical geometry; answer is kept separate in the question answer key. */
  length?: number;
  answer: string;
  /**
   * The clue body (spec §5.36.1): rich content, so one field covers a text clue,
   * a picture clue (VBT Âm nhạc 2 prints only bird photos), or both together.
   */
  content?: { blocks: ContentBlock[] };
  /**
   * Transitional: payloads written before the migration still carry a plain
   * string. Spec §5.36.1 puts the string→block conversion at the import
   * boundary, so this fallback goes away once that lands and the migration runs.
   */
  clue?: string;
  /** Clue number printed in the book; overrides the position-based numbering. */
  number?: number;
  /**
   * Indexes into this entry's own run whose letter the book prints pre-filled
   * (spec §5.36.3): shown static, never typed, never graded. The letter itself is
   * derived from the answer key, so it cannot contradict it.
   */
  given?: number[];
  /**
   * This entry is the keyword run the book tints (spec §5.36.6) — payload says
   * `display.role: "keyword"`. Which cells and which letters both follow from the
   * entry's own geometry and answer, so nothing else is declared.
   */
  keyword?: boolean;
}

export interface CrosswordPlayerProps extends PlayerProps {
  size: { rows: number; cols: number };
  entries: CrosswordEntry[];
}

const cellKey = (r: number, c: number) => `${r}-${c}`;

const answerLetters = (answer: string) => answer.replace(/\s+/g, "");

/** Number of cells covered by an entry, independent of whether its answer is available. */
function entryLength(e: CrosswordEntry): number {
  if (typeof e.length === "number" && Number.isInteger(e.length) && e.length > 0) return e.length;
  return answerLetters(e.answer).length;
}

/** Cells covered by an entry. */
function entryCells(e: CrosswordEntry): { r: number; c: number; ch: string }[] {
  const out: { r: number; c: number; ch: string }[] = [];
  const letters = answerLetters(e.answer);
  for (let i = 0; i < entryLength(e); i++) {
    const r = e.dir === "down" ? e.row + i : e.row;
    const c = e.dir === "across" ? e.col + i : e.col;
    out.push({ r, c, ch: letters[i] ?? "" });
  }
  return out;
}

export const CrosswordPlayer: React.FC<CrosswordPlayerProps> = ({
  size,
  entries,
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  ...shell
}) => {
  const skin = useSkin();
  const [values, setValues] = useHydratedRecordAnswer(answer);
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);
  const { status, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  // Solution map: cellKey -> expected uppercase letter. Geometry is tracked
  // separately so white cells still render when the answer key is withheld.
  const solution = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of entries) {
      for (const cell of entryCells(e)) {
        if (cell.ch) m[cellKey(cell.r, cell.c)] = normalizeText(cell.ch);
      }
    }
    return m;
  }, [entries]);

  const occupiedCells = useMemo(() => {
    const cells = new Set<string>();
    for (const e of entries) {
      for (const cell of entryCells(e)) cells.add(cellKey(cell.r, cell.c));
    }
    return cells;
  }, [entries]);
  // Letters printed in the book: rendered static and kept out of grading. Each
  // entry declares them as indexes into its own run (spec §5.36.3); the letter
  // comes from that entry's answer, so a given cell can never disagree with the
  // key. An index with no letter behind it (answer key withheld) stays typeable.
  const givens = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of entries) {
      const cells = entryCells(e);
      for (const i of e.given ?? []) {
        const cell = cells[i];
        if (!cell?.ch) continue;
        m[cellKey(cell.r, cell.c)] = normalizeText(cell.ch);
      }
    }
    return m;
  }, [entries]);

  // Cells of the keyword run, tinted like the book's highlighted column. Theme
  // token, not the book's print hex, so it reads in light and dark alike.
  const keywordCells = useMemo(() => {
    const cells = new Set<string>();
    for (const e of entries) {
      if (!e.keyword) continue;
      for (const cell of entryCells(e)) cells.add(cellKey(cell.r, cell.c));
    }
    return cells;
  }, [entries]);

  // Cells the student must fill = solution minus the given letters.
  const gradedKeys = useMemo(
    () => Object.keys(solution).filter((k) => givens[k] === undefined),
    [solution, givens],
  );

  const hasKey = entries.some((e) => e.answer && e.answer.trim().length > 0);
  const recordOnly = selfAssessment === true || !hasKey;
  const instant = useInstantGrading({
    elementIds: gradedKeys,
    instantFeedback,
    recordOnly,
    buildAnswer: () => ({ ...values }),
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");

  // Clue numbering: an entry's own `number` (the one printed in the book) wins;
  // the rest are numbered by start-cell position, skipping numbers already taken.
  // Entries are numbered individually (an across and a down entry may share a
  // start cell); the grid badge then shows the smallest number of that cell.
  const { entryNumbers, cellNumbers } = useMemo(() => {
    const byEntry: Record<string, number> = {};
    const taken = new Set<number>();
    for (const e of entries) {
      if (typeof e.number === "number" && Number.isInteger(e.number) && e.number > 0) {
        byEntry[e.id] = e.number;
        taken.add(e.number);
      }
    }
    // Entries without a printed number fall back to one number per start cell,
    // so an across/down pair crossing at their start still shares a number.
    const ordered = [...entries].sort((a, b) => a.row - b.row || a.col - b.col);
    const autoByCell: Record<string, number> = {};
    let next = 1;
    for (const e of ordered) {
      if (byEntry[e.id] !== undefined) continue;
      const k = cellKey(e.row, e.col);
      if (autoByCell[k] === undefined) {
        while (taken.has(next)) next++;
        autoByCell[k] = next;
        taken.add(next);
      }
      byEntry[e.id] = autoByCell[k];
    }
    const byCell: Record<string, number> = {};
    for (const e of entries) {
      const k = cellKey(e.row, e.col);
      const n = byEntry[e.id];
      if (byCell[k] === undefined || n < byCell[k]) byCell[k] = n;
    }
    return { entryNumbers: byEntry, cellNumbers: byCell };
  }, [entries]);

  // A Vietnamese letter is typed in several keystrokes (Telex `a`+`s` → `á`), so
  // mid-composition the cell must hold whatever the input method put there — if
  // we clamp it to one character on every keystroke, the input method loses the
  // buffer it is folding and the cell keeps the tone key (`S`) instead of `Á`.
  // While a cell composes we mirror its raw text and commit nothing; the value
  // is reduced to one character only once `compositionend` fires.
  const [composing, setComposing] = useState<{ key: string; text: string } | null>(null);
  // The ref, not the state, decides whether an `input` event belongs to a
  // composition: `compositionstart` and the keystroke's `input` are separate
  // native events, and the state update from the first may not have flushed by
  // the time the second is handled.
  const composingKeyRef = useRef<string | null>(null);

  const setCell = (k: string, v: string) => {
    if (locked) return;
    // Last grapheme, not last code unit: `Ắ` stored decomposed is `Ă` + U+0301,
    // and slicing code units would keep the bare accent.
    const ch = normalizeText(lastGrapheme(v));
    const next = { ...valuesRef.current, [k]: ch };
    valuesRef.current = next;
    setValues(next);
    onAnswerChange?.(next);
  };

  const beginComposition = (k: string, text: string) => {
    composingKeyRef.current = k;
    setComposing({ key: k, text });
  };
  /** Commit the composed letter and hand the cell back to the normal path. */
  const endComposition = (k: string, text: string) => {
    composingKeyRef.current = null;
    setComposing(null);
    setCell(k, text);
  };
  const changeCell = (k: string, text: string) => {
    // Chrome fires `input` after `compositionend`, Firefox before it; the ref
    // tells an in-flight composition from a finished one.
    if (composingKeyRef.current === k) setComposing({ key: k, text });
    else setCell(k, text);
  };

  const gradeCell = (k: string) => {
    // `valuesRef`, not `values`: a blur that also commits an in-flight
    // composition must grade the letter just committed, not the render's stale one.
    const v = normalizeText(valuesRef.current[k] ?? "");
    if (v === "") {
      instant.clear(k);
      return;
    }
    instant.grade(k, v === solution[k] ? "correct" : "incorrect");
  };

  const check = () => {
    if (locked) return;
    if (recordOnly) {
      report(values, "incomplete");
      return;
    }
    const allCorrect = gradedKeys.every((k) => normalizeText(values[k] ?? "") === solution[k]);
    report(values, allCorrect ? "correct" : "incorrect");
  };

  const byNumber = (a: CrosswordEntry, b: CrosswordEntry) =>
    (entryNumbers[a.id] ?? 0) - (entryNumbers[b.id] ?? 0);
  const across = entries.filter((e) => e.dir === "across").sort(byNumber);
  const down = entries.filter((e) => e.dir === "down").sort(byNumber);

  // The clue body: blocks when the payload has them, the legacy string otherwise.
  // Mirrors `optionBodyNode` — same RichContentBlocks call, so a picture or audio
  // clue renders here exactly as it does on a choice option.
  const clueBody = (e: CrosswordEntry) => {
    const blocks = e.content?.blocks ?? [];
    if (blocks.length > 0) {
      return <RichContentBlocks blocks={blocks} compact capImages />;
    }
    return e.clue ?? "";
  };

  const clueItem = (e: CrosswordEntry) => (
    <li key={e.id} className={`text-sm sm:text-base ${skin.emphasis?.("neutral", "medium") ?? "text-slate-800 font-bold"}`}>
      <span className={skin.emphasis?.("primary", "medium") ?? "text-teal-500"}>{entryNumbers[e.id]}.</span>{" "}
      {clueBody(e)}
    </li>
  );
  const showState = !recordOnly && (submitted || status === "success");
  const reveal = !recordOnly
    ? entries
        .map((e) => {
          const num = entryNumbers[e.id];
          const dirLabel = e.dir === "across" ? "Ngang" : "Dọc";
          return `${num !== undefined ? `${num} ` : ""}${dirLabel}: ${e.answer}`;
        })
        .join("\n")
    : undefined;

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div className="flex min-w-0 flex-col gap-6 items-center">
        {/* ponytail: cells are fluid squares capped at 2.75rem so the board always
            fits its column — no horizontal scroll. Font tracks cell width via a
            container query (cqw = 1% of the wrapper), capped at the old xl size. */}
        <div
          className="w-full min-w-0 flex justify-center"
          style={{ containerType: "inline-size" }}
          data-crossword-grid
        >
          <div
            className={`grid w-full gap-0.5 shadow-lg p-1.5 ${skin.panel?.("board") ?? "bg-slate-800 rounded-2xl border-4 border-slate-800"}`}
            style={{
              gridTemplateColumns: `repeat(${size.cols}, minmax(0, 1fr))`,
              maxWidth: `${size.cols * 2.75}rem`,
              fontSize: `min(1.25rem, ${(60 / size.cols).toFixed(2)}cqw)`,
            }}
          >
            {Array.from({ length: size.rows }).map((_, r) =>
              Array.from({ length: size.cols }).map((__, c) => {
              const k = cellKey(r, c);
              const isWhite = occupiedCells.has(k);
              if (!isWhite) {
                return <div key={k} className={`aspect-square w-full ${skin.accent?.("neutral", "fill") ?? "bg-slate-800"}`} />;
              }
              const given = givens[k];
              const num = cellNumbers[k];
              // `!` so the tint wins over the skin's own cell background, whatever
              // order the classes land in.
              const keywordCls = keywordCells.has(k)
                ? " !bg-amber-100  !border-amber-400"
                : "";
              // Số thứ tự ô chữ: hỏi mức "strong" chứ không phải "soft". Nó in ở
              // text-[0.5em] (~10px) trong góc ô — cỡ nhỏ nhất của cả player, và là
              // thứ học sinh dò để bắt cặp ô với lời gợi ý, nên phải đậm hơn chữ
              // thường. Khi playful nhẹ đi một nấc (skins.ts), "soft" tụt xuống 600
              // và số này mờ hẳn; "strong" giữ nó ở 700.
              const numberBadge = num !== undefined && (
                <span className={`absolute top-0 left-0.5 text-[0.5em] leading-none pointer-events-none ${skin.emphasis?.("neutral", "strong") ?? "font-black text-slate-500"}`}>
                  {num}
                </span>
              );
              if (given !== undefined) {
                return (
                  <div key={k} className="relative aspect-square w-full">
                    {numberBadge}
                    <div
                      data-cell-key={k}
                      data-given="true"
                      aria-label={`Hàng ${r + 1}, cột ${c + 1}: chữ cho sẵn ${given}`}
                      // ponytail: inline so the grid's fluid font/padding wins over skin classes.
                      style={{ fontSize: "1em", padding: 0 }}
                      // ô chữ cho sẵn là TĨNH — không lấy skin.input("idle")
                      // (trông như ô nhập được ở skin corporate).
                      className={`flex h-full w-full items-center justify-center uppercase font-black rounded-md bg-slate-100 border-2 border-slate-200 text-slate-800${keywordCls}`}
                    >
                      {given}
                    </div>
                  </div>
                );
              }
              const committed = values[k] ?? "";
              // Mid-composition the field shows the input method's raw buffer
              // (`as`), not the committed letter — otherwise React would write
              // the old value back into the DOM and cancel the composition.
              const val = composing?.key === k ? composing.text : committed;
              // Instant reveal (per cell) wins; fallback keeps the exact
              // post-submit semantics.
              const rv = instant.reveal(k);
              const ok = rv ? rv === "correct" : normalizeText(committed) === solution[k];
              const showCellState = Boolean(rv) || showState;
              let stateCls = "border-slate-200";
              if (showCellState) {
                stateCls = ok
                  ? "border-green-400 bg-green-50  text-green-700 "
                  : "border-red-400 bg-red-50  text-red-600";
              }
              return (
                <div key={k} className="relative aspect-square w-full">
                  {numberBadge}
                  <input
                    type="text"
                    aria-label={`Hàng ${r + 1}, cột ${c + 1}`}
                    data-cell-key={k}
                    // No `maxLength={1}`: it would refuse the second keystroke
                    // of a Telex/VNI letter. One character per cell is enforced
                    // in `setCell`, by grapheme.
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={val}
                    disabled={locked}
                    onCompositionStart={(e) => beginComposition(k, e.currentTarget.value)}
                    onCompositionEnd={(e) => endComposition(k, e.currentTarget.value)}
                    onChange={(e) => changeCell(k, e.target.value)}
                    onBlur={(e) => {
                      // Leaving the cell mid-composition (clicking away) still
                      // commits what was typed rather than dropping it.
                      if (composingKeyRef.current === k) endComposition(k, e.currentTarget.value);
                      gradeCell(k);
                    }}
                    style={{ fontSize: "1em", padding: 0 }}
                    className={`w-full h-full text-center uppercase ${
                      skin.input?.(showCellState ? (ok ? "correct" : "wrong") : "idle") ??
                      `font-black rounded-md bg-white border-2 outline-none focus:border-teal-500 ${stateCls}`
                    }${showCellState ? "" : keywordCls}`}
                  />
                </div>
              );
              }),
            )}
          </div>
        </div>

        {/* web-own (SBT-69): khung gợi ý — panel("clues"), giữ viền cũ khi bảng đổi slate-300 */}
        <div className={`w-full p-4 space-y-4 ${skin.panel?.("clues") ?? "bg-white/70 rounded-3xl border-4 border-white shadow"}`}>
          {across.length > 0 && (
            <div>
              <p className={`mb-1 text-lg ${skin.emphasis?.("primary", "strong") ?? "font-black text-teal-600"}`}>Hàng ngang</p>
              <ul className="space-y-1">{across.map(clueItem)}</ul>
            </div>
          )}
          {down.length > 0 && (
            <div>
              <p className={`mb-1 text-lg ${skin.emphasis?.("primary", "strong") ?? "font-black text-teal-600"}`}>Hàng dọc</p>
              <ul className="space-y-1">{down.map(clueItem)}</ul>
            </div>
          )}
        </div>
      </div>

      {/* mode "parent": ẩn nút tự-chấm — cha chấm; đáp án đã emit từng ô (setCell). */}
      {!instant.active && !locked && mode !== "parent" && (
        <div className="flex justify-center mt-6">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={check}
            className={
              skin.actionButton?.(true, "primary") ??
              "px-8 py-3 rounded-full border-4 border-teal-500 bg-teal-400 text-white font-black text-lg shadow-lg"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}

      {status === "error" && (
        <PlayerInlineFeedback kind="error" fallbackClass="text-center mt-3 text-red-500 font-bold">
          Chưa đúng hết rồi, thử lại nhé!
        </PlayerInlineFeedback>
      )}
      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="text-center mt-3 text-green-600 font-black">
          Tuyệt vời! 🎉
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
