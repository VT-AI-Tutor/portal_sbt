/**
 * P38 — Media anchored / "video".
 * A wrapper that anchors one or more inner questions to points in time of a
 * <video> element. Inner questions are rendered by a caller-provided render-prop
 * so this file stays decoupled from the registry. It does NOT grade — it
 * aggregates child answers into Record<anchorId, unknown> and reports with
 * verdict "incomplete"; the verdict belongs to each child player.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export interface VideoAnchoredPlayerProps extends PlayerProps {
  videoUrl: string;
  poster?: string;
  anchors: MediaAnchor[];
  /** Pause the video and reveal the question when an anchor is crossed. */
  pauseOnAnchor?: boolean;
}

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const VideoAnchoredPlayer: React.FC<VideoAnchoredPlayerProps> = ({
  videoUrl,
  poster,
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  // Gương của `answers` để gộp đáp án con mà KHÔNG gọi report() (setState cha)
  // bên trong updater setAnswers — tránh "setState-in-render".
  const answersRef = useRef<Record<string, unknown>>({});
  // WEB09: video hỏng hoặc treo phải BÁO, không được xoay spinner mãi.
  // "ready" = đã có metadata; "error" = onError hoặc quá STALL_MS mà chưa có.
  const [media, setMedia] = useState<"loading" | "ready" | "error">("loading");
  // Đổi key để React dựng lại <video> — reload() không đủ khi src đã hỏng cache.
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setMedia("loading");
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (media !== "loading") return;
    // ponytail: watchdog cố định 15s; nếu cần thì cho qua prop sau.
    const STALL_MS = 15_000;
    const t = setTimeout(() => setMedia("error"), STALL_MS);
    return () => clearTimeout(t);
  }, [media, reloadKey, videoUrl]);

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
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    if (activeId) return; // a card is already open
    const hit = sorted.find(
      (a) => !shown.has(a.id) && v.currentTime >= a.time,
    );
    if (hit) {
      setShown((prev) => new Set(prev).add(hit.id));
      if (pauseOnAnchor) {
        v.pause();
        setActiveId(hit.id);
      }
    }
  }, [activeId, sorted, shown, pauseOnAnchor]);

  const resume = useCallback(() => {
    setActiveId(null);
    videoRef.current?.play().catch(() => {});
  }, []);

  const jumpTo = useCallback((time: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, time - 0.05);
  }, []);

  const activeAnchor = sorted.find((a) => a.id === activeId) ?? null;
  const answeredCount = Object.keys(answers).length;

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div className="flex flex-col gap-4">
        <div className={`relative rounded-3xl overflow-hidden bg-black shadow-lg ${skin.panel?.("media") ?? "border-4 border-rose-200 "}`}>
          <video
            key={reloadKey}
            ref={videoRef}
            src={videoUrl}
            poster={poster}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration || 0);
              setMedia("ready");
            }}
            onTimeUpdate={handleTimeUpdate}
            onError={() => setMedia("error")}
            className="w-full max-h-[60vh] bg-black"
          />
          {media !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white text-center px-4">
              {media === "loading" ? (
                <>
                  <div className="w-8 h-8 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                  <span className="text-sm font-bold">Đang tải video…</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-bold">
                    Không tải được video. Kiểm tra kết nối rồi thử lại nhé!
                  </span>
                  <button
                    type="button"
                    onClick={retry}
                    className="px-5 py-2 rounded-full bg-white text-slate-800 font-black text-sm"
                  >
                    Thử lại
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Timeline strip with anchor markers */}
        <div className="px-1">
          <div className={`relative h-3 rounded-full ${skin.accent?.("primary", "track") ?? "bg-rose-100  border-2 border-rose-200 "}`}>
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${skin.accent?.("primary", "fill") ?? "bg-rose-400"}`}
              style={{
                width: duration ? `${(current / duration) * 100}%` : "0%",
              }}
            />
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
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full transition-transform hover:scale-125 ${
                    skin.marker?.(markerState) ??
                    `border-4 ${done ? "bg-green-400 border-white" : seen ? "bg-amber-300 border-white" : "bg-white border-rose-400"}`
                  }`}
                />
              );
            })}
          </div>
          <div className={`flex justify-between mt-1 text-xs ${skin.emphasis?.("neutral", "soft") ?? "font-bold text-slate-500"}`}>
            <span>{fmt(current)}</span>
            <span>
              {answeredCount}/{sorted.length} câu đã trả lời
            </span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Anchored question card */}
        <AnimatePresence mode="wait">
          {activeAnchor && (
            <motion.div
              key={activeAnchor.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              className={`rounded-3xl p-4 sm:p-6 shadow-md ${skin.panel?.("card") ?? "border-4 border-rose-300  bg-rose-50/80"}`}
            >
              <div className={`flex items-center gap-2 mb-3 text-sm ${skin.emphasis?.("primary", "strong") ?? "text-rose-500 font-black"}`}>
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${skin.badge?.("primary") ?? "bg-rose-400 text-white"}`}>
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
                    "px-6 py-2.5 rounded-full border-4 border-rose-400 bg-rose-400 text-white font-black text-base shadow-sm hover:bg-rose-500 hover:border-rose-500 transition-colors"
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
