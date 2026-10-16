/**
 * P11 — Point marking / "pin".
 * schema: point_marking · interactionType: "pin"
 *
 * Student clicks anywhere on the image to drop a single 📍 pin. The pin can be
 * re-placed freely until submitted. A "Kiểm tra" button reports {x,y} and grades:
 * distance from pin to target ≤ tolerance ⇒ correct. The target zone (faint
 * circle) is only revealed after submitting.
 */
import React, { useState } from "react";
import { motion } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface PlacePinPlayerProps extends PlayerProps {
  imageUrl: string;
  imageAlt?: string;
  target: { x: number; y: number }; // 0..1
  tolerance?: number; // 0..1, default 0.08
}

/** Parse a parent-supplied answer into a pin, or null when malformed. */
function parsePin(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== "object") return null;
  const { x, y } = value as { x?: unknown; y?: unknown };
  return typeof x === "number" && typeof y === "number" ? { x, y } : null;
}

export const PlacePinPlayer: React.FC<PlacePinPlayerProps> = ({
  imageUrl,
  imageAlt,
  target,
  tolerance = 0.08,
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
  const initialPin = parsePin(answer);
  const answerKey = JSON.stringify(initialPin);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(initialPin);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    if (JSON.stringify(pin ? { x: pin.x, y: pin.y } : null) !== answerKey) setPin(initialPin);
  }
  const { status, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const locked = submitted || status === "success";
  // The target zone is the answer key; missing zone data ⇒ no key ⇒ record-only.
  const hasKey = typeof target?.x === "number" && typeof target?.y === "number";
  const recordOnly = selfAssessment === true || !hasKey;
  // Không lộ vùng đúng sau lượt sai (status "error") — học sinh còn được thử lại.
  const revealZone = !recordOnly && (submitted || status === "success");

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (locked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPin({ x, y });
    onAnswerChange?.({ x, y });
    if (status === "error") onStatusChange?.("idle");
  };

  const check = () => {
    if (locked || !pin) return;
    if (recordOnly) {
      report(pin, "incomplete");
      return;
    }
    const dist = Math.sqrt((pin.x - target.x) ** 2 + (pin.y - target.y) ** 2);
    report(pin, dist <= tolerance ? "correct" : "incorrect");
  };

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div className={`overflow-hidden ${skin.panel?.("media") ?? "bg-white/60 rounded-3xl border-4 border-white shadow-lg"}`}>
        <div
          className={`relative select-none ${locked ? "cursor-default" : "cursor-crosshair"}`}
          onClick={handleClick}
        >
          <img
            src={imageUrl}
            alt={imageAlt || "Hình minh họa bài tập"}
            className="w-full"
            draggable={false}
          />

          {/* Target zone — only after grading */}
          {revealZone && (
            <div
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-dashed pointer-events-none ${skin.marker?.("correct") ?? "border-4 border-green-400/70 bg-green-200/25"}`}
              style={{
                left: `${target.x * 100}%`,
                top: `${target.y * 100}%`,
                width: `${tolerance * 2 * 100}%`,
                aspectRatio: "1 / 1",
              }}
            />
          )}

          {/* The dropped pin */}
          {pin && (
            <motion.div
              key={`${pin.x.toFixed(4)}-${pin.y.toFixed(4)}`}
              initial={{ scale: 0, y: -8 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="absolute -translate-x-1/2 pointer-events-none text-3xl md:text-4xl drop-shadow-md"
              style={{
                left: `${pin.x * 100}%`,
                top: `${pin.y * 100}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              📍
            </motion.div>
          )}
        </div>
      </div>

      {mode !== "parent" && !locked && !recordOnly && (
        <div className="mt-5 flex justify-center">
          <motion.button
            type="button"
            whileHover={pin ? { scale: 1.05 } : undefined}
            whileTap={pin ? { scale: 0.94 } : undefined}
            onClick={check}
            disabled={!pin}
            className={
              skin.actionButton?.(!!pin, "primary") ??
              `px-8 py-3 rounded-full border-4 font-black text-lg transition-all ${
                pin
                  ? "bg-fuchsia-400 border-fuchsia-500 text-white shadow-md hover:bg-fuchsia-500"
                  : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
              }`
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}

      {!locked && pin && (
        <p className={`mt-3 text-center text-sm italic ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
          Bấm lại trên hình để đổi vị trí ghim nhé!
        </p>
      )}

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-center text-green-600 font-black text-lg md:text-xl">
          Đúng vị trí rồi! 🎯
        </PlayerInlineFeedback>
      )}
      {status === "error" && !submitted && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-center text-red-500 font-black text-lg md:text-xl">
          Gần đúng rồi, thử lại nhé! 🤔
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
