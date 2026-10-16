/**
 * Hangman / "hangman".
 * schema: hangman
 *
 * Show the answer as blanks (spaces preserved), a letter keyboard (A–Z plus
 * Vietnamese vowels), and a wrong-guess counter / simple hangman figure.
 * Correct guesses reveal matching letters. Win when the word is fully revealed
 * → report(answer, "correct"); lose when wrong guesses exceed maxWrong →
 * report(revealed, "incorrect").
 *
 * Emitted answer: the guessed / revealed string (with "_" for hidden letters).
 */
import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface HangmanPlayerProps extends PlayerProps {
  /**
   * Từ cần đoán. Đổi tên từ `answer` → `word` vì `PlayerProps.answer` là kênh
   * khôi phục do cha cấp — hai nghĩa đè nhau làm mất restore (Bước A).
   */
  word: string;
  maxWrong?: number;
  hint?: string;
}

const BASE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const VN_LETTERS = "ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ".split("");

/** Letters in the answer that need to be guessed (ignore spaces/punctuation). */
function isLetter(ch: string): boolean {
  return ch.trim().length > 0 && /[\p{L}]/u.test(ch);
}

/** Chữ đã lộ trong chuỗi revealed đã lưu ("_" = còn ẩn) → tập guessed. */
function guessedFromRevealed(value: unknown): Set<string> | null {
  if (typeof value !== "string" || !value) return null;
  const s = new Set<string>();
  for (const ch of value.toUpperCase()) if (ch !== "_" && isLetter(ch)) s.add(ch);
  return s.size > 0 ? s : null;
}

