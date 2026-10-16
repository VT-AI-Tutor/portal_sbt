/**
 * Speaking player — record-only (manual scoring).
 * type: speaking
 *
 * Student records their voice via MediaRecorder. On stop we emit an audio-ref
 * object and report "incomplete" (no auto grading, no green/red, no sound).
 */
import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, RotateCcw } from "lucide-react";
import { PlayerShell, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface SpeakingPlayerProps extends PlayerProps {
  /** Max recording length in seconds (default 60). */
  maxDuration?: number;
  /** Allow clearing the recording and recording again (default true). */
  allowRetake?: boolean;
}

/**
 * Containers in preference order. Chrome/Firefox take the WebM entries, Safari
 * the MP4 one; an empty result means the browser only offers its own default,
 * which we then read back off `MediaRecorder.mimeType`.
 */
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const;

/** Emitted answer shape. */
export interface SpeakingAnswer {
  audioRef: string;
  durationMs: number;
}

export const SpeakingPlayer: React.FC<SpeakingPlayerProps> = ({
  maxDuration = 60,
  allowRetake = true,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  ...shell
}) => {
  const skin = useSkin();
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  /** Bytes actually captured — the only honest proof a take holds audio. */
  const [takeBytes, setTakeBytes] = useState<number | null>(null);
  /** Seconds counted while recording — the fallback length when the blob's own duration is unusable. */
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  /** Duration the <audio> element reports, once it has metadata. */
  const [mediaDuration, setMediaDuration] = useState(Number.NaN);
  /** Current playback position, in seconds. */
  const [playhead, setPlayhead] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const elapsedRef = useRef(0);

  const locked = submitted || status === "success";

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  const startRecording = async () => {
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError(
        "Trình duyệt không cho phép ghi âm ở trang này. Hãy mở bằng HTTPS (hoặc localhost) rồi thử lại.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Never hardcode the container: Chrome records WebM, Safari records MP4.
      // Labelling an MP4 blob "audio/webm" makes <audio> refuse to decode it, so
      // the take existed but played back nothing.
      const mimeType = PREFERRED_MIME_TYPES.find((type) =>
        MediaRecorder.isTypeSupported?.(type),
      );
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        // `mr.mimeType` is what the browser actually produced — authoritative
        // over anything we asked for.
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || mimeType || "audio/webm",
        });
        if (blob.size === 0) {
          // A take with no bytes is not a take. Say so instead of showing a
          // play button that can never produce sound.
          setMicError("Không thu được âm thanh nào. Hãy kiểm tra micro rồi ghi lại.");
          return;
        }
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setTakeBytes(blob.size);
        setRecordedSeconds(elapsedRef.current);
        setMediaDuration(Number.NaN);
        setPlayhead(0);
        report({ audioRef: url, durationMs: elapsedRef.current * 1000 }, "incomplete");
      };
      mediaRecorderRef.current = mr;
      // Flush a chunk every second rather than only at stop, so a take that is
      // interrupted still carries the audio recorded up to that point.
      mr.start(1000);
      setRecording(true);
      setElapsed(0);
      elapsedRef.current = 0;
      timerRef.current = setInterval(() => {
        // The tick drives a ref and then mirrors it into state. Stopping the
        // recorder from inside a setState updater made the side effect run
        // twice under StrictMode, and the second `stop()` throws on an
        // already-inactive recorder.
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= maxDuration) stopRecording();
      }, 1000);
    } catch (error) {
      // A swallowed rejection here is why the button looked inert: the user
      // clicked, the browser refused, and nothing on screen changed (issue
      // #659). Report it instead, and keep the UI in its idle state.
      const name = (error as { name?: string } | null)?.name;
      setMicError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Bạn đã chặn quyền dùng micro. Hãy cho phép micro trong trình duyệt rồi bấm lại."
          : name === "NotFoundError" || name === "DevicesNotFoundError"
            ? "Không tìm thấy micro nào trên thiết bị này."
            : "Không bắt đầu ghi âm được. Hãy kiểm tra micro rồi thử lại.",
      );
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  };

  const retake = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setElapsed(0);
    elapsedRef.current = 0;
    setPlaying(false);
    setMicError(null);
    setTakeBytes(null);
    setRecordedSeconds(0);
    setMediaDuration(Number.NaN);
    setPlayhead(0);
    report(null, "incomplete");
  };

  const togglePlay = () => {
    if (!audioElRef.current || !audioUrl) return;
    if (playing) {
      audioElRef.current.pause();
      setPlaying(false);
      return;
    }
    setMicError(null);
    // `play()` rejects on a blob the browser cannot decode. Awaiting the promise
    // is the difference between "nothing happens" and knowing why.
    const started = audioElRef.current.play();
    setPlaying(true);
    void Promise.resolve(started)
      .then(() => undefined)
      .catch(() => {
        setPlaying(false);
        setMicError("Không phát lại được bản ghi. Hãy ghi lại và thử lần nữa.");
      });
  };

  const fmt = (s: number) => {
    const whole = Math.max(0, Math.floor(s));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  };

  /**
   * Length of the take, in seconds. Chrome reports `Infinity` for the duration
   * of a MediaRecorder blob (the WebM header carries no duration), so the
   * element is only trusted when it gives a finite number — otherwise we fall
   * back to the seconds we counted while recording.
   */
  const takeSeconds = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : recordedSeconds;
  const progress = takeSeconds > 0 ? Math.min(1, playhead / takeSeconds) : 0;

  const seekTo = (seconds: number) => {
    const clamped = Math.min(Math.max(0, seconds), takeSeconds);
    if (audioElRef.current) audioElRef.current.currentTime = clamped;
    setPlayhead(clamped);
  };

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div className={`p-4 sm:p-5 shadow-lg flex flex-col items-center gap-3 ${skin.panel?.("card") ?? "bg-white/60 rounded-3xl border-4 border-white"}`}>
        {!audioUrl ? (
          // MỘT HÀNG (Owner 8/8): đồng hồ TRÁI — nút ghi CHÍNH GIỮA — gợi ý
          // PHẢI, để khối ghi âm thấp nhất có thể (trước đây đồng hồ + gợi ý
          // xếp chồng cạnh nút làm khối cao gần gấp đôi nút). Grid 3 cột
          // 1fr/auto/1fr giữ nút đúng tâm khối; đồng hồ bám mép phải cột trái
          // và gợi ý bám mép trái cột phải nên cả cụm ôm quanh nút.
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
            <div className={`justify-self-end text-xl sm:text-2xl font-mono tabular-nums leading-none ${skin.emphasis?.("neutral", "strong") ?? "font-black text-slate-800"}`}>
              {fmt(elapsed)} <span className={`text-sm sm:text-base ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500"}`}>/ {fmt(maxDuration)}</span>
            </div>
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={locked}
              // `iconButton` chứ KHÔNG phải `actionButton`: actionButton là
              // class nút CHỮ (px-8 py-3 border-4) — đè lên nút icon 56px
              // border-box thì content âm, icon Mic bị bóp biến mất (bug
              // "mất icon" Owner 8/8).
              className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
                recording
                  ? `animate-pulse ${skin.iconButton?.("danger") ?? "bg-red-500 hover:bg-red-600 text-white shadow-lg"}`
                  : skin.iconButton?.("primary") ?? "bg-rose-500 hover:bg-rose-600 text-white shadow-lg"
              }`}
            >
              {recording ? <Square size={22} /> : <Mic size={24} />}
            </button>
            {/* `emphasis` soft chứ KHÔNG phải `feedback`: feedback là dòng
                phản hồi đứng riêng (mt-4 + text-lg) — margin/cỡ chữ đó phá
                thẳng hàng của grid một hàng này. */}
            <p className={`justify-self-start text-xs sm:text-sm ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
              {recording ? "Đang ghi âm..." : "Nhấn nút để bắt đầu ghi âm"}
            </p>
          </div>
        ) : (
          <div className="flex w-full max-w-md flex-col items-center gap-2.5">
            <div className="flex w-full items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${skin.iconButton?.("success") ?? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"}`}
              >
                {playing ? <Pause size={22} /> : <Play size={22} />}
              </button>

              {/* Playback scrubber. The track's full width is the length of THIS
                  take, so the counter tops out at what was recorded (a 4s take
                  reads 0:04), not at maxDuration. Đặt cùng hàng với nút phát để
                  tiết kiệm chiều cao. */}
              <div className="flex flex-1 items-center gap-2">
                <span className="font-mono text-xs tabular-nums text-slate-500">
                  {fmt(playhead)}
                </span>
                <div className="relative flex-1">
                  <div className="h-1.5 w-full rounded-full bg-slate-100" />
                  <div
                    data-testid="speaking-progress"
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                    style={{ width: `${progress * 100}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={takeSeconds || 0}
                    step={0.01}
                    value={Math.min(playhead, takeSeconds || 0)}
                    onChange={(e) => seekTo(Number(e.target.value))}
                    aria-label="Vị trí phát lại"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
                <span
                  data-testid="speaking-take-length"
                  className="font-mono text-xs tabular-nums text-slate-500"
                >
                  {fmt(takeSeconds)}
                </span>
              </div>

              {allowRetake && !locked && (
                <button
                  type="button"
                  onClick={retake}
                  className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${skin.iconButton?.("neutral") ?? "bg-slate-100 hover:bg-slate-300 text-slate-500"}`}
                >
                  <RotateCcw size={18} />
                </button>
              )}
            </div>

            <p className={`text-xs sm:text-sm ${skin.feedback?.("neutral") ?? "text-slate-500 font-bold"}`}>
              {`Đã ghi nhận · ${fmt(takeSeconds)}${
                takeBytes != null ? ` · ${Math.max(1, Math.round(takeBytes / 1024))} KB` : ""
              }`}
            </p>

            <audio
              ref={audioElRef}
              src={audioUrl}
              onLoadedMetadata={(e) => setMediaDuration(e.currentTarget.duration)}
              onDurationChange={(e) => setMediaDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
              onEnded={() => {
                setPlaying(false);
                seekTo(0);
              }}
              onError={() => {
                setPlaying(false);
                setMicError("Bản ghi bị lỗi hoặc trình duyệt không đọc được. Hãy ghi lại.");
              }}
            />
          </div>
        )}

        {micError && (
          <p
            role="alert"
            data-testid="speaking-mic-error"
            className="max-w-md text-center text-sm font-semibold text-rose-600 "
          >
            {micError}
          </p>
        )}
      </div>
    </PlayerShell>
  );
};
