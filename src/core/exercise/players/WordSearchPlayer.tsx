/**
 * Word search / "word_search".
 * schema: word_search
 *
 * Render a letter grid. The student selects a straight run of cells (click a
 * start cell then an end cell, or drag across them). If the run spells a target
 * word forward or reverse, it is marked found and the cells stay highlighted.
 * Win when every word is found → report(found, "correct").
 *
 * Emitted answer: { word: string, cells: [number, number][] }[]
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { PlayerInlineFeedback, PlayerShell, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface WordSearchPlayerProps extends PlayerProps {
  grid: string[][];
  words: string[];
}

interface Found {
  word: string;
  cells: [number, number][];
}

const cellKey = (r: number, c: number) => `${r}-${c}`;

/** All cells on the straight line between two endpoints, or null if not straight. */
function lineBetween(
  a: [number, number],
  b: [number, number],
): [number, number][] | null {
  const [r1, c1] = a;
  const [r2, c2] = b;
  const dr = r2 - r1;
  const dc = c2 - c1;
  const isStraight =
    dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
  if (!isStraight) return null;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  const cells: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    cells.push([r1 + sr * i, c1 + sc * i]);
  }
  return cells;
}

/**
 * Sanitize a parent-supplied answer into Found[]: keep only entries whose word
 * belongs to the key (dedup) and whose cells are [row, col] number pairs —
 * malformed/foreign entries are silently dropped so hydration never breaks.
 */
function sanitizeFound(value: unknown, words: string[]): Found[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: Found[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { word, cells } = entry as { word?: unknown; cells?: unknown };
    if (typeof word !== "string" || seen.has(word) || !words.includes(word)) continue;
    if (!Array.isArray(cells)) continue;
    const cleanCells: [number, number][] = [];
    for (const cell of cells) {
      if (Array.isArray(cell) && typeof cell[0] === "number" && typeof cell[1] === "number") {
        cleanCells.push([cell[0], cell[1]]);
      }
    }
    seen.add(word);
    out.push({ word, cells: cleanCells });
  }
  return out;
}

