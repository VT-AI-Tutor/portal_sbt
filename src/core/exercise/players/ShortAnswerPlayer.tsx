/**
 * P15 — Short answer (one line / short text).
 * schema: fill_blank · interactionType: "short_text"
 */
import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  PlayerShell,
  PlayerErrorFeedback,
  useGrading,
  useHydratedRecordAnswer,
  useInstantGrading,
  type PlayerProps,
  type Verdict,
} from "./shared";
import { useSkin } from "@/core/exercise/skin";
import { HideResultBanner, RecordedReceipt } from "./recorded-receipt";

/** One labeled answer box for the multi-blank short_text variant (#509). */
export interface ShortAnswerBlank {
  id: string;
  label?: string;
  acceptedAnswers?: string[];
}

export interface ShortAnswerPlayerProps extends PlayerProps {
  acceptedAnswers?: string[];
  keywords?: string[];
  minChars?: number;
  /**
   * fill_blank + short_text with declared `blanks[]` (#509). When present, each
   * blank renders its own labeled answer box (in payload order) and the reported
   * answer is a `Record<blankId, string>` — mirroring the default fill_blank
   * (text) contract. Absent → the classic single-textarea short answer.
   */
  blanks?: ShortAnswerBlank[];
}

/** Trim + case-insensitive equals/contains against a blank's accepted answers. */
function matchAccepted(value: string, accepted: string[] | undefined): boolean {
  if (!accepted || accepted.length === 0) return false;
  const v = value.trim().toLowerCase();
  return accepted.some((a) => {
    const t = a.trim().toLowerCase();
    return v === t || v.includes(t);
  });
}

/** Map an input state to the shared textarea styling (skin-aware). */
function useAnswerTextareaClass() {
  const skin = useSkin();
  return (inputState: "idle" | "correct" | "wrong") =>
    skin.input?.(inputState)
      ? `w-full resize-none ${skin.input(inputState)}`
      : `w-full resize-none px-4 py-3 rounded-2xl border-4 font-bold text-lg outline-none transition-all
        ${
          inputState === "wrong"
            ? "bg-red-50  border-red-400 text-red-600"
            : inputState === "correct"
              ? "bg-green-50  border-green-400 text-green-700 "
              : "bg-white border-sky-300  text-slate-800 focus:border-sky-500"
        }`;
}