export const HangmanPlayer: React.FC<HangmanPlayerProps> = ({
  word,
  maxWrong = 6,
  hint,
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  ...shell
}) => {
  const skin = useSkin();
  const [guessed, setGuessed] = useState<Set<string>>(
    () => guessedFromRevealed(answer) ?? new Set(),
  );
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || !word;

  const upperAnswer = useMemo(() => word.toUpperCase(), [word]);
  const answerLetters = useMemo(
    () => new Set(upperAnswer.split("").filter(isLetter)),
    [upperAnswer],
  );

  // Hydrate lại khi cha cấp answer KHÁC về ngữ nghĩa (resume làm dở). Echo của
  // chính report() bị bỏ qua bằng cách so chuỗi revealed hiện tại — nếu áp
  // thẳng, mỗi lần đoán sẽ reset các chữ đoán SAI (tim hồi lại). Giới hạn đã
  // biết: chuỗi revealed không chứa chữ sai → restore chỉ hồi chữ đúng.
  const answerKey = typeof answer === "string" ? answer : null;
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    const currentRevealed = upperAnswer
      .split("")
      .map((ch) => (!isLetter(ch) ? ch : guessed.has(ch) ? ch : "_"))
      .join("");
    if (answerKey !== null && answerKey.toUpperCase() !== currentRevealed) {
      const restored = guessedFromRevealed(answerKey);
      if (restored) setGuessed(restored);
    }
  }

  const wrongCount = useMemo(
    () => Array.from(guessed).filter((g) => !answerLetters.has(g)).length,
    [guessed, answerLetters],
  );

  const lost = wrongCount > maxWrong;
  const won = status === "success";
  const locked = submitted || won || lost;
  const reveal = !recordOnly ? upperAnswer : null;

  // Keyboard: only show Vietnamese letters that actually appear in the answer.
  const vnInAnswer = useMemo(
    () => VN_LETTERS.filter((l) => answerLetters.has(l)),
    [answerLetters],
  );
  const keyboard = useMemo(() => [...BASE_LETTERS, ...vnInAnswer], [vnInAnswer]);

  const guess = (letter: string) => {
    if (locked || guessed.has(letter)) return;
    const next = new Set(guessed);
    next.add(letter);
    setGuessed(next);

    const allRevealed = Array.from(answerLetters).every((l) => next.has(l));
    const newWrong = Array.from(next).filter((g) => !answerLetters.has(g)).length;
    const revealed = upperAnswer
      .split("")
      .map((ch) => (!isLetter(ch) ? ch : next.has(ch) ? ch : "_"))
      .join("");

    // Record-only (selfAssessment): guesses only sync the answer — the game
    // mechanics (reveals, hearts) keep running, but no win/lose verdict/sounds.
    if (recordOnly) {
      report(allRevealed ? upperAnswer : revealed, "incomplete");
      return;
    }

    if (allRevealed) {
      report(upperAnswer, "correct");
    } else if (newWrong > maxWrong) {
      report(revealed, "incorrect");
    } else {
      onAnswerChange?.(revealed);
    }
  };

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div className="flex flex-col items-center gap-6">
        {/* Hangman figure as a row of life hearts. */}
        <div className="flex items-center gap-2">
          {Array.from({ length: maxWrong + 1 }).map((_, i) => {
            const alive = i >= wrongCount;
            return (
              <span key={i} className="text-2xl sm:text-3xl">
                {alive ? "❤️" : "🖤"}
              </span>
            );
          })}
        </div>
        <p className={skin.emphasis?.("primary", "medium") ?? "font-bold text-fuchsia-500"}>
          Sai: {wrongCount} / {maxWrong}
        </p>

        {hint && (
          <div className={`px-4 py-2 italic ${skin.emphasis?.("neutral", "medium") ?? "text-slate-800 font-bold"} ${skin.panel?.("inset") ?? "bg-white/70 rounded-2xl border-4 border-white"}`}>
            Gợi ý: {hint}
          </div>
        )}

        {/* Word as blanks. */}
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-3">
          {upperAnswer.split("").map((ch, i) => {
            if (!isLetter(ch)) {
              return (
                <span key={i} className="w-4 sm:w-6" />
              );
            }
            const shown = guessed.has(ch) || lost;
            const blankTone = shown
              ? guessed.has(ch)
                ? (skin.emphasis?.("primary", "strong") ?? "text-fuchsia-600") + " " + (skin.accent?.("primary", "ring") ?? "border-fuchsia-400")
                : (skin.emphasis?.("danger", "strong") ?? "text-red-500") + " " + (skin.accent?.("danger", "ring") ?? "border-red-400")
              : "text-transparent " + (skin.accent?.("neutral", "ring") ?? "border-slate-200");
            return (
              <span
                key={i}
                className={`w-7 h-9 sm:w-9 sm:h-12 flex items-center justify-center text-xl sm:text-3xl border-b-4 ${skin.emphasis?.("neutral", "strong") ?? "font-black"}
                  ${blankTone}`}
              >
                {shown ? ch : "_"}
              </span>
            );
          })}
        </div>

        {/* Keyboard. */}
        <div className="flex flex-wrap justify-center gap-1.5 max-w-2xl">
          {keyboard.map((letter) => {
            const used = guessed.has(letter);
            const hit = used && answerLetters.has(letter);
            return (
              <motion.button
                key={letter}
                type="button"
                whileTap={!locked && !used ? { scale: 0.9 } : undefined}
                disabled={locked || used}
                onClick={() => guess(letter)}
                className={`w-8 h-9 sm:w-10 sm:h-11 text-sm sm:text-lg transition-colors ${skin.emphasis?.("neutral", "strong") ?? "font-black"}
                  ${
                    skin.chip?.(used ? (hit ? "correct" : "wrong") : "idle", "secondary") ??
                    `rounded-lg border-2 ${
                      used
                        ? hit
                          ? "bg-green-300 border-green-500 text-green-900 "
                          : "bg-slate-300 border-slate-400 text-slate-500"
                        : "bg-white border-fuchsia-300  text-fuchsia-600 hover:bg-fuchsia-100 "
                    }`
                  } disabled:cursor-not-allowed`}
              >
                {letter}
              </motion.button>
            );
          })}
        </div>

        <PlayerInlineFeedback
          kind="success"
          show={won}
          fallbackClass="text-green-600 font-black text-xl"
        >
          Tuyệt vời! 🎉
        </PlayerInlineFeedback>
        {/* CỐ Ý KHÔNG gỡ theo hideInlineFeedback: đây là TRẠNG THÁI KẾT THÚC ván
            + lộ đáp án, không phải dòng "chưa đúng" nag giữa bài. Ẩn nó thì học
            sinh chỉ thấy bàn phím tắt ngóm mà không hiểu vì sao. (Owner 4/8) */}
        {lost && (
          <p
            className={
              skin.feedback?.("error") ??
              "text-red-500 font-black text-lg sm:text-xl text-center"
            }
          >
            Hết lượt rồi! Đáp án là: <span className={skin.emphasis?.("primary", "strong") ?? "text-fuchsia-600"}>{upperAnswer}</span>
          </p>
        )}
      </div>
    </PlayerShell>
  );
};
