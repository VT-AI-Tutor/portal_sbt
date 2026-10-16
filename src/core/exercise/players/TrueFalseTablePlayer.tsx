/**
 * Pxx — Multiple true/false statements in a Đ/S table.
 * schema: multi_true_false_table
 *
 * Each row is a statement; the student picks Đ (true) or S (false). AUTO-graded:
 * every row's pick must match the statement's `correct` flag.
 *
 * Emit = Record<statementId, boolean>.
 */
import React, { useMemo } from "react";
import { motion } from "motion/react";
import {
  PlayerShell,
  MatchItemBody,
  MEDIA_TICK_TABLE_MAX_HEIGHT,
  tableStripeClass,
  useGrading,
  useInstantGrading,
  type PlayerProps,
} from "./shared";
import type { RichContent } from "@/core/question-schema";
import { restoredBooleanRecord, useRestoredAnswerState } from "./answer-restore";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { plainTextFromAuthoredMath } from "@/core/math/plainTextFromAuthoredMath";

export interface TFTableStatement {
  id: string;
  label?: string;
  /** Optional situation/context column (bảng 4 cột Tình huống | Phát biểu | Đ | S). */
  situation?: string;
  /** Image for the situation column, when the situation is authored as an image. */
  situationImageUrl?: string;
  /** Authored `width` of that image block, when the author sized it (issue #783). */
  situationImageWidth?: string;
  /** Authored blocks of the situation cell — carried so text + ảnh both render (issue #837). */
  situationContent?: RichContent;
  text: string;
  /** Image for the statement column, when the statement is authored as an image. */
  imageUrl?: string;
  /** Authored `width` of that image block, when the author sized it (issue #783). */
  imageWidth?: string;
  /**
   * Authored blocks of the statement cell (issue #837). `text` is the flattened
   * fallback; the cell renders THESE so a nhận định that carries both câu chữ and
   * an ảnh minh hoạ shows both, in the order the author wrote them, instead of
   * the picture silently replacing the sentence.
   */
  content?: RichContent;
  correct: boolean;
}

export interface TrueFalseTablePlayerProps extends PlayerProps {
  statements: TFTableStatement[];
  trueLabel?: string;
  falseLabel?: string;
  statementLabel?: string;
  /** Header label for the optional situation column. */
  situationLabel?: string;
}

