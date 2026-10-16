/**
 * Pxx — Checkbox grid table.
 * schema: checkbox_table
 *
 * A grid where each cell is a checkbox. Every row may have one or more correct
 * columns. The student ticks cells; a row is correct when its ticked set equals
 * the row's correct columns (order-independent).
 *
 * Emit = Record<rowId, columnId[]>.
 */
import React, { useMemo, useRef } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, MatchItemBody, tableStripeClass, useGrading, useInstantGrading, sameSet, type PlayerProps } from "./shared";
import { restoredStringArrayRecord, useRestoredAnswerState } from "./answer-restore";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { plainTextFromAuthoredMath } from "@/core/math/plainTextFromAuthoredMath";
import type { RichContent } from "@/core/question-schema";

export interface CheckboxTableColumn {
  id: string;
  label: string;
}

export interface CheckboxTableRow {
  id: string;
  label: string;
  /** Image for the row header, when the row is authored as an image (content image block). */
  imageUrl?: string;
  /** Authored `width` of that image block, when the author sized it (issue #783). */
  imageWidth?: string;
  /**
   * Authored blocks of the row header (issue #837). `label` is the flattened
   * fallback; the cell renders THESE so a hàng that carries both câu chữ and an
   * ảnh minh hoạ shows both, in the order the author wrote them.
   */
  content?: RichContent;
}

export interface CheckboxTablePlayerProps extends PlayerProps {
  columns: CheckboxTableColumn[];
  /** rowId → array of correct columnIds for that row. */
  correctCells: Record<string, string[]>;
  rows: CheckboxTableRow[];
  /**
   * Header of the row-label column (the top-left cell) — "Phát biểu", "Việc làm",
   * "Nhận định"… The workbook prints one next to the tick columns (issue #843).
   * Absent → the cell stays blank, exactly as before.
   */
  rowsLabel?: string;
}

const cellKey = (rowId: string, colId: string) => `${rowId}::${colId}`;

