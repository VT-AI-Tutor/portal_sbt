/**
 * Thư viện câu hỏi mẫu xếp theo MÃ YÊU CẦU (route `/dev/samples`).
 *
 * Khác `/dev/players` ở chỗ CĂN BẢN, không phải ở chỗ ít thẻ hơn:
 *
 * - `/dev/players` xếp theo **họ player** và có đủ 80 thẻ kể cả nhóm kiểm cỡ ảnh.
 *   Nó là gallery cho người phát triển.
 * - Trang này xếp theo **mã yêu cầu II.1–II.39**, đúng thứ tự bảng yêu cầu, để
 *   đối chiếu từng dòng mà không phải tự dịch từ tên player sang mã yêu cầu.
 *
 * Payload mẫu dùng CHUNG với `/dev/players` (import `SAMPLES`): hai bộ mẫu song
 * song thì sớm muộn cũng trôi lệch, và lúc đó trang này không còn phản ánh thứ
 * đang chạy.
 */
import React from "react";
import { resolvePlayer } from "./manifest";
import { renderInteractionPlayer } from "./dispatch";
import { SAMPLES } from "./PlayersDemoPage";
import { verdictFor } from "@/core/exercise/grading";

type Status = "auto" | "manual" | "partial";

interface UlnlRow {
  /** Mã yêu cầu, ví dụ "II.7". */
  code: string;
  /** Tên nguyên văn trong bảng yêu cầu — giữ y nguyên để đối chiếu được. */
  label: string;
  type: string;
  interaction: string;
  status: Status;
  /** Ghi chú hiện trên thẻ: lý do chấm thủ công, hoặc mốc đóng. */
  note?: string;
}

const STATUS_LABEL: Record<Status, string> = {
  auto: "Hệ tự chấm",
  manual: "Giáo viên chấm",
  partial: "Đạt một phần",
};

const STATUS_CLASS: Record<Status, string> = {
  auto: "bg-emerald-100 text-emerald-800",
  manual: "bg-sky-100 text-sky-800",
  partial: "bg-amber-100 text-amber-800",
};

/**
 * 39 loại câu của mục II, đúng thứ tự và đúng tên trong bảng yêu cầu.
 *
 * Chỉ khai `type` + `interaction`; mã player và payload mẫu tra ở runtime qua
 * `resolvePlayer`, nên bảng này không bao giờ lệch mã P với manifest.
 */
