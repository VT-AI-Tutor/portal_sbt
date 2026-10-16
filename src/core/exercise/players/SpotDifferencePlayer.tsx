/**
 * Spot the difference / "spot_difference".
 * schema: spot_difference
 *
 * Two images shown side by side. The differences are defined as normalized
 * (0..1) coordinates on image B. Clicking near a difference on image B marks it
 * found (distance ≤ its radius, default 0.06). Win when all are found →
 * report(foundIds, "correct").
 *
 * Emitted answer: found difference ids (string[]).
 */
import React, { useRef, useState } from "react";
import { motion } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, useGrading, type PlayerProps } from "./shared";
import { restoredStringArray, useRestoredAnswerState } from "./answer-restore";
import { useSkin } from "@/core/exercise/skin";
import { useFieldResize } from "@/core/exercise/field-resize-context";
import { HotspotEditOverlay } from "./HotspotEditOverlay";

export interface SpotDifference {
  id: string;
  x: number; // 0..1, on image B
  y: number; // 0..1, on image B
  radius?: number; // 0..1, default 0.06
}

export interface SpotDifferencePlayerProps extends PlayerProps {
  imageA: string;
  imageB: string;
  differences: SpotDifference[];
}

export const SpotDifferencePlayer: React.FC<SpotDifferencePlayerProps> = ({
  imageA,
  imageB,
  differences,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  // Studio edit preview only — null everywhere else. Differences live on image
  // B, so the edit overlay (dashed draggable circles) anchors to image B's
  // container only; the play click is suppressed while editing geometry.
  const editing = useFieldResize()?.onGeometry != null;
  const imageBContainerRef = useRef<HTMLDivElement | null>(null);
  // Kênh khôi phục: đáp án đã lưu (mảng id điểm khác biệt đã tìm thấy).
  const [found, setFound] = useRestoredAnswerState<string[]>(restoredStringArray(answer));
  const [miss, setMiss] = useState<{ x: number; y: number; key: number } | null>(null);
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const locked = submitted || status === "success";
  const recordOnly = selfAssessment === true || differences.length === 0;
  const reveal = !recordOnly ? `${differences.length} điểm khác biệt` : null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (locked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;

    let best: SpotDifference | null = null;
    let bestDist = Infinity;
    for (const d of differences) {
      if (found.includes(d.id)) continue;
      const dist = Math.sqrt((rx - d.x) ** 2 + (ry - d.y) ** 2);
      const hitRadius = d.radius ?? 0.06;
      if (dist <= hitRadius && dist < bestDist) {
        best = d;
        bestDist = dist;
      }
    }

    if (!best) {
      setMiss({ x: rx, y: ry, key: Date.now() });
      return;
    }

    setMiss(null);
    const next = [...found, best.id];
    setFound(next);
    if (next.length === differences.length) {
      // Record-only (selfAssessment): finding all still ends the hunt, but only
      // syncs the answer — no verdict, no success sound.
      report(next, recordOnly ? "incomplete" : "correct");
    } else {
      onAnswerChange?.(next);
    }
  };

  const markers = (interactive: boolean) => (
    <>
      {differences.map((d) => {
        if (!found.includes(d.id)) return null;
        return (
          <motion.div
            key={d.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
          >
            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full ${skin.marker?.("correct") ?? "border-4 border-green-500 bg-green-300/40"}`} />
          </motion.div>
        );
      })}
      {interactive && miss && (
        <motion.div
          key={miss.key}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${miss.x * 100}%`, top: `${miss.y * 100}%` }}
        >
          <div className={`w-8 h-8 rounded-full ${skin.marker?.("wrong") ?? "border-4 border-red-400 bg-red-300/40"}`} />
        </motion.div>
      )}
    </>
  );

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <p className={`text-center mb-4 text-lg ${skin.emphasis?.("primary", "strong") ?? "text-amber-600 font-black"}`}>
        Đã tìm: {found.length} / {differences.length}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center items-start">
        {/* Image A — reference, not clickable. */}
        <div className={`overflow-hidden flex-1 max-w-md ${skin.panel?.("media") ?? "bg-white/60 rounded-3xl border-4 border-white shadow-lg"}`}>
          <div className="relative select-none">
            <img src={imageA} alt="Hình A" className="w-full" draggable={false} />
            {markers(false)}
          </div>
        </div>

        {/* Image B — clickable. */}
        <div className={`overflow-hidden flex-1 max-w-md ${skin.panel?.("media") ?? "bg-white/60 rounded-3xl border-4 border-white shadow-lg"}`}>
          <div
            ref={imageBContainerRef}
            className={`relative select-none ${locked || editing ? "cursor-default" : "cursor-crosshair"}`}
            onClick={editing ? undefined : handleClick}
          >
            <img src={imageB} alt="Hình B" className="w-full" draggable={false} />
            {markers(true)}
            {editing && (
              <HotspotEditOverlay
                shapes={differences}
                containerRef={imageBContainerRef}
                defaultRadius={0.06}
              />
            )}
          </div>
        </div>
      </div>

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="text-center mt-4 text-green-600 font-black text-lg">
          Tuyệt vời! Tìm được hết điểm khác nhau rồi! 🎉
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
