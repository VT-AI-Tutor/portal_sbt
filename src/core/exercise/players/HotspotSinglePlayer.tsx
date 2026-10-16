/**
 * P09 — Hotspot / "single".
 * schema: hotspot · interactionType: "single"
 *
 * Click on the image; we hit-test hotspots by their declared shape (circle
 * center+radius / rect top-left+size / polygon — see hotspot-hit.ts) and
 * report the hit hotspot id. The marker covers the picked hotspot's whole
 * declared area. One pick → correct/wrong feedback.
 */
import React, { useRef, useState } from "react";
import { motion } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, useGrading, type PlayerProps } from "./shared";
import { findHitHotspot, hotspotMarkerBox, type HotspotShape } from "./hotspot-hit";
import { useSkin } from "@/core/exercise/skin";
import { useFieldResize } from "@/core/exercise/field-resize-context";
import { HotspotEditOverlay } from "./HotspotEditOverlay";

export type SingleHotspot = HotspotShape;

export interface HotspotSinglePlayerProps extends PlayerProps {
  imageUrl: string;
  imageAlt?: string;
  hotspots: SingleHotspot[];
  correctId: string;
}

export const HotspotSinglePlayer: React.FC<HotspotSinglePlayerProps> = ({
  imageUrl,
  imageAlt,
  hotspots,
  correctId,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  // Studio edit preview only — null everywhere else. While geometry editing is
  // active the play click is suppressed (edit mode must not grade) and the
  // invisible hotspots are rendered as draggable dashed outlines.
  const editing = useFieldResize()?.onGeometry != null;
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Kênh khôi phục: emit chỉ là hotspot id — marker vẽ theo hình học của chính
  // hotspot đó nên không cần toạ độ click. Sync-in-render kiểu YesNoPlayer.
  const restoredId = typeof answer === "string" && answer.length > 0 ? answer : null;
  const restoredPick = restoredId && hotspots.some((h) => h.id === restoredId) ? restoredId : null;
  const selectionKey = JSON.stringify(restoredId);
  const [pickedId, setPickedId] = useState<string | null>(restoredPick);
  const [syncedKey, setSyncedKey] = useState(selectionKey);
  if (syncedKey !== selectionKey) {
    setSyncedKey(selectionKey);
    if (JSON.stringify(pickedId) !== selectionKey) setPickedId(restoredPick);
  }
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const locked = submitted || status === "success";
  const hasKey = typeof correctId === "string" && correctId.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  const correctHotspot = hotspots.find((hs) => hs.id === correctId);
  const reveal = !recordOnly
    ? correctHotspot?.label ?? "vùng đúng đã đánh dấu"
    : null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (locked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;

    // Shape-aware hit-test; overlapping hits go to the nearest center.
    const best = findHitHotspot(hotspots, rx, ry);
    if (!best) return; // missed every hotspot — ignore

    setPickedId(best.id);
    // Record-only (selfAssessment / no key): sync the pick, never grade.
    if (recordOnly) report(best.id, "incomplete");
    else report(best.id, best.id === correctId ? "correct" : "incorrect");
  };

  const isCorrect = !recordOnly && pickedId && (submitted || status === "success") && pickedId === correctId;
  const isWrong = !recordOnly && pickedId && status === "error" && pickedId !== correctId;
  const pickedHotspot = hotspots.find((hs) => hs.id === pickedId) ?? null;
  const markerBox = pickedHotspot ? hotspotMarkerBox(pickedHotspot) : null;

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div className={`overflow-hidden ${skin.panel?.("media") ?? "bg-white/60 rounded-3xl border-4 border-white shadow-lg"}`}>
        <div
          ref={containerRef}
          className={`relative select-none ${locked || editing ? "cursor-default" : "cursor-crosshair"}`}
          onClick={editing ? undefined : handleClick}
        >
          <img
            src={imageUrl}
            alt={imageAlt || "Hình minh họa bài tập"}
            className="w-full"
            draggable={false}
          />

          {editing && <HotspotEditOverlay shapes={hotspots} containerRef={containerRef} />}

          {markerBox && (
            <motion.div
              key={pickedId}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="absolute pointer-events-none"
              data-hotspot-marker={pickedId}
              // Anchor via motion's x/y, NOT Tailwind translate classes: the
              // scale animation writes an inline `transform` that would clobber
              // a class-based translate (circle markers offset by half a box).
              style={{
                left: markerBox.left,
                top: markerBox.top,
                width: markerBox.width,
                height: markerBox.height,
                aspectRatio: markerBox.aspectRatio,
                x: markerBox.x,
                y: markerBox.y,
              }}
            >
              <div
                className={`w-full h-full ${
                  skin.marker?.(isCorrect ? "correct" : isWrong ? "wrong" : "idle") ??
                  `border-4 ${
                    isCorrect
                      ? "border-green-500 bg-green-300/50"
                      : isWrong
                        ? "border-red-500 bg-red-300/50"
                        : "border-orange-500 bg-orange-200/50"
                  }`
                } ${!locked && !isWrong ? "animate-pulse" : ""}`}
                style={{ borderRadius: markerBox.borderRadius, clipPath: markerBox.clipPath }}
              />
            </motion.div>
          )}
        </div>
      </div>

      {isCorrect && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-center text-green-600 font-black text-lg md:text-xl">
          Chính xác! 🎉
        </PlayerInlineFeedback>
      )}
      {isWrong && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-center text-red-500 font-black text-lg md:text-xl">
          Chưa đúng rồi, thử lại nhé! 🤔
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