const ULNL_ROWS: UlnlRow[] = [
  { code: "II.1", label: "Trắc nghiệm 1 đáp án", type: "single_choice", interaction: "radio", status: "auto" },
  { code: "II.2", label: "Trắc nghiệm nhiều đáp án", type: "multiple_choice", interaction: "checkbox", status: "auto" },
  { code: "II.3", label: "Đúng / Sai", type: "true_false", interaction: "boolean", status: "auto" },
  { code: "II.4", label: "Nhiều mệnh đề Đúng / Sai", type: "multi_true_false", interaction: "radio", status: "auto" },
  { code: "II.5", label: "Điền khuyết ngắn", type: "fill_blank", interaction: "text", status: "auto" },
  { code: "II.6", label: "Điền khuyết nhiều chỗ", type: "cloze", interaction: "inline", status: "auto" },
  { code: "II.7", label: "Điền khuyết bằng chọn đáp án", type: "cloze", interaction: "select", status: "auto", note: "Đóng 06/8" },
  { code: "II.8", label: "Kéo thả từ vào chỗ trống", type: "cloze", interaction: "word_bank", status: "auto" },
  { code: "II.9", label: "Câu trả lời ngắn", type: "fill_blank", interaction: "short_text", status: "auto" },
  { code: "II.10", label: "Đáp án số", type: "numeric_answer", interaction: "numeric", status: "auto" },
  { code: "II.11", label: "Biểu thức toán", type: "math_expression", interaction: "formula", status: "auto" },
  { code: "II.12", label: "Ghép đôi", type: "matching", interaction: "columns", status: "auto" },
  { code: "II.13", label: "Nối cặp", type: "matching", interaction: "lines", status: "auto" },
  { code: "II.14", label: "Sắp xếp thứ tự", type: "ordering", interaction: "list", status: "auto" },
  { code: "II.15", label: "Phân loại vào nhóm", type: "classification", interaction: "buckets", status: "auto" },
  { code: "II.16", label: "Kéo thả vào vùng", type: "drag_drop", interaction: "zones", status: "auto", note: "Đóng 06/8 — trở lại danh mục chuẩn" },
  { code: "II.17", label: "Gắn nhãn hình ảnh", type: "labeling", interaction: "image", status: "auto" },
  { code: "II.18", label: "Chọn vùng trên ảnh", type: "hotspot", interaction: "single", status: "auto" },
  { code: "II.19", label: "Khoanh tròn / đánh dấu", type: "point_marking", interaction: "pin", status: "auto" },
  { code: "II.20", label: "Tô màu", type: "coloring", interaction: "regions", status: "manual", note: "Bài mở — không có đáp án máy chấm được" },
  { code: "II.21", label: "Vẽ / viết tay", type: "drawing", interaction: "draw", status: "manual", note: "Canvas vẽ tay — đúng khi để giáo viên chấm" },
  { code: "II.22", label: "Nối điểm", type: "connect_points", interaction: "lines", status: "auto" },
  { code: "II.23", label: "Điền bảng", type: "table_completion", interaction: "fill", status: "auto" },
  { code: "II.24", label: "Hoàn thành sơ đồ", type: "diagram_fill", interaction: "fill", status: "partial", note: "diagram_fill tự chấm; mind_map_completion để giáo viên chấm" },
  { code: "II.25", label: "Đọc hiểu đoạn văn", type: "question_group", interaction: "group", status: "auto" },
  { code: "II.26", label: "Nghe hiểu", type: "media_anchored", interaction: "audio", status: "auto" },
  { code: "II.27", label: "Chính tả nghe viết", type: "dictation", interaction: "transcribe", status: "auto" },
  { code: "II.28", label: "Xem video và trả lời", type: "media_anchored", interaction: "video", status: "auto" },
  { code: "II.29", label: "Tự luận ngắn", type: "essay", interaction: "long_text", status: "manual" },
  { code: "II.30", label: "Tự luận dài", type: "essay", interaction: "long_text", status: "manual" },
  { code: "II.31", label: "Nộp ảnh bài làm", type: "upload_answer", interaction: "upload", status: "manual" },
  { code: "II.32", label: "Nộp file đính kèm", type: "upload_answer", interaction: "upload", status: "manual" },
  { code: "II.33", label: "Ô chữ", type: "crossword", interaction: "grid", status: "auto" },
  { code: "II.34", label: "Tìm từ trong bảng chữ", type: "word_search", interaction: "grid", status: "auto", note: "Đóng 06/8 — chấm ở cả client và server" },
  { code: "II.35", label: "Trò chơi ghép hình", type: "jigsaw", interaction: "pieces", status: "auto", note: "Đóng 06/8 — chấm ở cả client và server" },
  { code: "II.36", label: "Bài theo nhóm câu hỏi", type: "question_group", interaction: "group", status: "auto" },
  { code: "II.37", label: "Bài theo tình huống", type: "question_group", interaction: "group", status: "auto", note: "Đạt bằng loại có sẵn — 332 câu thật đang chạy trên 14 loại" },
  { code: "II.38", label: "Bài hình học tương tác", type: "geometry_grid", interaction: "construct", status: "auto", note: "Đóng 06/8 — 34/42 câu Toán tự chấm" },
  { code: "II.39", label: "Bài biểu đồ", type: "chart_build", interaction: "plot", status: "auto", note: "Đóng 06/8 — học sinh tự dựng biểu đồ" },
];

