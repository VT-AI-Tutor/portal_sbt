/**
 * Coloring player — fill regions with chosen colors (record-only, manual).
 * type: coloring
 *
 * Student picks a color from the palette, then taps regions to fill them.
 * No grading: every change reports "incomplete".
 */
import React, { useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, ContentImage, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface ColoringRegion {
  id: string;
  label?: string;
}

export interface ColoringPlayerProps extends PlayerProps {
  imageUrl?: string;
  regions: ColoringRegion[];
  /** Palette of fill colors (CSS color strings). */
  colors?: string[];
}

/** Emitted answer entry. */
export interface ColoringEntry {
  regionId: string;
  color: string;
}

const DEFAULT_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

export const ColoringPlayer: React.FC<ColoringPlayerProps> = ({
  imageUrl,
  regions,
  colors = DEFAULT_COLORS,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const [brush, setBrush] = useState(colors[0]);
  // Kênh khôi phục cha cấp (`answer` = ColoringEntry[] đúng shape emit) — YesNo
  // selectionKey pattern với key ổn định theo thứ tự `regions`: chỉ reset khi
  // cha đưa đáp án khác ngữ nghĩa (không reset khi echo). Không remount.
  // Entry hỏng (regionId lạ / thiếu color) bị bỏ qua an toàn.
  const fillsKey = (record: Record<string, string>) =>
    JSON.stringify(regions.map((r) => [r.id, record[r.id] ?? null]));
  const initialFills: Record<string, string> = {};
  if (Array.isArray(answer)) {
    for (const entry of answer) {
      if (!entry || typeof entry !== "object") continue;
      const { regionId, color } = entry as { regionId?: unknown; color?: unknown };
      if (
        typeof regionId === "string" &&
        typeof color === "string" &&
        regions.some((r) => r.id === regionId)
      ) {
        initialFills[regionId] = color;
      }
    }
  }
  const answerKey = fillsKey(initialFills);
  const [fills, setFills] = useState<Record<string, string>>(initialFills);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    if (fillsKey(fills) !== answerKey) setFills(initialFills);
  }

  const locked = submitted || status === "success";

  const fillRegion = (id: string) => {
    if (locked) return;
    const next = { ...fills };
    if (next[id] === brush) {
      delete next[id];
    } else {
      next[id] = brush;
    }
    setFills(next);
    const entries: ColoringEntry[] = Object.entries(next).map(([regionId, color]) => ({ regionId, color }));
    report(entries, "incomplete");
  };

  return (
    <PlayerShell {...shell} submitted={submitted}>
      {imageUrl && (
        <div className="flex justify-center mb-4">
          <ContentImage
            src={imageUrl}
            alt="Hình tô màu"
            className={`shadow-md ${skin.panel?.("media") ?? "border-4 border-white"}`}
          />
        </div>
      )}

      {/* Palette */}
      <div className={`flex flex-wrap items-center gap-3 mb-5 p-3 sm:p-4 ${skin.panel?.("tray") ?? "bg-white/60 rounded-2xl border-4 border-white shadow-md"}`}>
        <span className={`text-sm mr-1 ${skin.emphasis?.("neutral", "strong") ?? "font-black text-slate-500"}`}>Chọn màu:</span>
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setBrush(c)}
            disabled={locked}
            style={{ backgroundColor: c }}
            className={`${
              skin.chip?.(brush === c ? "selected" : "idle", "primary") ??
              `w-9 h-9 rounded-full border-4 transition-all shadow ${
                brush === c ? "border-slate-800 scale-110" : "border-white"
              }`
            } disabled:opacity-50`}
            aria-label={`Màu ${c}`}
          />
        ))}
      </div>

      {/* Regions */}
      {/* `px-2`: khay đã có `py-2` nhưng KHÔNG có padding ngang, trong khi mỗi ô
          màu phóng `scale: 1.05` khi rê chuột → ô đầu và ô cuối hàng bị xén nét
          viền ở mép khay (cùng lỗi với vùng cuộn ở ChainMatchPlayer). */}
      <div className={`flex flex-wrap gap-3 md:gap-4 justify-center px-2 py-2 relative select-none overflow-hidden rounded-2xl shadow-lg ${skin.panel?.("media") ?? "border-4 border-white"}`}>
        {regions.map((region, i) => {
          const color = fills[region.id];
          const filled = Boolean(color);
          return (
            <motion.button
              key={region.id}
              type="button"
              whileHover={!locked ? { scale: 1.05 } : undefined}
              whileTap={!locked ? { scale: 0.95 } : undefined}
              onClick={() => fillRegion(region.id)}
              disabled={locked}
              aria-pressed={filled}
              style={filled ? { backgroundColor: color, borderColor: "white" } : {}}
              className={`relative px-5 py-4 sm:px-8 sm:py-5 transition-all text-base sm:text-lg ${
                skin.chip?.(filled ? "selected" : "idle", "primary") ??
                `rounded-[24px] border-4 font-black ${
                  filled
                    ? "text-white shadow-xl"
                    : "bg-white border-slate-200 text-slate-800 hover:border-fuchsia-200  shadow-lg"
                }`
              }`}
            >
              {region.label ?? `Vùng ${i + 1}`}
            </motion.button>
          );
        })}
      </div>
    </PlayerShell>
  );
};
