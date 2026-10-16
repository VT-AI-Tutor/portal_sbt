/**
 * XUẤT ĐỀ RA TỆP WORD (PAPER-R16) — thứ giáo viên Việt Nam thật sự cần để sửa
 * lại đề rồi đưa vào hồ sơ chuyên môn.
 *
 * QUYẾT ĐỊNH KỸ THUẬT (2026-08-20): tệp là **HTML tương thích Word, đuôi
 * `.doc`**, không phải `.docx` dựng bằng thư viện.
 *
 * Vì sao: `.docx` là một kho nén nhiều phần, muốn sinh nó phải kéo thêm thư
 * viện và tự dựng quan hệ giữa các phần — trong khi Word mở HTML có khai báo
 * `xmlns:w` như tài liệu Word bình thường, sửa và lưu lại thành `.docx` được.
 * Quan trọng hơn: **công thức toán chuyển sang MathML**, và Word 2016 trở lên
 * NHẬN MathML thành công thức gốc sửa được ngay trong trình soạn thảo. Đường
 * `.docx` mà không dựng OMML thì công thức lại thành ảnh chết. KaTeX vốn đã là
 * phụ thuộc của kho này và xuất được MathML, nên đường này không thêm thư viện
 * nào mà lại cho kết quả sửa được.
 *
 * Đánh đổi đã biết: Word hiện hộp thoại xác nhận khi mở tệp `.doc` là HTML ở
 * vài cấu hình, và bố cục phức tạp (cột báo, khung viền lồng nhau) không sang
 * trọn vẹn. Đề kiểm tra thì chỉ có đoạn văn, danh sách và bảng — vừa đúng phần
 * HTML sang Word tốt nhất.
 */
import katex from "katex";
import { katexMacros, katexSafeLatex } from "@/core/math/katexDialect";
import { tokenizeInlineMathText } from "@/core/math/inlineMathTextTokens";
import { KIND_LABEL } from "@/core/lib/paperKind";
import type { TeacherPaper } from "@/modules/teacher/api/teacherPaperApi";
import {
  answerLabel,
  explanationOf,
  optionLetter,
  optionText,
  preparePrintablePaper,
  type PrintQuestion,
} from "@/modules/teacher/lib/paperPrint";

/**
 * Chuyển một chuỗi có công thức thành HTML cho Word: chữ thường giữ nguyên,
 * đoạn công thức thành MathML.
 */
export function authoredTextToWordHtml(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";

  return tokenizeInlineMathText(value)
    .map((token) => {
      if (token.kind === "text") return escapeHtml(token.value);
      if (token.kind === "fraction") {
        // Phân số Unicode (½, ¾…) mang tử/mẫu là SỐ. Word dựng được phân số
        // thật từ MathML, nên đi cùng đường với công thức thay vì ghép sup/sub.
        return latexToMathml(`\\frac{${token.numerator}}{${token.denominator}}`);
      }
      return latexToMathml(token.latex);
    })
    .join("");
}

/**
 * KaTeX xuất `htmlAndMathml` — bản HTML để trình duyệt vẽ, bản MathML cho công
 * cụ khác. Word chỉ hiểu phần MathML, còn phần HTML của KaTeX (hàng chục thẻ
 * span có lớp) sang Word thành một mớ ký tự rời. Nên lấy đúng phần MathML.
 */
