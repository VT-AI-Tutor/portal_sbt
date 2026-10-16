import type { ReactElement } from "react";
import type { Conclusion } from "./insights";

/**
 * Nội dung câu kết luận theo từng nhánh của Conclusion (trừ "empty", đã được
 * lọc ở component). Kiểu trả về ReactElement (không nhận undefined) buộc mọi
 * nhánh của switch phải return — nếu Task 3 thêm một `kind` mới mà nhánh này
 * chưa xử lý, TypeScript báo lỗi "lacks ending return statement" thay vì im
 * lặng bỏ sót (không dùng `default:` để tránh nuốt lỗi).
 */
function conclusionContent(conclusion: Exclude<Conclusion, { kind: "empty" }>): ReactElement {
  switch (conclusion.kind) {
    case "break":
      return (
        <>
          {"Em vững đến mức "}<strong>{conclusion.masteredLabel}</strong>
          {". Bắt đầu hụt ở "}<strong>{conclusion.breakLabel}</strong>{"."}
        </>
      );
    case "from_start":
      return (
        <>{"Em cần củng cố ngay từ mức "}<strong>{conclusion.firstLabel}</strong>{"."}</>
      );
    case "insufficient":
      return conclusion.masteredLabel ? (
        <>
          {"Em vững đến "}<strong>{conclusion.masteredLabel}</strong>
          {". Chưa đủ bài để đánh giá "}<strong>{conclusion.unscoredLabel}</strong>{"."}
        </>
      ) : (
        <>
          {"Chưa đủ bài để đánh giá "}<strong>{conclusion.unscoredLabel}</strong>
          {` — còn ${conclusion.remaining} câu nữa.`}
        </>
      );
    case "all_mastered":
      return <>{"Em đã vững cả các mức. Thử các bài nâng cao nhé."}</>;
  }
}

/** Khối A — dòng kết luận (spec §2): MỘT câu, một điểm mốc, không liệt kê số. */
export function ConclusionLine({ conclusion }: { conclusion: Conclusion }) {
  if (conclusion.kind === "empty") return null;
  return (
    <p data-testid="conclusion" className="text-lg md:text-xl text-foreground/90">
      {conclusionContent(conclusion)}
    </p>
  );
}