/** Multi-blank variant (#509): one labeled box per blank, answer keyed by blank.id. */
const MultiBlankShortAnswer: React.FC<ShortAnswerPlayerProps & { blanks: ShortAnswerBlank[] }> = ({
  blanks,
  minChars = 1,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  answer,
  // `acceptedAnswers` / `keywords` are single-answer-only; they harmlessly flow
  // into `...shell` (PlayerShell ignores unknown props) and are unused here.
  ...shell
}) => {
  const skin = useSkin();
  const textareaClass = useAnswerTextareaClass();
  const [values, setValues] = useHydratedRecordAnswer(answer);
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const hasKey = blanks.some((b) => (b.acceptedAnswers?.length ?? 0) > 0);
  const recordOnly = selfAssessment === true || !hasKey;
  const elementIds = useMemo(() => blanks.map((b) => b.id), [blanks]);
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => ({ ...values }),
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  // web-own (SBT-61): câu không key có nút "Nộp câu trả lời" → "Hệ thống đã ghi nhận".
  const [confirmed, setConfirmed] = useState(false);

  const answerReveal =
    selfAssessment === true
      ? undefined
      : hasKey
        ? blanks
            .map((b, i) => {
              const prompt = b.label?.trim() || `Số ${i + 1}`;
              return `${prompt} ${(b.acceptedAnswers ?? []).join(" / ")}`.trim();
            })
            .join("\n")
        : undefined;

  const setOne = (id: string, v: string) => {
    if (locked) return;
    // Sửa lại sau khi bị chấm sai → xoá trạng thái sai để thử lại.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    setConfirmed(false);
    setValues((prev) => ({ ...prev, [id]: v }));
  };

  const gradeOne = (b: ShortAnswerBlank) => {
    if (recordOnly) {
      // Record-only: đồng bộ đáp án lên cha — không chấm, không âm thanh.
      report({ ...values }, "incomplete");
      return;
    }
    if (mode === "parent" && !instant.active) {
      // Parent-graded + không instant: nút "Kiểm tra" bị ẩn, nên blur là kênh
      // duy nhất đẩy đáp án lên cha (report ở parent mode chỉ emit, không chấm).
      report({ ...values }, "incomplete");
      return;
    }
    const v = (values[b.id] ?? "").trim();
    if (v === "" || v.length < minChars) {
      instant.clear(b.id);
      return;
    }
    instant.grade(b.id, matchAccepted(v, b.acceptedAnswers) ? "correct" : "incorrect");
  };

  const check = () => {
    if (locked) return;
    const current = { ...values };
    if (recordOnly) {
      report(current, "incomplete");
      return;
    }
    const allFilled = blanks.every((b) => (values[b.id] ?? "").trim().length >= minChars);
    if (!allFilled) {
      report(current, "incomplete");
      return;
    }
    const allCorrect = blanks.every((b) => matchAccepted(values[b.id] ?? "", b.acceptedAnswers));
    report(current, allCorrect ? "correct" : "incorrect");
  };

  const blankInputState = (b: ShortAnswerBlank): "idle" | "correct" | "wrong" => {
    const rv = instant.reveal(b.id);
    if (rv) return rv === "correct" ? "correct" : "wrong";
    if (!submitted && status === "error") {
      // "Kiểm tra" vừa chấm sai — chỉ tô đỏ ô SAI; ô đúng giữ idle để không lộ đáp án.
      const v = values[b.id] ?? "";
      if (v.trim() === "" || !(b.acceptedAnswers?.length)) return "idle";
      return matchAccepted(v, b.acceptedAnswers) ? "idle" : "wrong";
    }
    return "idle";
  };

  const anyFilled = blanks.some((b) => (values[b.id] ?? "").trim() !== "");

  return (
    <HideResultBanner active={recordOnly}>
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      <div className="space-y-4">
        {blanks.map((b, i) => {
          const fieldId = `short-answer-${b.id}`;
          return (
            <div key={b.id} className="space-y-1.5">
              {b.label?.trim() && (
                <label htmlFor={fieldId} className="block font-bold text-slate-800">
                  {b.label}
                </label>
              )}
              <textarea
                id={fieldId}
                rows={2}
                value={values[b.id] ?? ""}
                onChange={(e) => setOne(b.id, e.target.value)}
                onBlur={() => gradeOne(b)}
                disabled={locked}
                aria-label={b.label?.trim() || `Câu trả lời ${i + 1}`}
                placeholder="Viết câu trả lời ngắn của em..."
                className={textareaClass(blankInputState(b))}
              />
            </div>
          );
        })}
      </div>

      {recordOnly && (
        <RecordedReceipt
          locked={locked}
          hasAnswer={anyFilled}
          confirmed={confirmed}
          onSubmit={() => {
            if (!anyFilled) return;
            report({ ...values }, "incomplete");
            setConfirmed(true);
          }}
        />
      )}

      <PlayerErrorFeedback show={status === "error" && !submitted} />

      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={check}
          className={
            skin.actionButton?.(true, "primary")
              ? `mt-6 ${skin.actionButton(true, "primary")}`
              : "mt-6 px-6 py-3 rounded-full border-4 border-sky-500 bg-sky-400 text-white font-black text-base sm:text-lg shadow-sm hover:bg-sky-500 transition-colors"
          }
        >
          Kiểm tra
        </motion.button>
      )}
    </PlayerShell>
    </HideResultBanner>
  );
};