export const TrueFalseTablePlayer: React.FC<TrueFalseTablePlayerProps> = ({
  statements,
  trueLabel = "Đ",
  falseLabel = "S",
  statementLabel = "Nhận định",
  situationLabel = "Tình huống",
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
  // Kênh khôi phục: Record<statementId, boolean> đã lưu hydrate lại các ô Đ/S.
  // (Không dùng useHydratedRecordAnswer — hook đó ép value về string, mất boolean.)
  const [values, setValues] = useRestoredAnswerState<Record<string, boolean>>(
    restoredBooleanRecord(answer),
  );
  const { status, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  // A meaningful key always exists (every statement carries `correct`), but
  // honour selfAssessment for record-only surveys.
  const recordOnly = selfAssessment === true;

  const elementIds = useMemo(() => statements.map((s) => s.id), [statements]);
  const valuesRef = React.useRef(values);
  valuesRef.current = values;
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => valuesRef.current,
    report,
    onElementGraded,
    onProgress,
  });

  const locked = submitted || (!instant.active && status === "success");
  // Show the 4-column layout only when data actually carries situations, so legacy
  // 3-column payloads render exactly as before.
  const showSituation = statements.some((s) => (s.situation ?? "").trim().length > 0 || !!s.situationImageUrl);

  const select = (id: string, val: boolean) => {
    if (locked) return;
    // Đọc từ ref, KHÔNG từ closure `values` của render hiện tại: 2 click liền
    // tay có thể tới trước khi React kịp re-render (sync-lane flush qua
    // microtask) — spread từ state cũ sẽ nuốt click trước (lost update).
    // Ghi ref đồng bộ ngay để click sau và instant.grade→buildAnswer luôn thấy
    // giá trị mới nhất (pattern CrosswordPlayer.setCell).
    const next = { ...valuesRef.current, [id]: val };
    valuesRef.current = next;
    setValues(next);
    if (recordOnly) {
      report(next, "incomplete");
      return;
    }
    onAnswerChange?.(next);
    // Instant: mỗi lần chọn Đ/S là chấm ngay dòng đó (đáp án nhị phân xác định).
    if (instant.active) {
      const stmt = statements.find((s) => s.id === id);
      if (stmt) instant.grade(id, val === stmt.correct ? "correct" : "incorrect");
    }
  };

  const answeredCount = statements.filter((s) => values[s.id] !== undefined).length;

  const check = () => {
    if (locked || answeredCount === 0) return;
    if (recordOnly) {
      report(values, "incomplete");
      return;
    }
    const allCorrect = statements.every((s) => values[s.id] === s.correct);
    report(values, allCorrect ? "correct" : "incorrect");
  };

  const showResults = !recordOnly && (submitted || status === "success");

  // Bảng đáp án là CHUỖI thuần (không nhận element), nên TeX tác giả soạn phải
  // được hạ xuống chữ đọc được (`\(\frac{1}{4}\)` → `1/4`) thay vì in nguyên
  // delimiter ra cho người dùng.
  const reveal = !recordOnly
    ? statements
        .map((s) => `${plainTextFromAuthoredMath(s.text)}: ${s.correct ? "Đúng" : "Sai"}`)
        .join("\n")
    : null;

  const cellBtn = (
    stmt: TFTableStatement,
    val: boolean,
    label: string,
  ) => {
    const selected = values[stmt.id] === val;
    // Instant reveal (per-row verdict) khi bật; nếu không, dùng logic sau submit.
    const rowVerdict = instant.reveal(stmt.id);
    const revealResults = rowVerdict !== undefined || showResults;
    const correctPick = revealResults && selected && stmt.correct === val;
    const wrongPick = revealResults && selected && stmt.correct !== val;
    const cellState = correctPick
      ? "correct"
      : wrongPick
        ? "wrong"
        : selected
          ? "selected"
          : "idle";
    /**
     * Mô tả hàng đọc cho trình đọc màn hình. `stmt.text` KHÔNG phải lúc nào cũng
     * có chữ, nên không ghép thẳng được:
     *
     * - Nhận định chỉ có ẢNH (#837/#783): `dispatch` cố ý để `text` rỗng, ghép
     *   thẳng sẽ ra "Đ — " — gạch ngang cụt, còn tệ hơn lúc chưa khai aria-label
     *   vì khi đó tên khả truy cập ít nhất là "Đ".
     * - Hàng không chữ, không ảnh, không nhãn: `dispatch` lùi về chính `id`, ghép
     *   thẳng sẽ đọc "Đ — s_b", lộ khoá nội bộ ra người dùng.
     *
     * Nên: lấy chữ thật → tình huống (bảng 4 cột) → nhãn "a)"; không có gì đọc
     * được thì để trơ chữ cái, KHÔNG kèm gạch ngang.
     */
    const bodyText = plainTextFromAuthoredMath(stmt.text);
    const rowDescription =
      (bodyText && bodyText !== stmt.id ? bodyText : "") ||
      plainTextFromAuthoredMath(stmt.situation) ||
      stmt.label?.trim() ||
      "";
    return (
      <button
        type="button"
        onClick={() => select(stmt.id, val)}
        disabled={locked}
        // Trình đọc màn hình: ô Đ/S là nút BẬT/TẮT. Không khai `aria-pressed` thì
        // ô đã chọn và ô trống phát ra âm thanh y hệt — học sinh khiếm thị không
        // biết mình đã trả lời chưa. Và một chữ cái trơ không đủ ngữ cảnh, nên
        // `aria-label` gắn luôn nhận định vào; qua `plainTextFromAuthoredMath` để
        // TeX không bị đọc ra thành `\frac{1}{5}`. Khuôn lấy từ P44 (CheckboxTable).
        aria-pressed={selected}
        aria-label={rowDescription ? `${label} — ${rowDescription}` : label}
        // Playful nhẹ đi một nấc (xem skins.ts) KHÔNG áp cho ô này: chữ Đ/S trong
        // BẢNG, ô w-10 — giữ font-black để nhận biết.
        //
        // web-own: LUẬT MÀU dưới đây chỉ đúng ở repo này, vì chỉ repo này có sọc
        // thân bảng (studio không có `tableStripeClass` lẫn role `stripe`). Bản
        // studio giữ nền nhạt `bg-indigo-100` và không sai — trên hàng trắng nó
        // không đụng gì. Copy đè từ studio SẼ trả lỗi NXB về nguyên trạng;
        // players/true-false-table-stripe-contrast.test.tsx khoá lại.
        //
        // LUẬT MÀU (NXB báo hai lần, Toán 4 tập một bài 1 C1/C2: "ĐC màu để nút
        // Đ, S ở dòng màu tím để hiển thị rõ"):
        //
        //   ô CÓ giá trị → nền ĐẶC + chữ trắng;  ô TRỐNG → nền TRẮNG + viền đủ đậm.
        //
        // Vì sao: thân bảng có sọc chẵn/lẻ, sọc lấy màu qua
        // `skin.accent("primary", "stripe")` — skin playful trả về tint bản sắc của
        // player, mà player này accent indigo nên sọc ra `bg-indigo-100`. Nền nhạt
        // CŨ của ô đã chọn cũng đúng `bg-indigo-100`: ở hàng lẻ hai thứ trùng khít
        // (cùng oklch(0.93 0.034 272.788)), ô đã chọn mất tín hiệu nền. Ô trống thì
        // không khai nền nên ăn luôn màu sọc.
        //
        // Các sắc độ dưới đây CHỌN THEO SỐ ĐO, không theo cảm nhận — tỉ lệ tương
        // phản WCAG đo trên chính trang này:
        //
        //   indigo-500 · chữ trắng 4.58 · so với sọc 3.71   ✔ đạt AA
        //
        // Ô ĐÚNG/SAI đứng trên nền KHÁC: hàng đã chấm không còn sọc chàm — nó nhận
        // `accent("success"|"danger", "softFill")`, đo ra green-100 / red-100. Nên
        // ràng buộc của hai ô này là nền tint CÙNG HỌ MÀU, không phải sọc:
        //
        //   green-500 · chữ trắng 2.22 · so với nền hàng 2.02 · viền green-600 2.93
        //   red-500   · chữ trắng 3.81 · so với nền hàng 3.12 · viền red-600   3.91
        //
        // OWNER CHỐT 21/09/2026: quay lại đúng cặp 500 của vòng 09/09, sau khi so
        // BỐN đời màu dựng thật trên /dev/players (bản gốc nền nhạt · 500 · vòng
        // 11/09 green-700/red-600 · và bản trung gian green-600/red-500). NXB báo
        // hai lần rằng cặp 700/600 ĐẬM quá so với màu cũ; nấc 500 là thứ họ nhận ra
        // là "màu cũ".
        //
        // Đánh đổi ĐÃ BIẾT, không phải bỏ sót: chữ trắng trên green-500 chỉ được
        // 2.22 — trượt cả ngưỡng chữ lớn 3:1 — nên chữ "Đ"/"Đúng" trên ô xanh sẽ
        // chìm trên màn hình kém hoặc máy chiếu. Chấp nhận được vì chữ trong ô chỉ
        // LẶP LẠI nhãn cột đã ghi ở <th> ("Đúng" / "Sai"): thông tin thật nằm ở
        // MÀU + CỘT, chữ là lớp thừa. Nếu sau này cần chữ đọc rõ mà vẫn giữ nền
        // tươi, đường ra là đổi chữ sang mực sẫm cùng họ (green-950 trên green-400
        // đo 8.40) chứ ĐỪNG lặng lẽ đẩy nền tối lại — đó chính là vòng đã bị bác.
        //
        // Ranh giới ô không dựa vào nền: viền 4px gánh (green-600 2.93 · red-600
        // 3.91 so với nền hàng).
        //
        // Viền ô trống là `slate-400` chứ không phải `slate-200`: slate-200 so với
        // sọc chỉ 1.00 — CÙNG độ sáng, tức viền tàng hình đúng trên hàng có sọc,
        // chỗ cần nó nhất. slate-300 cũng chỉ 1.21; slate-400 được 2.13.
        //
        // Viền HOVER phải ĐẬM HƠN trạng thái nghỉ, nếu không rê chuột lại làm ô
        // mờ đi. indigo-300 chỉ 1.63 so với sọc — THẤP hơn 2.13 của lúc nghỉ, nên
        // đã nâng lên indigo-400 (2.54). Không dùng indigo-500 vì đó là nền của ô
        // ĐÃ CHỌN — hover không được nhái trạng thái đã chọn.
        className={`w-10 h-10 ${
          skin.optionCard?.(cellState, "neutral") ??
          `rounded-xl border-4 font-black text-lg transition-all ${
            selected
              ? correctPick
                ? "bg-green-500 border-green-600 text-white"
                : wrongPick
                  ? "bg-red-500 border-red-600 text-white"
                  : "bg-indigo-500 border-indigo-600 text-white"
              : "bg-white border-slate-400 hover:border-indigo-400  hover:bg-indigo-50  text-transparent"
          }`
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div className={`overflow-hidden ${skin.panel?.("table") ?? "bg-white rounded-[24px] border-2 border-slate-300 shadow-2xl"}`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {/* web-own: MỌI nhãn ở hàng tiêu đề căn giữa. Cột đầu căn TRÁI trong
                  khi Đ/S căn giữa làm cả dải tiêu đề lệch hẳn về một bên (NXB ghi
                  nhận lặp ở Đạo đức, Lịch sử và Địa lí, Toán 1). Sửa ở <th> nên áp
                  cho mọi giá trị tác giả khai — "Nhận định", "Thông tin", "Hành vi,
                  việc làm" — không neo vào một chữ nào. Ô nội dung trong <tbody>
                  VẪN căn trái: nhận định là câu dài, phải đọc theo dòng. */}
              <tr className={skin.accent?.("primary", "band") ?? "bg-indigo-500"}>
                {showSituation && (
                  <th className={`p-3 md:p-4 text-center text-sm md:text-base border-r-2 min-w-[200px] ${skin.emphasis?.("primary", "strong") ?? "font-black text-white border-white/20"}`}>
                    <RichTextValue value={situationLabel} />
                  </th>
                )}
                <th className={`p-3 md:p-4 text-center text-sm md:text-base border-r-2 min-w-[200px] ${skin.emphasis?.("primary", "strong") ?? "font-black text-white border-white/20"}`}>
                  <RichTextValue value={statementLabel} />
                </th>
                <th className={`p-3 md:p-4 text-center text-sm md:text-base border-r-2 w-20 ${skin.emphasis?.("primary", "strong") ?? "font-black text-white border-white/20"}`}>
                  <RichTextValue value={trueLabel} />
                </th>
                <th className={`p-3 md:p-4 text-center text-sm md:text-base w-20 ${skin.emphasis?.("primary", "strong") ?? "font-black text-white"}`}>
                  <RichTextValue value={falseLabel} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-300">
              {statements.map((stmt, idx) => {
                const selected = values[stmt.id];
                const rowVerdict = instant.reveal(stmt.id);
                const revealRow = rowVerdict !== undefined || showResults;
                const rowCorrect = revealRow && selected === stmt.correct;
                const rowWrong =
                  revealRow && selected !== undefined && selected !== stmt.correct;
                return (
                  <tr
                    key={stmt.id}
                    className={`transition-colors ${
                      rowCorrect
                        ? skin.accent?.("success", "softFill") ?? "bg-green-50 "
                        : rowWrong
                          ? skin.accent?.("danger", "softFill") ?? "bg-red-50 "
                          : tableStripeClass(skin, idx, "bg-indigo-50/60")
                    }`}
                  >
                    {showSituation && (
                      <td className={`px-3 py-2 md:px-4 text-sm md:text-base border-r-2 border-slate-300 whitespace-pre-wrap ${skin.emphasis?.("neutral", "medium") ?? "font-bold text-slate-800"}`}>
                        {/* MatchItemBody dựng nội dung qua đường rich-text, nên TeX
                            trong ô tình huống vẫn được KaTeX dựng (#839). */}
                        <MatchItemBody
                          item={{
                            text: stmt.situation,
                            imageUrl: stmt.situationImageUrl,
                            imageWidth: stmt.situationImageWidth,
                            content: stmt.situationContent,
                          }}
                          imageMaxHeight={MEDIA_TICK_TABLE_MAX_HEIGHT}
                        />
                      </td>
                    )}
                    <td className={`px-3 py-2 md:px-4 text-sm md:text-base border-r-2 border-slate-300 ${skin.emphasis?.("neutral", "medium") ?? "font-bold text-slate-800"}`}>
                      {/* FLEX ROW nhãn | nội dung: nội dung nhận định render qua
                          các <div> block-level (AlignedRichText/MatchItemBody) —
                          để trôi tự nhiên thì <div> rơi xuống DƯỚI nhãn inline,
                          "a)" đứng trơ một dòng (Owner 8/8, bai33 tam giác).
                          Nhãn cột trái shrink-0, nội dung (kể cả nhiều đoạn /
                          kèm ảnh) cột phải. */}
                      <div className={stmt.label ? "flex items-start gap-2" : undefined}>
                        {stmt.label && (
                          <span className={`shrink-0 ${skin.emphasis?.("primary", "strong") ?? "font-black text-indigo-500"}`}>{stmt.label}</span>
                        )}
                        {/* Ô nhận định KHÔNG chọn một trong hai: một nhận định vừa có
                            câu chữ vừa có ảnh minh hoạ phải hiện cả hai, đúng thứ tự
                            tác giả viết (issue #837). MatchItemBody đã mã hoá đúng luật
                            đó (#829) — dùng lại thay vì `imageUrl ? ảnh : chữ`. */}
                        <div className="min-w-0 flex-1">
                          <MatchItemBody
                            item={{
                              text: stmt.text,
                              imageUrl: stmt.imageUrl,
                              imageWidth: stmt.imageWidth,
                              content: stmt.content,
                            }}
                            imageMaxHeight={MEDIA_TICK_TABLE_MAX_HEIGHT}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 md:px-4 text-center border-r-2 border-slate-300">
                      {cellBtn(stmt, true, trueLabel)}
                    </td>
                    <td className="px-3 py-2 md:px-4 text-center">
                      {cellBtn(stmt, false, falseLabel)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nút tự-chấm chỉ ở gradeMode self — luồng parent-graded (thi) không thấy. */}
      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={check}
          disabled={answeredCount === 0}
          className={`mt-5 ${
            skin.actionButton?.(answeredCount > 0, "neutral") ??
            `px-8 py-3 rounded-full border-4 font-black text-base sm:text-lg transition-all
            ${
              answeredCount === 0
                ? "bg-slate-100 border-slate-200 text-slate-500"
                : "bg-indigo-400 border-indigo-500 text-white hover:bg-indigo-500"
            }`
          }`}
        >
          Kiểm tra
        </motion.button>
      )}
    </PlayerShell>
  );
};
