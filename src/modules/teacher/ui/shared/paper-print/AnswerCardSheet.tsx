import { KIND_LABEL } from "@/core/lib/paperKind";
import type { TeacherPaper } from "@/modules/teacher/api/teacherPaperApi";
import { optionLetter, preparePrintablePaper } from "@/modules/teacher/lib/paperPrint";

/**
 * PHIẾU TRẢ LỜI TRẮC NGHIỆM tách riêng (PAPER-R16).
 *
 * Học sinh tô vào phiếu, giáo viên chấm cả xấp bằng một tờ đáp án đặt chồng —
 * đúng thói quen chấm giấy hiện nay, và tiết kiệm hơn hẳn việc dò từng tờ đề.
 */
export function AnswerCardSheet({
  paper,
  schoolName,
  className,
}: {
  paper: TeacherPaper;
  schoolName?: string;
  className?: string;
}) {
  const { choice } = preparePrintablePaper(paper);

  if (choice.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed p-4 text-sm text-muted-foreground print:hidden">
        Đề này không có câu trắc nghiệm nào nên không cần phiếu trả lời.
      </div>
    );
  }

  // Số phương án nhiều nhất trong đề — mọi ô tô cùng chiều rộng thì phiếu mới
  // xếp thẳng hàng và đặt tờ đáp án chồng lên chấm được.
  const maxOptions = Math.max(
    ...choice.map((q) => Math.max(q.options.length, 2)),
  );

  return (
    <article className={`paper-sheet bg-white text-black ${className ?? ""}`}>
      <header className="mb-4">
        <div className="text-center text-[13px] uppercase">
          {schoolName ?? "TRƯỜNG …………………"}
        </div>
        <h1 className="mt-1 text-center text-lg font-bold uppercase">
          Phiếu trả lời trắc nghiệm
        </h1>
        <div className="text-center text-[13px]">
          {[
            KIND_LABEL[paper.kind],
            paper.title,
            paper.subject,
            paper.level ? `Lớp ${paper.level}` : null,
          ]
            .filter(Boolean)
            .join(" — ")}
        </div>

        <div className="mt-3 flex items-end justify-between gap-4 text-[13px]">
          <div className="flex-1 space-y-1.5">
            <div>Họ và tên: ………………………………………………………</div>
            <div>Lớp: ……………… Số báo danh: ………………</div>
          </div>
          <div className="w-24 shrink-0 border border-black text-center">
            <div className="border-b border-black py-0.5 text-xs">Điểm</div>
            <div className="h-10" />
          </div>
        </div>

        <p className="mt-2 text-[12px] italic">
          Hướng dẫn: tô kín ô tròn ứng với phương án chọn. Tô sai thì tẩy sạch
          rồi tô lại ô khác.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1">
        {choice.map((q) => (
          <div
            key={q.id}
            className="flex items-center gap-2 border-b border-dotted border-black/30 py-1"
          >
            <span className="w-8 shrink-0 text-right font-medium text-[13px]">
              {q.number}.
            </span>
            <div className="flex gap-2.5">
              {Array.from({ length: maxOptions }, (_, i) => (
                <span
                  key={i}
                  className="inline-flex size-5 items-center justify-center rounded-full border border-black text-[11px]"
                >
                  {optionLetter(i)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
