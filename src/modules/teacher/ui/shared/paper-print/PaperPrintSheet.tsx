import { InlineMathText } from "@/core/math/InlineMathText";
import { KIND_LABEL } from "@/core/lib/paperKind";
import type { TeacherPaper } from "@/modules/teacher/api/teacherPaperApi";
import {
  optionLetter,
  optionText,
  preparePrintablePaper,
  type PrintQuestion,
} from "@/modules/teacher/lib/paperPrint";

/**
 * BẢN IN ĐỀ (PAPER-R16) — khuôn đề kiểm tra Việt Nam trên khổ A4.
 *
 * Không phải màn hình thu nhỏ lại: đầu đề có ô trường/lớp/họ tên/điểm, phần
 * trắc nghiệm tách khỏi phần tự luận, và câu tự luận chừa chỗ làm bài. Đây là
 * tờ giấy học sinh sẽ cầm.
 */
export function PaperPrintSheet({
  paper,
  schoolName,
  className,
}: {
  paper: TeacherPaper;
  schoolName?: string;
  className?: string;
}) {
  const { choice, written, droppedCount, totalPoints } =
    preparePrintablePaper(paper);
  const hasBothSections = choice.length > 0 && written.length > 0;

  return (
    <div className={className}>
      {droppedCount > 0 && (
        <div className="print:hidden mb-3 rounded-lg border-2 border-warning/40 bg-warning/10 p-2.5 text-sm">
          Bản in đã bỏ <strong>{droppedCount} câu</strong> thuộc dạng tương tác
          (kéo thả, nối, ô chữ…) vì giấy không diễn đạt được. Đề in ra còn{" "}
          {choice.length + written.length} câu.
        </div>
      )}

      <article className="paper-sheet bg-white text-black">
        <header className="mb-4">
          <div className="flex justify-between gap-6 text-[13px] leading-snug">
            <div className="text-center flex-1">
              <div className="uppercase">{schoolName ?? "TRƯỜNG …………………"}</div>
              <div className="font-bold uppercase">
                {paper.subject ? `Tổ ${paper.subject}` : "Tổ ……………………"}
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="font-bold uppercase">
                {KIND_LABEL[paper.kind]}
              </div>
              <div>
                Môn: {paper.subject || "…………"}
                {paper.level ? ` — Lớp ${paper.level}` : ""}
              </div>
              {paper.duration_minutes ? (
                <div>Thời gian làm bài: {paper.duration_minutes} phút</div>
              ) : null}
            </div>
          </div>

          <h1 className="mt-3 text-center text-lg font-bold uppercase">
            {paper.title}
          </h1>

          <div className="mt-3 flex items-end justify-between gap-4 text-[13px]">
            <div className="flex-1 space-y-1.5">
              <div>Họ và tên: ………………………………………………………………</div>
              <div>Lớp: ……………… Số báo danh: ………………</div>
            </div>
            <div className="w-28 shrink-0 border border-black text-center">
              <div className="border-b border-black py-0.5 text-xs">Điểm</div>
              <div className="h-12" />
            </div>
          </div>
        </header>

        {choice.length > 0 && (
          <section className="mb-5">
            {hasBothSections && (
              <h2 className="mb-2 font-bold">
                PHẦN I. TRẮC NGHIỆM{" "}
                <span className="font-normal">
                  ({choice.length} câu —{" "}
                  {choice.reduce((s, q) => s + (Number(q.points) || 0), 0)} điểm)
                </span>
              </h2>
            )}
            <ol className="space-y-3">
              {choice.map((q) => (
                <ChoiceQuestion key={q.id} question={q} />
              ))}
            </ol>
          </section>
        )}

        {written.length > 0 && (
          <section>
            {hasBothSections && (
              <h2 className="mb-2 font-bold">
                PHẦN II. TỰ LUẬN{" "}
                <span className="font-normal">
                  ({written.length} câu —{" "}
                  {written.reduce((s, q) => s + (Number(q.points) || 0), 0)}{" "}
                  điểm)
                </span>
              </h2>
            )}
            <ol className="space-y-4">
              {written.map((q) => (
                <WrittenQuestion key={q.id} question={q} />
              ))}
            </ol>
          </section>
        )}

        <footer className="mt-6 text-center text-[13px] italic">
          — Hết — (Tổng {totalPoints} điểm)
        </footer>
      </article>
    </div>
  );
}

function ChoiceQuestion({ question }: { question: PrintQuestion }) {
  return (
    <li className="break-inside-avoid">
      <div className="flex gap-1.5">
        <span className="font-bold shrink-0">Câu {question.number}.</span>
        <div className="flex-1">
          <InlineMathText value={question.content} />
          {question.points ? (
            <span className="ml-1 text-[12px] italic">
              ({question.points} điểm)
            </span>
          ) : null}
        </div>
      </div>
      {question.options.length > 0 && (
        <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 pl-8 text-[13px]">
          {question.options.map((opt, i) => (
            <div key={i} className="flex gap-1">
              <span className="font-medium">{optionLetter(i)}.</span>
              <InlineMathText value={optionText(opt)} />
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function WrittenQuestion({ question }: { question: PrintQuestion }) {
  // Chỗ trống chừa theo mức điểm: câu 2 điểm cần nhiều dòng hơn câu 0,5 điểm.
  // Chừa đều nhau thì hoặc học sinh viết tràn ra lề, hoặc tờ đề phí nửa trang.
  const lines = Math.max(3, Math.round((Number(question.points) || 1) * 3));

  return (
    <li className="break-inside-avoid">
      <div className="flex gap-1.5">
        <span className="font-bold shrink-0">Câu {question.number}.</span>
        <div className="flex-1">
          <InlineMathText value={question.content} />
          {question.points ? (
            <span className="ml-1 text-[12px] italic">
              ({question.points} điểm)
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-1.5 space-y-4 pl-8">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="border-b border-dotted border-black/50" />
        ))}
      </div>
    </li>
  );
}