export const WordSearchPlayer: React.FC<WordSearchPlayerProps> = ({
  grid,
  words,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  // Kênh khôi phục cha cấp (`answer`) — YesNo selectionKey pattern: chỉ reset
  // khi cha đưa đáp án khác ngữ nghĩa (không reset khi echo). Không remount.
  const initialFound = sanitizeFound(answer, words);
  const answerKey = JSON.stringify(initialFound);
  const [found, setFound] = useState<Found[]>(initialFound);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    if (JSON.stringify(found) !== answerKey) setFound(initialFound);
  }
  const [start, setStart] = useState<[number, number] | null>(null);
  const [hover, setHover] = useState<[number, number] | null>(null);
  // Wrong-attempt feedback: the picked run flashes red (mirroring the green
  // "correct" tint) then clears — so a miss reads as "sai" instead of silently
  // vanishing, but doesn't persist the way a correct find does.
  const [wrongCells, setWrongCells] = useState<Set<string> | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(wrongTimer.current), []);
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const locked = submitted || status === "success";
  const recordOnly = selfAssessment === true || words.length === 0;
  const reveal = !recordOnly ? words.map((w) => w.toUpperCase()).join(", ") : null;

  const targets = useMemo(
    () => words.map((w) => w.replace(/\s+/g, "").toUpperCase()),
    [words],
  );

  const foundWords = useMemo(() => new Set(found.map((f) => f.word)), [found]);

  const foundCellSet = useMemo(() => {
    const s = new Set<string>();
    for (const f of found) for (const [r, c] of f.cells) s.add(cellKey(r, c));
    return s;
  }, [found]);

  // Preview cells while picking the second endpoint.
  const previewCells = useMemo(() => {
    if (!start || !hover) return null;
    return lineBetween(start, hover);
  }, [start, hover]);
  const previewSet = useMemo(() => {
    const s = new Set<string>();
    if (previewCells) for (const [r, c] of previewCells) s.add(cellKey(r, c));
    return s;
  }, [previewCells]);

  const tryRun = (cells: [number, number][]) => {
    const letters = cells
      .map(([r, c]) => (grid[r]?.[c] ?? "").toUpperCase())
      .join("");
    const reversed = letters.split("").reverse().join("");
    const matchIdx = targets.findIndex(
      (t) => (t === letters || t === reversed) && !foundWords.has(words[targets.indexOf(t)]),
    );
    if (matchIdx === -1) return false;
    const word = words[matchIdx];
    if (foundWords.has(word)) return false;
    const next = [...found, { word, cells }];
    setFound(next);
    if (next.length === words.length) {
      // Record-only (selfAssessment): finding every word only syncs the answer —
      // no verdict, no success sound.
      report(next, recordOnly ? "incomplete" : "correct");
    } else {
      onAnswerChange?.(next);
    }
    return true;
  };

  const onCellDown = (r: number, c: number) => {
    if (locked) return;
    setStart([r, c]);
    setHover([r, c]);
  };

  const onCellEnter = (r: number, c: number) => {
    if (locked || !start) return;
    setHover([r, c]);
  };

  /** Flash the attempted (wrong) run red, then clear it after a beat. */
  const flashWrong = (cells: [number, number][]) => {
    setWrongCells(new Set(cells.map(([r, c]) => cellKey(r, c))));
    clearTimeout(wrongTimer.current);
    wrongTimer.current = setTimeout(() => setWrongCells(null), 800);
  };

  const onCellUp = (r: number, c: number) => {
    if (locked || !start) return;
    const cells = lineBetween(start, [r, c]);
    setStart(null);
    setHover(null);
    if (!cells) return;
    if (!tryRun(cells)) flashWrong(cells);
  };

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/*
          Lưới "giấy kẻ ô": mỗi ô hình vuông, VIỀN RÕ liền mạch, không bo góc lớn,
          không shadow. Chủ ý KHÔNG dùng skin.chip/skin.panel — chip là "viên
          thuốc" bo tròn dùng chung nhiều player, làm ô méo + mờ viền. Đường kẻ
          dùng `border-slate-300` (không phải token `--border` gần như trắng) nên
          hiện rõ ở mọi skin: container viền + mỗi ô thêm viền phải/dưới → lưới 1px
          liền, đồng nhất ở MỌI skin (Học sinh / Studio).
        */}
        <div
          className="inline-grid gap-0 overflow-hidden rounded-md border border-slate-300 select-none"
          style={{ gridTemplateColumns: `repeat(${grid[0]?.length ?? 0}, minmax(0, 1fr))` }}
          onMouseLeave={() => start && setHover(start)}
        >
          {grid.map((row, r) =>
            row.map((ch, c) => {
              const k = cellKey(r, c);
              const isFound = foundCellSet.has(k);
              const isWrong = wrongCells?.has(k) ?? false;
              const isPreview = previewSet.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  disabled={locked}
                  onMouseDown={() => onCellDown(r, c)}
                  onMouseEnter={() => onCellEnter(r, c)}
                  onMouseUp={() => onCellUp(r, c)}
                  className={`w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 border-r border-b border-slate-300 font-bold text-base sm:text-lg md:text-xl flex items-center justify-center transition-colors ${
                    isFound
                      ? "bg-green-200 text-green-900  "
                      : isWrong
                        ? "bg-red-200 text-red-900  "
                        : isPreview
                          ? "bg-purple-200 text-purple-900  "
                          : "bg-white text-slate-800 hover:bg-purple-100 "
                  }`}
                >
                  {ch.toUpperCase()}
                </button>
              );
            }),
          )}
        </div>

        <div className={`p-4 min-w-[10rem] ${skin.panel?.("card") ?? "bg-white/70 rounded-md border border-slate-200"}`}>
          <p className={`mb-2 text-lg ${skin.emphasis?.("primary", "strong") ?? "text-purple-600 font-black"}`}>Tìm từ:</p>
          <ul className="flex flex-wrap lg:flex-col gap-2">
            {words.map((w) => {
              const done = foundWords.has(w);
              return (
                <li
                  key={w}
                  className={`px-3 py-1 ${skin.emphasis?.("neutral", "medium") ?? "font-bold"} transition-colors
                    ${
                      skin.chip?.(done ? "correct" : "idle", "secondary") ??
                      `rounded-full border-2 ${
                        done
                          ? "bg-green-100  border-green-400 text-green-700  line-through"
                          : "bg-slate-100 border-slate-200 text-slate-800"
                      }`
                    }`}
                >
                  {w.toUpperCase()}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="text-center mt-4 text-green-600 font-black text-lg">
          Tuyệt vời! Tìm được hết rồi! 🎉
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