function latexToMathml(latex: string): string {
  try {
    // Cùng cây cầu MathLive → KaTeX với màn hình học sinh: phiếu in không được
    // phép có `\imaginaryI` nằm giữa công thức chỉ vì đi đường khác (katexDialect).
    const markup = katex.renderToString(katexSafeLatex(latex), {
      output: "mathml",
      throwOnError: false,
      strict: "ignore",
      trust: false,
      macros: katexMacros(),
    });
    const mathml = markup.match(/<math[\s\S]*?<\/math>/)?.[0];
    // Không lấy được MathML thì trả lại chính công thức gốc — giáo viên vẫn đọc
    // được và sửa được, hơn hẳn một khoảng trống.
    if (!mathml) return escapeHtml(latex);

    // KaTeX kèm mã TeX gốc trong <annotation> để công cụ khác đọc lại được.
    // Word bỏ qua thẻ đó, nhưng công cụ chuyển đổi khác thì có thể in nó ra
    // thành chữ — và "\frac{1}{2}" nằm chình ình giữa đề là đúng thứ cả đường
    // MathML này sinh ra để tránh. Cắt bỏ cho chắc.
    return mathml.replace(/<annotation[\s\S]*?<\/annotation>/g, "");
  } catch {
    return escapeHtml(latex);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface WordExportOptions {
  schoolName?: string;
  /** Kèm trang đáp án và hướng dẫn chấm vào cuối tệp. */
  includeAnswerKey?: boolean;
}

/** Dựng toàn bộ nội dung tệp Word cho một đề. */
export function buildPaperWordHtml(
  paper: TeacherPaper,
  options: WordExportOptions = {},
): string {
  const { choice, written, totalPoints } = preparePrintablePaper(paper);
  const hasBoth = choice.length > 0 && written.length > 0;

  const header = `
    <table style="width:100%;border:none"><tr>
      <td style="width:50%;text-align:center;border:none">
        ${escapeHtml(options.schoolName ?? "TRƯỜNG …………………")}<br/>
        <b>${paper.subject ? `TỔ ${escapeHtml(paper.subject.toUpperCase())}` : "TỔ ……………………"}</b>
      </td>
      <td style="width:50%;text-align:center;border:none">
        <b>${escapeHtml(KIND_LABEL[paper.kind].toUpperCase())}</b><br/>
        Môn: ${escapeHtml(paper.subject ?? "…………")}${paper.level ? ` — Lớp ${escapeHtml(paper.level)}` : ""}<br/>
        ${paper.duration_minutes ? `Thời gian làm bài: ${paper.duration_minutes} phút` : ""}
      </td>
    </tr></table>
    <p style="text-align:center;font-size:14pt"><b>${escapeHtml(paper.title)}</b></p>
    <p>Họ và tên: ………………………………………………… Lớp: ………………</p>
    <hr/>`;

  const sections = [
    choice.length > 0
      ? `${hasBoth ? "<p><b>PHẦN I. TRẮC NGHIỆM</b></p>" : ""}${choice.map(choiceToHtml).join("")}`
      : "",
    written.length > 0
      ? `${hasBoth ? "<p><b>PHẦN II. TỰ LUẬN</b></p>" : ""}${written.map(writtenToHtml).join("")}`
      : "",
  ].join("");

  const answerKey = options.includeAnswerKey
    ? buildAnswerKeyHtml(paper, choice, written)
    : "";

  return wrapWordDocument(`
    ${header}
    ${sections}
    <p style="text-align:center"><i>— Hết — (Tổng ${totalPoints} điểm)</i></p>
    ${answerKey}
  `);
}

function choiceToHtml(q: PrintQuestion): string {
  const options = q.options
    .map(
      (opt, i) =>
        `<p style="margin-left:24pt">${optionLetter(i)}. ${authoredTextToWordHtml(optionText(opt))}</p>`,
    )
    .join("");
  return `<p><b>Câu ${q.number}.</b> ${authoredTextToWordHtml(q.content)}${
    q.points ? ` <i>(${q.points} điểm)</i>` : ""
  }</p>${options}`;
}

function writtenToHtml(q: PrintQuestion): string {
  // Chừa chỗ làm bài theo mức điểm, cùng quy tắc với bản in trên màn hình.
  const lines = Math.max(3, Math.round((Number(q.points) || 1) * 3));
  const blanks = Array.from(
    { length: lines },
    () => '<p style="margin-left:24pt">………………………………………………………………………………</p>',
  ).join("");
  return `<p><b>Câu ${q.number}.</b> ${authoredTextToWordHtml(q.content)}${
    q.points ? ` <i>(${q.points} điểm)</i>` : ""
  }</p>${blanks}`;
}

function buildAnswerKeyHtml(
  paper: TeacherPaper,
  choice: PrintQuestion[],
  written: PrintQuestion[],
): string {
  const choiceRows =
    choice.length > 0
      ? `<table style="border-collapse:collapse" border="1">
          <tr><td><b>Câu</b></td>${choice.map((q) => `<td style="text-align:center">${q.number}</td>`).join("")}</tr>
          <tr><td><b>Đáp án</b></td>${choice.map((q) => `<td style="text-align:center"><b>${escapeHtml(answerLabel(q))}</b></td>`).join("")}</tr>
        </table>`
      : "";

  const writtenRows = written
    .map((q) => {
      const explanation = explanationOf(q);
      return `<p><b>Câu ${q.number}.</b> (${q.points} điểm)<br/>${
        explanation
          ? authoredTextToWordHtml(explanation)
          : `Đáp án: ${authoredTextToWordHtml(answerLabel(q))}`
      }</p>`;
    })
    .join("");

  return `
    <br style="page-break-before:always"/>
    <p style="text-align:center;font-size:14pt"><b>ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM</b></p>
    <p style="text-align:center">${escapeHtml(paper.title)}</p>
    ${choiceRows ? `<p><b>I. TRẮC NGHIỆM</b></p>${choiceRows}` : ""}
    ${writtenRows ? `<p><b>II. TỰ LUẬN</b></p>${writtenRows}` : ""}`;
}

/**
 * Vỏ tài liệu Word. Khai báo `xmlns:w` và khối `w:WordDocument` là thứ khiến
 * Word mở tệp như tài liệu của mình thay vì như một trang web.
 */
function wrapWordDocument(body: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 2cm 2cm 2cm 2.5cm; }
  body { font-family: "Times New Roman", serif; font-size: 13pt; line-height: 1.4; }
  p { margin: 0 0 6pt 0; }
  table { border-collapse: collapse; }
  td { padding: 3pt 6pt; }
</style>
</head>
<body>${body}</body>
</html>`;
}

/**
 * Tải tệp Word về máy giáo viên.
 *
 * Dùng `﻿` mở đầu: thiếu nó thì Word đọc tệp theo bảng mã hệ thống và mọi
 * dấu tiếng Việt thành ký tự lạ — lỗi kinh điển của đường xuất tệp.
 */
export function downloadPaperAsWord(
  paper: TeacherPaper,
  options: WordExportOptions = {},
): void {
  const html = buildPaperWordHtml(paper, options);
  const blob = new Blob(["﻿", html], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(paper.title)}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function safeFileName(title: string): string {
  const cleaned = title
    .normalize("NFC")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
  return cleaned === "" ? "de-kiem-tra" : cleaned;
}