export const CheckboxTablePlayer: React.FC<CheckboxTablePlayerProps> = ({
  columns,
  rows,
  correctCells,
  rowsLabel,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  // Kênh khôi phục: Record<rowId, columnId[]> đã lưu hydrate lại các ô đã tích.
  // (Không dùng useHydratedRecordAnswer — hook đó ép value về string, mất mảng.)
  const [picked, setPicked] = useRestoredAnswerState<Record<string, string[]>>(
    restoredStringArrayRecord(answer),
  );
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  const hasKey =
    !!correctCells &&
    rows.some((r) => Array.isArray(correctCells[r.id]) && correctCells[r.id].length > 0);
  const recordOnly = selfAssessment === true || !hasKey;
  // element = each checkbox cell (rowId × colId).
  const elementIds = useMemo(
    () => rows.flatMap((r) => columns.map((c) => cellKey(r.id, c.id))),
    [rows, columns],
  );
  // Ô ĐÚNG của cả bảng, phẳng thành danh sách khoá — "xong" là tick đúng bấy
  // nhiêu ô và không tick ô nào khác (xem ghi chú expectedIds).
  const expectedCellIds = useMemo(
    () => rows.flatMap((r) => (correctCells[r.id] ?? []).map((c) => cellKey(r.id, c))),
    [rows, correctCells],
  );
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const instant = useInstantGrading({
    elementIds,
    expectedIds: expectedCellIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => pickedRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");

  const toggle = (rowId: string, colId: string) => {
    if (locked) return;
    // Compute `next` from the ref (not a functional setState updater — the
    // updater is not guaranteed to run synchronously here, which would leave
    // the instant-grade call below reading a stale/undefined value; and not
    // the render closure `picked` — 2 rapid clicks can land before React
    // re-renders, and spreading the old state would swallow the first click).
    const current = pickedRef.current[rowId] ?? [];
    const nextRow = current.includes(colId)
      ? current.filter((x) => x !== colId)
      : [...current, colId];
    const next = { ...pickedRef.current, [rowId]: nextRow };
    setPicked(next);
    pickedRef.current = next;
    if (recordOnly) report(next, "incomplete");
    // Đổi lựa chọn sau khi "Kiểm tra" chấm sai → xoá trạng thái sai để thử lại.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    // Bỏ tích = rút lại lựa chọn, KHÔNG phải một câu trả lời mới. Chấm cả trạng
    // thái "bỏ trống" (mô hình cũ) khiến ô vừa bỏ tích vẫn giữ nguyên dấu ✓ có
    // màu — chỉ đổi xanh/đỏ — nên nhìn như vẫn còn tích. Giữ đúng quy ước của
    // các player chọn-nhiều khác (MultiChoice, TileSelect, SelectWords…):
    // tích thì chấm, bỏ tích thì clear để ô trở lại trạng thái trống.
    const isKeyCell = (correctCells[rowId] ?? []).includes(colId);
    const newSelected = nextRow.includes(colId);
    if (newSelected) instant.grade(cellKey(rowId, colId), isKeyCell ? "correct" : "incorrect");
    else instant.clear(cellKey(rowId, colId));
  };

  const totalTicked = rows.reduce((sum, r) => sum + (picked[r.id]?.length ?? 0), 0);

  const check = () => {
    if (locked || totalTicked === 0) return;
    if (recordOnly) {
      report(picked, "incomplete");
      return;
    }
    const allCorrect = rows.every((r) =>
      sameSet(picked[r.id] ?? [], correctCells[r.id] ?? []),
    );
    report(picked, allCorrect ? "correct" : "incorrect");
  };

  const showResults = !recordOnly && (submitted || status === "success");
  // "Kiểm tra" vừa chấm sai — chỉ tô đỏ các ô ĐÁNH DẤU SAI; ô đáp án đúng
  // không được lộ (không tô xanh) khi còn được thử lại.
  const errored = !recordOnly && !submitted && status === "error";

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div className={`overflow-hidden ${skin.panel?.("table") ?? "bg-white rounded-[24px] border-2 border-slate-300 shadow-2xl"}`}>
        {/* `px-0.5 py-0.5`: ô dấu tích phóng `scale: 1.12` khi rê chuột — ô 36px
            phình 2,2px mỗi bên, mà vùng cuộn cắt ở padding-box nên ô ở cột rìa
            mất nét viền (xem ChainMatchPlayer). Chỉ cần 2px, bảng không xê dịch. */}
        <div className="overflow-x-auto px-0.5 py-0.5">
          <table className="w-full border-collapse">
            <thead>
              <tr className={skin.accent?.("primary", "band") ?? "bg-emerald-500"}>
                <th className={`p-3 md:p-4 text-center text-sm md:text-base border-r-2 min-w-[160px] ${skin.emphasis?.("primary", "strong") ?? "font-black text-white border-white/20"}`}>
                  {/* Tiêu đề cột nhãn hàng do tác giả đặt; không có thì để trống như cũ.
                      web-own: căn GIỮA cho khớp các cột dấu tích bên phải — cùng luật
                      với TrueFalseTablePlayer, xem ghi chú ở hàng tiêu đề bên đó. */}
                  {rowsLabel ? <RichTextValue value={rowsLabel} /> : <>&nbsp;</>}
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={`p-3 md:p-4 text-center text-xs md:text-sm border-r-2 last:border-r-0 min-w-[100px] ${skin.emphasis?.("primary", "strong") ?? "font-black text-white border-white/20"}`}
                  >
                    {/* Cùng đường hiển thị với nhãn hàng: công thức/định dạng không in ra delimiter. */}
                    <RichTextValue value={col.label} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-300">
              {rows.map((row, rIdx) => {
                const rowTicked = picked[row.id] ?? [];
                const rowCorrect =
                  showResults && sameSet(rowTicked, correctCells[row.id] ?? []);
                const rowWrong =
                  showResults && !sameSet(rowTicked, correctCells[row.id] ?? []);
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      rowCorrect
                        ? skin.accent?.("success", "softFill") ?? "bg-green-50 "
                        : rowWrong
                          ? skin.accent?.("danger", "softFill") ?? "bg-red-50 "
                          : tableStripeClass(skin, rIdx, "bg-emerald-50/60")
                    }`}
                  >
                    <td className={`p-3 md:p-4 text-sm md:text-base border-r-2 border-slate-300 ${skin.emphasis?.("neutral", "medium") ?? "font-bold text-slate-800"}`}>
                      {/* Ô nhãn hàng KHÔNG chọn một trong hai — xem issue #837 và
                          MatchItemBody (#829): chữ và ảnh cùng hiện, đúng thứ tự. */}
                      <MatchItemBody
                        item={{
                          text: row.label,
                          imageUrl: row.imageUrl,
                          imageWidth: row.imageWidth,
                          content: row.content,
                        }}
                      />
                    </td>
                    {columns.map((col) => {
                      const selected = rowTicked.includes(col.id);
                      const isKeyCell = (correctCells[row.id] ?? []).includes(col.id);
                      const rv = instant.reveal(cellKey(row.id, col.id));
                      const cellShowCorrect = rv ? rv === "correct" : showResults && isKeyCell;
                      const cellShowWrong = rv
                        ? rv === "incorrect"
                        : (showResults || errored) && selected && !isKeyCell;
                      const cellState = cellShowCorrect
                        ? "correct"
                        : cellShowWrong
                          ? "wrong"
                          : selected
                            ? "selected"
                            : "idle";
                      // Dấu ✓ chỉ hiện khi ô ĐƯỢC tích (hoặc khi lộ đáp án sau
                      // khi nộp bài). Trước đây ô nào cũng in ✓ và chỉ dựa vào
                      // `text-transparent` để giấu — skin của Studio đặt màu chữ
                      // khác nên MỌI ô đều hiện ✓, không phân biệt được tích hay
                      // chưa. Không render glyph thì không skin nào làm lộ lại.
                      const showTick = selected || cellShowCorrect;
                      return (
                        <td
                          key={col.id}
                          className="p-2 md:p-3 text-center border-r-2 border-slate-300 last:border-r-0"
                        >
                          <div className="flex justify-center">
                            <motion.button
                              type="button"
                              onClick={() => toggle(row.id, col.id)}
                              disabled={locked}
                              aria-pressed={selected}
                              aria-label={`dấu tích — ${plainTextFromAuthoredMath(col.label)}`}
                              whileHover={!locked ? { scale: 1.12 } : undefined}
                              whileTap={!locked ? { scale: 0.88 } : undefined}
                              // Playful nhẹ đi một nấc (xem skins.ts) KHÔNG áp cho ô này:
                              // dấu tích trong BẢNG, ô w-9 — giữ font-black để nhận biết.
                              className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center ${
                                skin.optionCard?.(cellState, "success") ??
                                `rounded-xl border-4 font-black text-base transition-all
                                ${
                                  cellShowCorrect
                                    ? "bg-green-100  border-green-400 text-green-600"
                                    : cellShowWrong
                                      ? "bg-red-100  border-red-400 text-red-500"
                                      : selected
                                        ? "bg-emerald-400 border-emerald-500 text-white"
                                        : "bg-white border-slate-200 text-transparent hover:border-emerald-300  hover:bg-emerald-50 "
                                }`
                              }`}
                            >
                              {showTick ? "✓" : ""}
                            </motion.button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PlayerErrorFeedback show={status === "error" && !submitted} />

      {/* Nút tự-chấm chỉ ở gradeMode self — luồng parent-graded (thi) không thấy. */}
      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={check}
          disabled={totalTicked === 0}
          className={`mt-5 ${
            skin.actionButton?.(totalTicked > 0, "success") ??
            `px-8 py-3 rounded-full border-4 font-black text-base sm:text-lg transition-all
            ${
              totalTicked === 0
                ? "bg-slate-100 border-slate-200 text-slate-500"
                : "bg-emerald-400 border-emerald-500 text-white hover:bg-emerald-500"
            }`
          }`}
        >
          Kiểm tra
        </motion.button>
      )}
    </PlayerShell>
  );
};
