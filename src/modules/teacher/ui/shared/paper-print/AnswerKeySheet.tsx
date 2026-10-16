import { InlineMathText } from "@/core/math/InlineMathText";
import { KIND_LABEL } from "@/core/lib/paperKind";
import type { TeacherPaper } from "@/modules/teacher/api/teacherPaperApi";
import {
  answerLabel,
  buildMatrixFromQuestions,
  explanationOf,
  preparePrintablePaper,
} from "@/modules/teacher/lib/paperPrint";

/** Bốn mức nhận thức — cột của bảng ma trận in kèm. Khớp `CognitiveLevels` phía máy chủ. */
const LEVELS = [
  { code: "biet", label: "Nhận biết" },
  { code: "hieu", label: "Thông hiểu" },
  { code: "vandung", label: "Vận dụng" },
  { code: "vandungcao", label: "Vận dụng cao" },
];

/**
 * TRANG ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM (PAPER-R16), kèm BẢNG MA TRẬN.
 *
 * Đây là bộ hồ sơ nhà trường luôn đòi nộp cùng đề — thiếu nó thì đề in ra chỉ
 * dùng được nửa việc.
 */
export function AnswerKeySheet({
  paper,
  topicLabels,
  className,
}: {
  paper: TeacherPaper;
  /**
   * Mã chủ đề → nhãn, để đè nhãn đông cứng trên câu (hiếm khi cần). Bỏ trống
   * thì dùng nhãn đã đông cứng cùng đề.
   */
  topicLabels?: Record<string, string>;
  className?: string;
}) {
  const { choice, written } = preparePrintablePaper(paper);
  const matrix = buildMatrixFromQuestions(
    paper.questions,
    LEVELS.map((l) => l.code),
  );
  const totals = LEVELS.map((level) =>
    matrix.reduce((sum, row) => sum + (row.counts[level.code] ?? 0), 0),
  );
  const grandTotal = totals.reduce((a, b) => a + b, 0);

  return (
    <article className={`paper-sheet bg-white text-black ${className ?? ""}`}>
      <header className="mb-4 text-center">
        <h1 className="text-lg font-bold uppercase">
          Đáp án và hướng dẫn chấm
        </h1>
        <div className="text-[13px]">
          {[
            KIND_LABEL[paper.kind],
            paper.title,
            paper.subject,
            paper.level ? `Lớp ${paper.level}` : null,
          ]
            .filter(Boolean)
            .join(" — ")}
        </div>
      </header>

      {matrix.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-1.5 font-bold">I. MA TRẬN ĐỀ</h2>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="border border-black p-1 text-left">Chủ đề</th>
                {LEVELS.map((l) => (
                  <th key={l.code} className="border border-black p-1">
                    {l.label}
                  </th>
                ))}
                <th className="border border-black p-1">Tổng câu</th>
                <th className="border border-black p-1">Tổng điểm</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.contentCode}>
                  <td className="border border-black p-1">
                    {topicLabels?.[row.contentCode] ?? row.label}
                  </td>
                  {LEVELS.map((l) => (
                    <td
                      key={l.code}
                      className="border border-black p-1 text-center"
                    >
                      {row.counts[l.code] || "—"}
                    </td>
                  ))}
                  <td className="border border-black p-1 text-center font-medium">
                    {row.total}
                  </td>
                  <td className="border border-black p-1 text-center font-medium">
                    {row.totalPoints}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="border border-black p-1">Tổng</td>
                {totals.map((n, i) => (
                  <td key={i} className="border border-black p-1 text-center">
                    {n || "—"}
                  </td>
                ))}
                <td className="border border-black p-1 text-center">
                  {grandTotal}
                </td>
                <td className="border border-black p-1 text-center">
                  {paper.total_points ?? "—"}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-1 text-[11px] italic">
            Bảng dựng từ chính các câu trong đề này.
          </p>
        </section>
      )}

      {choice.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-1.5 font-bold">II. ĐÁP ÁN TRẮC NGHIỆM</h2>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {chunk(choice, 10).map((group, rowIndex) => (
                <tr key={rowIndex} className="align-top">
                  <td className="border border-black p-1 font-medium w-16">
                    Câu
                  </td>
                  {group.map((q) => (
                    <td
                      key={q.id}
                      className="border border-black p-1 text-center"
                    >
                      {q.number}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full border-collapse text-[13px] mt-[-1px]">
            <tbody>
              {chunk(choice, 10).map((group, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="border border-black p-1 font-medium w-16">
                    Đáp án
                  </td>
                  {group.map((q) => (
                    <td
                      key={q.id}
                      className="border border-black p-1 text-center font-bold"
                    >
                      {answerLabel(q)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {written.length > 0 && (
        <section>
          <h2 className="mb-1.5 font-bold">III. HƯỚNG DẪN CHẤM TỰ LUẬN</h2>
          <ol className="space-y-2.5 text-[13px]">
            {written.map((q) => {
              const explanation = explanationOf(q);
              return (
                <li key={q.id} className="break-inside-avoid">
                  <div className="font-medium">
                    Câu {q.number}. ({q.points} điểm)
                  </div>
                  {explanation ? (
                    <div className="pl-4">
                      <InlineMathText value={explanation} />
                    </div>
                  ) : (
                    <div className="pl-4 italic text-black/60">
                      Đáp án: <InlineMathText value={answerLabel(q)} /> — giáo
                      viên tự cho thang điểm thành phần.
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </article>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
