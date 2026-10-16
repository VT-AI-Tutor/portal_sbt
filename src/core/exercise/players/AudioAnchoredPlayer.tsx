/**
 * P39 — Media anchored / "audio".
 * A wrapper that anchors one or more inner questions to points in time of an
 * <audio> element. Inner questions are rendered by a caller-provided render-prop
 * so this file stays decoupled from the registry. It does NOT grade — it
 * aggregates child answers into Record<anchorId, unknown> and reports with
 * verdict "incomplete"; the verdict belongs to each child player.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PlayerShell, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

interface MediaAnchor {
  id: string;
  time: number; // seconds into the media when the question should appear
  /** Renders the inner question player. Provided by the caller. */
  render: (ctx: {
    onAnswerChange: (a: unknown) => void;
    submitted?: boolean;
    onStatusChange?: (s: "idle" | "success" | "error") => void;
  }) => React.ReactNode;
}

export interface AudioAnchoredPlayerProps extends PlayerProps {
  audioUrl: string;
  anchors: MediaAnchor[];
  /** Pause the audio and reveal the question when an anchor is crossed. */
  pauseOnAnchor?: boolean;
}

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Stable pseudo-random bar heights for the faux waveform.
const WAVE_BARS = Array.from({ length: 48 }, (_, i) => {
  const v = Math.sin(i * 1.7) * Math.cos(i * 0.6);
  return 0.35 + Math.abs(v) * 0.65; // 0.35 .. 1.0
});

