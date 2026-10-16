/**
 * Nút nghe file ghi âm — dùng chung cho ghi âm BÀI ĐỌC (cạnh tiêu đề mạch ĐỌC)
 * và ghi âm của riêng một bài tập.
 */
import { useEffect, useRef, useState } from "react";
import { Pause, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { resolveAssetUrl } from "@/core/content/assetUrl";
import { READING_LINE } from "./lessonSections";

// Hai loại này tự dựng trình phát từ `payload.audioUrl`; runner vẽ thêm nút
// nữa là hai chỗ cùng phát một file.
const SELF_PLAYING_AUDIO_TYPES = new Set(["media_anchored", "dictation"]);

/**
 * File ghi âm của một câu (mục 3 — VBT Tiếng Việt 1 tập 1). Đọc
 * `payload.audioUrl`, khoá media chuẩn của schema, nên khi nội dung được nạp
 * ghi âm là nút tự hiện, không phải sửa code.
 */
export function questionAudioUrl(
  questionType: string,
  payload: unknown,
): string | undefined {
  if (SELF_PLAYING_AUDIO_TYPES.has(questionType)) return undefined;
  const url = (payload as { audioUrl?: unknown } | null)?.audioUrl;
  return typeof url === "string" && url.trim() !== "" ? url : undefined;
}

/**
 * Chia audio của câu đang mở vào hai nút: nút BÀI ĐỌC (cạnh tiêu đề mạch ĐỌC)
 * và nút ghi âm của riêng bài tập. Câu mạch ĐỌC mang `payload.audioUrl` thì đó
 * chính là ghi âm bài đọc — không vẽ thêm nút của câu; không có thì lùi về
 * file cấp bài (extra_media). Mạch khác chỉ có nút của câu, không có nút bài đọc.
 */
export function resolveAudioSlots({
  line,
  questionType,
  payload,
  lessonAudioUrl,
}: {
  line: string | undefined;
  questionType: string;
  payload: unknown;
  lessonAudioUrl: string | undefined;
}): {
  readingAudioUrl: string | undefined;
  questionAudioUrl: string | undefined;
} {
  if (line !== READING_LINE) {
    return {
      readingAudioUrl: undefined,
      questionAudioUrl: questionAudioUrl(questionType, payload),
    };
  }
  return {
    readingAudioUrl: questionAudioUrl(questionType, payload) ?? lessonAudioUrl,
    questionAudioUrl: undefined,
  };
}

/**
 * Nút luôn hiện kể cả khi bài chưa có ghi âm (Owner 21/8): nội dung đang được
 * bổ sung dần, nút biến mất theo dữ liệu khiến người duyệt tưởng tính năng
 * hỏng. Thiếu file thì báo bằng toast lúc bấm.
 */
export function QuestionAudioButton({
  url,
  label,
  missingMessage,
}: {
  url?: string;
  label: string;
  missingMessage: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  // Chỉ báo lỗi cho lần bấm CỦA HỌC SINH: sự kiện `error` của thẻ audio cũng
  // nổ lúc trình duyệt tự dò file, báo lúc đó là toast đỏ tự bật khi vừa mở câu.
  const daBamNgheRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const src = resolveAssetUrl(url);

  // Đổi câu / đổi phần là đổi file: nút phải quay về trạng thái "chưa phát",
  // nếu không nó hiện dấu tạm dừng của file trước đó.
  useEffect(() => setPlaying(false), [src]);

  const toggle = () => {
    if (!src) {
      toast.error(missingMessage);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    daBamNgheRef.current = true;
    // Hai nút cùng màn (ghi âm bài đọc + ghi âm bài tập) không được chồng tiếng.
    document.querySelectorAll("audio").forEach((khac) => {
      if (khac !== el) khac.pause();
    });
    void el.play()?.catch(() => {});
  };

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-pressed={playing}
        title={label}
        onClick={toggle}
        className="shrink-0 inline-flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20 cursor-pointer"
      >
        {playing ? (
          <Pause className="size-6" />
        ) : (
          <Volume2 className="size-6" />
        )}
      </button>
      {src ? (
        <audio
          key={src}
          ref={audioRef}
          src={src}
          // Không dò file lúc mount: vừa khỏi tải thừa mỗi lần lật câu, vừa để
          // `error` chỉ nổ sau khi học sinh bấm nghe.
          preload="none"
          // Trạng thái nút bám SỰ KIỆN của thẻ audio, không bám lệnh gọi: chỗ
          // khác dừng file (thoát bài tập) thì nút cũng phải hết dấu tạm dừng.
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          // File 404 hoặc không giải mã được: với học sinh thì cũng là "không
          // nghe được", nên báo đúng câu đó thay vì im lặng không phản hồi.
          onError={() => {
            setPlaying(false);
            if (daBamNgheRef.current) toast.error(missingMessage);
          }}
        />
      ) : null}
    </>
  );
}
