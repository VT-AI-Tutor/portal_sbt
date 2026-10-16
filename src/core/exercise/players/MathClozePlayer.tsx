/** P82 — Điền vào biểu thức: ô trống nằm bên trong công thức toán. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MathField, type MathFieldHandle } from "@/core/math/MathField";
import { MATH_FIELD_AS_CONTENT, MathFieldChromeStyles } from "./math-field-chrome";
import {
  mathPlaceholderIds,
  readMathPlaceholderValues,
  writeMathPlaceholderValues,
} from "@/core/math/mathPlaceholders";
import type { MathGradingMode } from "@/core/math/grading";
import {
  gradeMathClozeBlank,
  mathClozeBlankIds,
  shouldApplyPromptState,
  stableAnswerKey,
  type MathClozeBlank,
} from "./math-cloze";
import {
  PlayerShell,
  useGrading,
  useInstantGrading,
  type PlayerProps,
} from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface MathClozePlayerProps extends PlayerProps {
  /** LaTeX of each interactive formula, each carrying `\placeholder[id]{}`. */
  formulas: string[];
  blanks: MathClozeBlank[];
  gradingMode?: MathGradingMode;
  tolerance?: number;
}

type BlankVerdict = "correct" | "incorrect" | undefined;

export const MathClozePlayer: React.FC<MathClozePlayerProps> = ({
  formulas,
  blanks,
  gradingMode,
  tolerance,
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
  // `formulas` arrives as a fresh array on every dispatch render, so identity is
  // useless as a dependency. The joined text is the stable thing.
  const formulaKey = formulas.join("\u0000");
  const formulaList = useMemo(
    () => (formulaKey ? formulaKey.split("\u0000") : []),
    [formulaKey],
  );
  const blankIds = useMemo(() => mathClozeBlankIds(formulaList), [formulaList]);
  const blankById = useMemo(
    () => new Map((blanks ?? []).map((blank) => [blank.id, blank])),
    [blanks],
  );
  const fieldRefs = useRef<Record<number, MathFieldHandle | null>>({});

  const parentValues = useMemo(
    () => (answer && typeof answer === "object" ? (answer as Record<string, string>) : {}),
    [answer],
  );
  const [values, setValues] = useState<Record<string, string>>(parentValues);
  /**
   * The LaTeX each field currently holds — kept as state rather than rebuilt from
   * `formulas` on every render.
   *
   * MathLive re-serialises what it is given: `} = \placeholder` comes back as
   * `}=\placeholder`. Handing back a freshly rebuilt string would therefore never
   * equal what the field just emitted, so `MathField` would reload the formula
   * after every keystroke and throw the caret away. Echoing the field's own text
   * back to it keeps the two in step.
   */
  const buildFieldLatex = (source: string[], answers: Record<string, string>) =>
    source.map((latex) => writeMathPlaceholderValues(latex, answers));
  const [fieldLatex, setFieldLatex] = useState<string[]>(() =>
    buildFieldLatex(formulaList, parentValues),
  );
  /**
   * Chỉ dựng lại khi cha đẩy xuống một bài làm KHÁC VỀ NỘI DUNG, hoặc công thức đổi.
   *
   * So bằng định danh thì hỏng: host lưu nguyên đối tượng ta phát ra rồi trả lại
   * làm prop, nên định danh lần nào cũng khác và nhánh này bắn sau MỖI phím gõ —
   * `setFieldLatex` đè chuỗi MathLive vừa phát ra bằng chuỗi dựng lại từ công thức
   * gốc, đúng thứ mà ghi chú ở `fieldLatex` nói là không được xảy ra.
   *
   * So bằng nội dung cũng chưa đủ: chính lần gõ đầu cũng làm nội dung đổi. Nên
   * `readField` ĐÁNH DẤU khoá nó vừa phát; tiếng vọng mang đúng khoá đó thì bỏ qua,
   * còn bài làm cha đẩy xuống thật sự khác thì vẫn dựng lại.
   */
  const answerKey = stableAnswerKey(parentValues);
  const [synced, setSynced] = useState({ formulaKey, answerKey });
  if (synced.formulaKey !== formulaKey || synced.answerKey !== answerKey) {
    setSynced({ formulaKey, answerKey });
    setValues(parentValues);
    setFieldLatex(buildFieldLatex(formulaList, parentValues));
  }
  /**
   * Bản mới nhất của bài làm, đọc được ngay trong trình xử lý sự kiện.
   *
   * `onBlur` chấm bài, và blur có thể tới trước khi React kịp flush state của
   * phím vừa gõ — đọc state ở đó sẽ chấm theo giá trị cũ. Nên đường gõ phím ghi
   * thẳng vào ref (xem `readField`); effect dưới đây chỉ lo đường CHA đẩy bài làm
   * xuống, vốn không bao giờ đi liền ngay trước một cú blur.
   */
  const valuesRef = useRef(values);
  useEffect(() => {
    // Chỉ đường CHA đẩy bài làm xuống; khoá theo NỘI DUNG nên tiếng vọng của chính
    // ta không làm effect chạy lại và đè mất giá trị `readField` vừa ghi đồng bộ.
    valuesRef.current = parentValues;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerKey]);

  const { status, setStatus, report, mode } = useGrading({
    onAnswerChange,
    onComplete,
    onStatusChange,
  });
  const gradableIds = useMemo(
    () => blankIds.filter((id) => (blankById.get(id)?.correctAnswer?.length ?? 0) > 0),
    [blankIds, blankById],
  );
  const recordOnly = selfAssessment === true || gradableIds.length === 0;

  const instant = useInstantGrading({
    elementIds: gradableIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => valuesRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  // `useInstantGrading` trả về object literal mới mỗi render; lấy ra từng thành
  // viên (đều là useCallback) để các memo bên dưới thật sự memo hoá.
  const { grade: instantGrade, clear: instantClear, reveal: instantReveal } = instant;
  const locked = submitted || (!instant.active && status === "success");

  const gradeBlank = useCallback(
    (id: string, value: string) => {
      const blank = blankById.get(id);
      if (!blank) return undefined;
      return gradeMathClozeBlank(blank, value, gradingMode, tolerance);
    },
    [blankById, gradingMode, tolerance],
  );

  /**
   * MathLive hands back the whole formula with each prompt's content inlined, so
   * the pupil's answers are read out of the LaTeX rather than queried prompt by
   * prompt. That keeps every rule in this file a pure string operation.
   */
  const readField = useCallback(
    (index: number, latex: string) => {
      setFieldLatex((current) => {
        const next = [...current];
        next[index] = latex;
        return next;
      });
      const next = { ...valuesRef.current, ...readMathPlaceholderValues(latex) };
      // Đồng bộ, không đợi effect: `gradeAllFilled` đọc ref này ngay ở blur.
      valuesRef.current = next;
      setValues(next);
      // Nhận là của mình, để tiếng vọng từ cha không kích hoạt dựng lại công thức.
      setSynced({ formulaKey, answerKey: stableAnswerKey(next) });
      if (status === "error") {
        setStatus("idle");
        onStatusChange?.("idle");
      }
      onAnswerChange?.(next);
    },
    [formulaKey, onAnswerChange, onStatusChange, setStatus, status],
  );

  const gradeAllFilled = useCallback(() => {
    if (locked || recordOnly) return;
    for (const id of gradableIds) {
      const value = (valuesRef.current[id] ?? "").trim();
      if (!value) {
        instantClear(id);
        continue;
      }
      const verdict = gradeBlank(id, value);
      if (verdict) instantGrade(id, verdict);
    }
  }, [gradableIds, gradeBlank, instantClear, instantGrade, locked, recordOnly]);

  const check = () => {
    if (locked) return;
    const current = valuesRef.current;
    const filled = gradableIds.filter((id) => (current[id] ?? "").trim() !== "");
    if (recordOnly || filled.length < gradableIds.length) {
      report(current, "incomplete");
      return;
    }
    const allCorrect = gradableIds.every((id) => gradeBlank(id, current[id] ?? "") === "correct");
    report(current, allCorrect ? "correct" : "incorrect");
  };

  const verdicts = useMemo(() => {
    const map: Record<string, BlankVerdict> = {};
    for (const id of blankIds) {
      const revealed = instantReveal(id);
      if (revealed) {
        map[id] = revealed === "correct" ? "correct" : "incorrect";
        continue;
      }
      if (submitted || status === "success" || status === "error") {
        const value = (values[id] ?? "").trim();
        map[id] = value ? gradeBlank(id, value) : undefined;
      }
    }
    return map;
  }, [blankIds, gradeBlank, instantReveal, status, submitted, values]);

  /**
   * Chỉ MathLive mới tô được BÊN TRONG công thức, nên đúng/sai từng ô đi qua
   * phần tử chứ không qua viền của khung bọc.
   *
   * Chỉ ghi khi trạng thái ĐANG hiển thị khác với verdict: `verdicts` được tính
   * lại nhiều lần, và ghi liên tục vào một phần tử đang giữ con trỏ là chỗ dễ sinh
   * lỗi khó tái hiện.
   *
   * So với phần tử chứ KHÔNG nhớ "lần trước đã ghi gì": MathLive tự xoá trạng thái
   * mọi ô mỗi khi dựng lại công thức, nên một bộ nhớ cục bộ sẽ tưởng đã ghi rồi và
   * bỏ qua, làm mất dấu xanh của ô vừa đúng.
   */
  useEffect(() => {
    formulaList.forEach((latex, index) => {
      const field = fieldRefs.current[index];
      if (!field) return;
      for (const id of mathPlaceholderIds(latex)) {
        const verdict = verdicts[id];
        const shouldLock = locked || verdict === "correct";
        if (!shouldApplyPromptState(field.getPromptState(id), verdict, shouldLock)) continue;
        field.setPromptState(id, verdict, shouldLock);
      }
    });
  }, [formulaList, verdicts, locked]);

  const answerReveal = recordOnly
    ? undefined
    : gradableIds
        .map((id) => blankById.get(id)?.correctAnswer?.[0] ?? "")
        .filter(Boolean)
        .join(" · ");

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      <MathFieldChromeStyles />
      <div className="flex flex-col gap-2">
        {formulaList.map((latex, index) => (
          <MathField
            key={`${index}-${latex}`}
            ref={(handle) => {
              fieldRefs.current[index] = handle;
            }}
            value={fieldLatex[index] ?? latex}
            onChange={(next) => readField(index, next)}
            onBlur={gradeAllFilled}
            readOnly
            ariaLabel={`Điền vào biểu thức ${index + 1}`}
            // Cố ý KHÔNG dùng `skin.input`: biểu thức ở đây bị khoá, chỉ các ô
            // trống mới nhận chữ. Khoác khung ô nhập lên cả biểu thức làm câu
            // điền khuyết trông y như câu tự luận — đúng chỗ đã bị phản ánh.
            className={MATH_FIELD_AS_CONTENT}
          />
        ))}
      </div>

      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
        <button
          type="button"
          onClick={check}
          className={
            skin.actionButton?.(true, "secondary")
              ? `mt-6 ${skin.actionButton(true, "secondary")}`
              : "mt-6 rounded-full border-4 border-violet-500 bg-violet-400 px-6 py-3 text-base font-black text-white shadow-sm transition-colors hover:bg-violet-500 sm:text-lg"
          }
        >
          Kiểm tra
        </button>
      )}
    </PlayerShell>
  );
};