/** Giữ một thẻ lỗi không kéo sập cả trang. */
class CardBoundary extends React.Component<
  { code: string; children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <b>{this.props.code}</b> — lỗi render: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

function SampleCard({ row }: { row: UlnlRow }) {
  const entry = resolvePlayer(row.type, row.interaction);
  const playerId = entry?.id;
  const sample = playerId ? SAMPLES[playerId] : undefined;

  const payload = {
    ...(sample ?? { content: { blocks: [{ type: "paragraph", text: row.label }] } }),
    display: { interactionType: row.interaction },
  };

  const [answer, setAnswer] = React.useState<unknown>(undefined);
  const [checked, setChecked] = React.useState(false);

  const result = checked ? verdictFor(row.type, payload, undefined, answer) : undefined;

  return (
    <section id={row.code} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-base font-bold text-blue-600">{row.code}</span>
        <h2 className="text-lg font-bold text-slate-900">{row.label}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[row.status]}`}>
          {STATUS_LABEL[row.status]}
        </span>
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
          {row.type}/{row.interaction}
          {playerId ? ` · ${playerId}` : " · KHÔNG tìm thấy player"}
        </code>
      </header>

      {row.note && <p className="mb-3 text-xs italic text-slate-500">{row.note}</p>}

      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2">
        <CardBoundary code={row.code}>
          {renderInteractionPlayer(row.type, payload, {
            onAnswerChange: (a: unknown) => setAnswer(a),
            submitted: checked,
            gradeMode: "parent" as const,
            // Khớp đúng surface học sinh: chấm sai KHÔNG lộ đáp án chưa chọn.
            revealCorrect: false,
            result,
          })}
        </CardBoundary>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        {checked && (
          <span
            className={
              "rounded-full px-2 py-0.5 text-xs font-semibold " +
              (result === "correct"
                ? "bg-green-100 text-green-700"
                : result === "incorrect"
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-600")
            }
          >
            {result === "correct" ? "Đúng" : result === "incorrect" ? "Sai" : "Chờ giáo viên chấm"}
          </span>
        )}
        <button
          type="button"
          onClick={() => setChecked((v) => !v)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {checked ? "Làm lại" : "Kiểm tra"}
        </button>
      </div>
    </section>
  );
}

export function SamplesPage() {
  const [only, setOnly] = React.useState<"all" | Status>("all");
  const rows = only === "all" ? ULNL_ROWS : ULNL_ROWS.filter((r) => r.status === only);

  const count = (s: Status) => ULNL_ROWS.filter((r) => r.status === s).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-xl font-black text-slate-900">
            Câu hỏi mẫu theo mã yêu cầu — Hệ thống Sách bài tập
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {ULNL_ROWS.length} loại câu của mục II, xếp theo đúng thứ tự bảng yêu cầu.
            Bấm <b>Kiểm tra</b> ở mỗi thẻ để xem hệ chấm.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {([
              ["all", `Tất cả (${ULNL_ROWS.length})`],
              ["auto", `${STATUS_LABEL.auto} (${count("auto")})`],
              ["manual", `${STATUS_LABEL.manual} (${count("manual")})`],
              ["partial", `${STATUS_LABEL.partial} (${count("partial")})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOnly(key)}
                className={
                  "rounded-full px-3 py-1 text-xs font-semibold transition " +
                  (only === key
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6">
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <b>Cách đọc:</b> “{STATUS_LABEL.manual}” không phải là thiếu sót — tự luận, nộp bài,
          vẽ tay và tô màu vốn không có đáp án nào máy chấm được, nên để giáo viên chấm mới
          đúng. Mọi thẻ ở đây đều là <b>bài chạy thật</b>, không phải ảnh chụp.
        </p>
        {rows.map((row) => (
          <SampleCard key={row.code} row={row} />
        ))}
      </main>
    </div>
  );
}