/** Classic single-textarea short answer (unchanged behaviour). */
const SingleShortAnswer: React.FC<ShortAnswerPlayerProps> = ({
  acceptedAnswers,
  keywords,
  minChars = 1,
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  // `blanks` is handled by the switch below (never reaches here with entries); it
  // harmlessly flows into `...shell`, which PlayerShell ignores.
  ...shell
}) => {
  const skin = useSkin();
  const textareaClass = useAnswerTextareaClass();
  // Hydrated from the parent-owned `answer` (restore channel, emit shape: string).
  const [text, setText] = useState(() => (typeof answer === "string" ? answer : ""));
  // Resync only when the parent supplies a semantically DIFFERENT answer
  // (YesNoPlayer's selectionKey pattern) — our own onAnswerChange echoes come
  // back equal to `text` and must not clobber in-progress typing.
  const parentText = typeof answer === "string" ? answer : "";
  const [syncedText, setSyncedText] = useState(parentText);
  if (syncedText !== parentText) {
    setSyncedText(parentText);
    if (text !== parentText) setText(parentText);
  }
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || (!(acceptedAnswers?.length) && !(keywords?.length));
  const instant = useInstantGrading({
    elementIds: useMemo(() => ["answer"], []),
    instantFeedback,
    recordOnly,
    buildAnswer: () => text,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  // web-own (SBT-61): câu không key có nút "Nộp câu trả lời" → "Hệ thống đã ghi nhận".
  const [confirmed, setConfirmed] = useState(false);

  const grade = (value: string): Verdict => {
    const v = value.trim().toLowerCase();
    if (acceptedAnswers && acceptedAnswers.length > 0) {
      const hit = acceptedAnswers.some((a) => {
        const t = a.trim().toLowerCase();
        return v === t || v.includes(t);
      });
      return hit ? "correct" : "incorrect";
    }
    if (keywords && keywords.length > 0) {
      const present = keywords.filter((k) => v.includes(k.trim().toLowerCase()));
      return present.length / keywords.length >= 0.5 ? "correct" : "incorrect";
    }
    return "incomplete";
  };

  const handleChange = (v: string) => {
    setText(v);
    setConfirmed(false);
    // Sửa lại sau khi bị chấm sai → xoá trạng thái sai để thử lại.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
  };

  const check = () => {
    if (locked) return;
    const value = text;
    // Record-only (selfAssessment hoặc không có đáp án): chỉ ghi nhận — không chấm.
    if (recordOnly || value.trim().length < minChars) {
      report(value, "incomplete");
      return;
    }
    report(value, grade(value));
  };

  const gradeOne = () => {
    if (recordOnly) {
      // Record-only: đồng bộ đáp án lên cha qua report — không chấm, không âm thanh.
      report(text, "incomplete");
      return;
    }
    if (mode === "parent" && !instant.active) {
      // Parent-graded + không instant: nút "Kiểm tra" bị ẩn, nên blur là kênh
      // duy nhất đẩy đáp án lên cha (report ở parent mode chỉ emit, không chấm).
      report(text, "incomplete");
      return;
    }
    const v = text.trim();
    if (!v || v.length < minChars) {
      instant.clear("answer");
      return;
    }
    const verdict = grade(v);
    instant.grade("answer", verdict === "correct" ? "correct" : "incorrect");
  };

  const answerReveal =
    selfAssessment === true
      ? undefined
      : acceptedAnswers?.length
        ? acceptedAnswers.join(" / ")
        : keywords?.length
          ? keywords.join(" / ")
          : undefined;

  const rv = instant.reveal("answer");
  // Once instant grading is active, a cleared field must go back to idle even
  // though local `status` still holds the previous verdict.
  const clearedWhileActive = instant.active && rv === undefined && text.trim() === "";
  const inputState = rv
    ? (rv === "correct" ? "correct" : "wrong")
    : clearedWhileActive
      ? "idle"
      : status === "error"
        ? "wrong"
        : status === "success"
          ? "correct"
          : "idle";

  return (
    <HideResultBanner active={recordOnly}>
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      <textarea
        rows={2}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={gradeOne}
        disabled={locked}
        placeholder="Viết câu trả lời ngắn của em..."
        className={textareaClass(inputState)}
      />

      {recordOnly && (
        <RecordedReceipt
          locked={locked}
          hasAnswer={text.trim() !== ""}
          confirmed={confirmed}
          onSubmit={() => {
            if (text.trim() === "") return;
            report(text, "incomplete");
            setConfirmed(true);
          }}
        />
      )}

      <PlayerErrorFeedback show={status === "error" && !submitted} />

      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={check}
          className={
            skin.actionButton?.(true, "primary")
              ? `mt-6 ${skin.actionButton(true, "primary")}`
              : "mt-6 px-6 py-3 rounded-full border-4 border-sky-500 bg-sky-400 text-white font-black text-base sm:text-lg shadow-sm hover:bg-sky-500 transition-colors"
          }
        >
          Kiểm tra
        </motion.button>
      )}
    </PlayerShell>
    </HideResultBanner>
  );
};

export const ShortAnswerPlayer: React.FC<ShortAnswerPlayerProps> = (props) => {
  // Multi-blank labeled short_text (#509) vs the classic single textarea. The
  // dispatch only supplies `blanks` when the payload declares labeled / multiple
  // blanks, so single short_text without `blanks[]` is untouched.
  if (props.blanks && props.blanks.length > 0) {
    return <MultiBlankShortAnswer {...props} blanks={props.blanks} />;
  }
  return <SingleShortAnswer {...props} />;
};
