/**
 * Nhãn của câu đang mở — tiêu đề mạch, bộ đếm ở thanh đầu và nút nghe ghi âm
 * của bài tập. Tất cả là chrome của runner: `core/exercise/players/**` là
 * vùng đồng bộ một chiều với evo-books-studio-web nên không nhét vào player.
 */
import type { ReactNode } from "react";
import { QuestionAudioButton } from "./QuestionAudioButton";
import { READING_LINE, type QuestionLabel } from "./lessonSections";

/**
 * Khối trên đầu câu hỏi: tên phần + nút nghe. CHỈ mạch ĐỌC có khối này (Owner
 * 21/8) — mạch khác để trống kể cả khi bản thảo vẫn trả tên phần. Chữ hiện
 * nguyên văn dữ liệu, code không ánh xạ.
 */
export function QuestionSectionTitle({
  line,
  title,
  readingAudioUrl,
}: {
  line?: string;
  title?: string | null;
  readingAudioUrl?: string;
}) {
  if (line !== READING_LINE) return null;
  return (
    <div className="flex items-center gap-2 pb-2">
      {title ? (
        <p
          data-testid="question-section-title"
          className="text-sm font-bold uppercase tracking-wide text-primary/80"
        >
          {title}
        </p>
      ) : null}
      {/* Nút hiện kể cả khi bài chưa có file ghi âm; bấm thì báo bằng toast. */}
      <QuestionAudioButton
        url={readingAudioUrl}
        label="Nghe bài đọc"
        missingMessage="Bài đọc này chưa có file ghi âm."
      />
    </div>
  );
}

/** Bộ đếm ở thanh đầu: theo MẠCH khi bài có mạch, nếu không thì theo cả bài. */
export function QuestionCounter({
  label,
  current,
  total,
}: {
  label?: QuestionLabel;
  current: number;
  total: number;
}) {
  if (label) {
    return (
      <span className="shrink-0">
        {/* Tên kỹ năng là thứ học sinh cần nhận ra trước tiên — to hơn hẳn phần
            đếm bài phía sau (Owner 21/8). */}
        <span className="text-base font-black text-foreground">
          {label.line}
        </span>{" "}
        · Bài <span className="text-foreground text-sm">{label.ordinal}</span>/
        {label.lineTotal}
      </span>
    );
  }
  return (
    <span className="shrink-0">
      Câu <span className="text-foreground text-sm">{current + 1}</span> /{" "}
      {total}
    </span>
  );
}

/**
 * Câu lệnh kèm nút nghe ghi âm của riêng bài tập đó. Không có ghi âm thì trả
 * thẳng câu hỏi, giữ nguyên bố cục cũ.
 */
export function QuestionWithAudio({
  audioUrl,
  children,
}: {
  audioUrl?: string;
  children: ReactNode;
}) {
  if (!audioUrl) return <>{children}</>;
  // Canh TOP chứ không canh baseline: câu mở đầu bằng ẢNH khối thì baseline của
  // ô nội dung rơi xuống đáy ảnh, đo thực tế đẩy nút xuống 797px. Ô chứa nút cao
  // đúng line-box của câu lệnh và lấy padding của PlayerShell (`p-2 sm:p-3
  // md:p-4`, heading `text-xl md:text-2xl leading-tight` — shared.tsx) để nút
  // nằm ngang dòng đầu; lệch có đổi skin cũng chỉ trong một dòng chữ.
  return (
    <div className="flex items-start gap-2">
      <span className="mt-2 sm:mt-3 md:mt-4 flex h-[25px] shrink-0 items-center md:h-[30px]">
        <QuestionAudioButton
          url={audioUrl}
          label="Nghe ghi âm bài tập"
          missingMessage="Bài tập này chưa có file ghi âm."
        />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