export const AudioAnchoredPlayer: React.FC<AudioAnchoredPlayerProps> = ({
  audioUrl,
  anchors,
  pauseOnAnchor = true,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  ...shell
}) => {
  const skin = useSkin();
  const { report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  // Gương của `answers` để gộp đáp án con mà KHÔNG gọi report() (setState cha)
  // bên trong updater setAnswers — tránh "setState-in-render".
  const answersRef = useRef<Record<string, unknown>>({});

  const sorted = useMemo(
    () => [...anchors].sort((a, b) => a.time - b.time),
    [anchors],
  );

  const recordAnswer = useCallback(
    (anchorId: string, value: unknown) => {
      const next = { ...answersRef.current, [anchorId]: value };
      answersRef.current = next;
      setAnswers(next);
      // Wrapper không tự chấm: trả lời đủ các mốc KHÔNG có nghĩa là đúng.
      // Luôn báo verdict "incomplete" — việc chấm thuộc về từng câu hỏi con.
      report(next, "incomplete");
    },
    [report],
  );

  const handleTimeUpdate = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setCurrent(a.currentTime);
    if (activeId) return; // a card is already open
    const hit = sorted.find((an) => !shown.has(an.id) && a.currentTime >= an.time);
    if (hit) {
      setShown((prev) => new Set(prev).add(hit.id));
      if (pauseOnAnchor) {
        a.pause();
        setActiveId(hit.id);
      }
    }
  }, [activeId, sorted, shown, pauseOnAnchor]);

  const resume = useCallback(() => {
    setActiveId(null);
    audioRef.current?.play().catch(() => {});
  }, []);

  const jumpTo = useCallback((time: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, time - 0.05);
  }, []);

  const progress = duration ? current / duration : 0;
  const activeAnchor = sorted.find((a) => a.id === activeId) ?? null;
  const answeredCount = Object.keys(answers).length;

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div className="flex flex-col gap-4">
        <div className={`p-4 sm:p-5 shadow-sm ${skin.panel?.("card") ?? "rounded-3xl border-4 border-violet-200  bg-violet-50/70"}`}>
          {/* Faux waveform with anchor markers */}
          <div className="relative h-20 flex items-end gap-[2px]">
            {WAVE_BARS.map((h, i) => {
              const played = (i + 1) / WAVE_BARS.length <= progress;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-colors ${
                    played
                      ? skin.accent?.("primary", "fill") ?? "bg-violet-400"
                      : skin.accent?.("primary", "softFill") ?? "bg-violet-200"
                  }`}
                  style={{ height: `${h * 100}%` }}
                />
              );
            })}

            {/* Anchor markers floating over the waveform */}
            {sorted.map((a) => {
              const left = duration ? (a.time / duration) * 100 : 0;
              const done = a.id in answers;
              const seen = shown.has(a.id);
              const markerState = done ? "correct" : seen ? "active" : "idle";
              return (
                <button
                  key={a.id}
                  type="button"
                  title={`Câu hỏi tại ${fmt(a.time)}`}
                  onClick={() => jumpTo(a.time)}
                  style={{ left: `${left}%` }}
                  className={`absolute top-0 -translate-x-1/2 w-4 h-4 rounded-full transition-transform hover:scale-125 ${
                    skin.marker?.(markerState) ??
                    `border-4 ${done ? "bg-green-400 border-white" : seen ? "bg-amber-300 border-white" : "bg-white border-violet-400"}`
                  }`}
                />
              );
            })}
          </div>

          <div className={`flex justify-between mt-2 text-xs ${skin.emphasis?.("neutral", "soft") ?? "font-bold text-slate-500"}`}>
            <span>{fmt(current)}</span>
            <span>
              {answeredCount}/{sorted.length} câu đã trả lời
            </span>
            <span>{fmt(duration)}</span>
          </div>

          {/* preload="metadata": without it the browser picks the default, and on
              mobile Chrome/Safari (and desktop Chrome under Data Saver) that is
              "none" — no metadata is fetched, `duration` stays NaN, and the player
              reads 0:00/0:00 with the anchor markers all stacked at 0% until the
              learner presses play. Every other media element here already sets it
              (see shared.tsx). onError surfaces a failed load instead of leaving
              a silent, dead 0:00 player — a bad url or MIME used to look identical
              to a slow one. */}
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            preload="metadata"
            onLoadedMetadata={(e) => {
              setLoadFailed(false);
              setDuration(e.currentTarget.duration || 0);
            }}
            onError={() => setLoadFailed(true)}
            onTimeUpdate={handleTimeUpdate}
            className="w-full mt-3"
          />
          {loadFailed && (
            <p role="alert" className="mt-2 text-xs font-bold text-red-500">
              Không tải được tệp âm thanh. Kiểm tra lại đường dẫn tệp của câu hỏi này.
            </p>
          )}
        </div>

        {/* Anchored question card */}
        <AnimatePresence mode="wait">
          {activeAnchor && (
            <motion.div
              key={activeAnchor.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              className={`p-4 sm:p-6 shadow-md ${skin.panel?.("card") ?? "rounded-3xl border-4 border-violet-300  bg-violet-50/80"}`}
            >
              <div className={`flex items-center gap-2 mb-3 text-sm ${skin.emphasis?.("primary", "strong") ?? "font-black text-violet-500"}`}>
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${skin.badge?.("primary") ?? "bg-violet-400 text-white"}`}>
                  ?
                </span>
                Câu hỏi tại {fmt(activeAnchor.time)}
              </div>

              {activeAnchor.render({
                submitted,
                onAnswerChange: (a) => recordAnswer(activeAnchor.id, a),
                // Nuốt status con có chủ đích (giống QuestionGroupPlayer):
                // "success" của MỘT câu con không được rò rỉ thành status
                // của cả wrapper đối với host.
                onStatusChange: () => {},
              })}

              <div className="flex justify-end mt-4">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={resume}
                  className={
                    skin.actionButton?.(true, "primary") ??
                    "px-6 py-2.5 rounded-full border-4 border-violet-400 bg-violet-400 text-white font-black text-base shadow-sm hover:bg-violet-500 hover:border-violet-500 transition-colors"
                  }
                >
                  Tiếp tục ▶
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PlayerShell>
  );
};
