/**
 * Dictation player — listen and type (auto scoring on demand).
 * type: dictation
 *
 * Student plays the audio, types what they heard, then presses "Kiểm tra".
 * Normalised comparison against the accepted transcript(s).
 */
import React, { useMemo, useState, useRef } from "react";
import { Play, Pause, CheckCircle2, XCircle } from "lucide-react";
import { PlayerShell, useGrading, useInlineFeedbackShown, useInstantGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface DictationPlayerProps extends PlayerProps {
  audioUrl?: string;
  /** Primary accepted answer. */
  acceptedTranscript: string;
  /** Additional accepted variants. */
  acceptedAnswers?: string[];
  /** When true, comparison preserves letter case (default: case-insensitive). */
  caseSensitive?: boolean;
}

const normalize = (s: string, caseSensitive = false) => {
  const trimmed = s.trim().replace(/\s+/g, " ");
  return caseSensitive ? trimmed : trimmed.toLowerCase();
};

export const DictationPlayer: React.FC<DictationPlayerProps> = ({
  audioUrl,
  acceptedTranscript,
  acceptedAnswers,
  caseSensitive = false,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  answer,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  ...shell
}) => {
  const skin = useSkin();
  const inlineFeedbackShown = useInlineFeedbackShown();
  const { status, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  // Kênh khôi phục cha cấp (`answer`) — YesNo selectionKey pattern: chỉ reset
  // draft khi cha đưa đáp án khác ngữ nghĩa (không reset khi echo). Không remount.
  const initialValue = typeof answer === "string" ? answer : "";
  const answerKey = JSON.stringify(typeof answer === "string" ? answer : null);
  const [value, setValue] = useState(initialValue);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    if (JSON.stringify(value) !== answerKey) setValue(initialValue);
  }
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Key = transcript chính hoặc các biến thể chấp nhận — thiếu cả hai thì record-only.
  const hasKey = Boolean(acceptedTranscript) || (acceptedAnswers?.length ?? 0) > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  const gradeValue = (v: string) => {
    const accepted = [acceptedTranscript, ...(acceptedAnswers ?? [])]
      .filter(Boolean)
      .map((a) => normalize(a, caseSensitive));
    return accepted.includes(normalize(v, caseSensitive));
  };
  const instant = useInstantGrading({
    elementIds: useMemo(() => ["answer"], []),
    instantFeedback,
    recordOnly,
    buildAnswer: () => value,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  const answerReveal =
    selfAssessment === true
      ? undefined
      : acceptedTranscript || (acceptedAnswers?.length ? acceptedAnswers.join(" / ") : undefined);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleChange = (v: string) => {
    setValue(v);
    onAnswerChange?.(v);
  };

  const check = () => {
    if (locked) return;
    if (recordOnly) {
      // Record-only (selfAssessment hoặc không có transcript): chỉ ghi nhận — không chấm.
      report(value, "incomplete");
      return;
    }
    report(value, gradeValue(value) ? "correct" : "incorrect");
  };

  const gradeOne = () => {
    const v = value.trim();
    if (!v) {
      instant.clear("answer");
      return;
    }
    instant.grade("answer", gradeValue(v) ? "correct" : "incorrect");
  };

  const rv = instant.reveal("answer");
  // Once instant grading is active, a cleared field must go back to idle even
  // though local `status` still holds the previous verdict.
  // Blank while instant-active → idle (aligns with FillBlank blankState; not stale red/green).
  const clearedWhileActive = instant.active && rv === undefined && value.trim() === "";
  const showCorrect =
    !clearedWhileActive && (rv ? rv === "correct" : status === "success" || (submitted && status !== "error"));
  const showWrong = !clearedWhileActive && (rv ? rv === "incorrect" : status === "error");
  const isSuccess = rv ? rv === "correct" : status === "success";

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      {/* hàng audio là khung media, không phải card nội dung — panel("media") */}
      {audioUrl && (
        <div className={`p-4 sm:p-6 shadow-lg flex items-center gap-4 mb-4 ${skin.panel?.("media") ?? "bg-white/60 rounded-3xl border-4 border-white"}`}>
          <button
            type="button"
            onClick={togglePlay}
            className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${skin.iconButton?.("primary") ?? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg"}`}
          >
            {playing ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <div className="flex-1">
            <p className={`text-sm ${skin.emphasis?.("neutral", "strong") ?? "font-black text-slate-800"}`}>{playing ? "Đang phát..." : "Nhấn để nghe"}</p>
            <p className="text-slate-500 text-xs">Nghe và viết lại nội dung</p>
          </div>
          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
        </div>
      )}

      <div
        className={`p-4 sm:p-6 shadow-lg transition-colors ${
          // vỏ textarea là well nhập liệu lõm — panel("inset", state)
          skin.panel?.("inset", showWrong ? "wrong" : showCorrect && isSuccess ? "correct" : "idle") ??
          `bg-white/60 rounded-3xl border-4 ${showWrong ? "border-red-300 " : showCorrect && isSuccess ? "border-green-300 " : "border-white"}`
        }`}
      >
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={gradeOne}
          disabled={locked}
          placeholder="Nghe và viết lại nội dung..."
          className={
            skin.input?.(showWrong ? "wrong" : showCorrect && isSuccess ? "correct" : "idle")
              ? `w-full resize-none h-32 sm:h-40 ${skin.input(showWrong ? "wrong" : showCorrect && isSuccess ? "correct" : "idle")}`
              : "w-full p-4 md:p-6 rounded-2xl bg-slate-100 border-4 border-slate-200 focus:border-amber-300  focus:bg-white outline-none transition-all resize-none h-32 sm:h-40 text-base sm:text-lg font-bold text-slate-800 placeholder:text-slate-500 disabled:opacity-70"
          }
        />

        <div className="flex items-center gap-3 mt-4">
          {mode !== "parent" && !instant.active && !recordOnly && (
            <button
              type="button"
              onClick={check}
              disabled={locked || value.trim().length === 0}
              className={
                skin.actionButton?.(!locked && value.trim().length > 0, "primary") ??
                "px-6 py-3 rounded-full border-4 border-amber-400 bg-amber-400 text-white font-black text-base shadow-md transition-all hover:bg-amber-500 disabled:opacity-40"
              }
            >
              Kiểm tra
            </button>
          )}
          {/* Dòng verdict tự-hiển-thị: ẩn ở surface học sinh (Owner 4/8) —
              viền textarea + viền well đã tô xanh/đỏ, và useGrading vẫn kêu. */}
          {inlineFeedbackShown && isSuccess && !clearedWhileActive && (
            <span
              className={
                skin.feedback?.("success") ?? "flex items-center gap-1.5 text-green-600 font-black"
              }
            >
              <CheckCircle2 size={22} /> Chính xác!
            </span>
          )}
          {inlineFeedbackShown && showWrong && (
            <span
              className={
                skin.feedback?.("error") ?? "flex items-center gap-1.5 text-red-500 font-black"
              }
            >
              <XCircle size={22} /> Chưa đúng, thử lại nhé!
            </span>
          )}
        </div>
      </div>
    </PlayerShell>
  );
};
