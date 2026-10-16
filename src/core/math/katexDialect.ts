/**
 * Một cây cầu giữa HAI bộ máy công thức mà app đang dùng.
 *
 * Tác giả soạn công thức trong ô MathLive (`MathField`), còn màn hình đọc —
 * xem trước khi soạn, khối nội dung, đề bài trong player — đều dựng bằng KaTeX.
 * MathLive nói một phương ngữ LaTeX RỘNG HƠN: nó có sẵn những lệnh ngữ nghĩa mà
 * KaTeX không có, và khi tác giả bấm nút trên bàn phím ảo thì chính những lệnh
 * đó được ghi vào dữ liệu.
 *
 * KaTeX gặp lệnh lạ thì KHÔNG báo lỗi — nó in tên lệnh ra bằng chữ đỏ giữa công
 * thức. Nên một bài soạn hoàn toàn đúng quy trình vẫn có thể tới tay người đọc
 * với chữ `\imaginaryI` đỏ chóe nằm giữa dấu tích phân. Lỗi câm: không log,
 * không cảnh báo, chỉ người đọc mới thấy.
 *
 * Đây là chỗ dịch. Dịch ở tầng dựng hình, KHÔNG sửa dữ liệu tác giả: MathLive
 * vẫn phải đọc lại được đúng công thức nó đã ghi (ô nhập của `MathClozePlayer`
 * chấm điểm dựa trên `\placeholder[id]{}` nguyên bản).
 *
 * Phạm vi phủ được khoá bằng `katexDialect.coverage.guard.test.ts`: nó đọc
 * chính hai từ điển trong `node_modules/mathlive`, tính lại tập lệnh KaTeX
 * không dựng nổi, và bắt lỗi nếu có lệnh nào không nằm trong bảng dưới hoặc
 * trong danh sách miễn trừ có lý do. Nâng phiên bản MathLive mà lòi lệnh mới là
 * test đỏ ngay, không đợi người đọc phát hiện.
 */
import { latexWithoutPlaceholders } from "./mathPlaceholders";

/**
 * Lệnh MathLive → lệnh KaTeX tương đương, nạp qua tuỳ chọn `macros` của KaTeX.
 *
 * Vế phải chép ĐÚNG theo từ điển macro của chính MathLive, nên hai bộ máy dựng
 * ra cùng một hình — không phải "trông na ná" do người dịch tự nghĩ ra.
 *
 * TÊN LỆNH PHÂN BIỆT HOA THƯỜNG, và MathLive không theo một lối viết duy nhất:
 * hằng số thì camelCase (`\differentialD`) nhưng ký hiệu sai phân lại viết
 * thường tất (`\differencedelta`). Gõ sai một chữ là dòng macro không bao giờ
 * khớp, mà test vẫn xanh vì nó tự kiểm chứng cái tên bịa ra — nên tên phải chép
 * từ `mathlive.mjs`, đừng suy ra.
 */
const MATHLIVE_UPSTREAM_MACROS: Readonly<Record<string, string>> = Object.freeze({
  // Hằng số toán học — chữ ĐỨNG theo ISO 80000-2, phân biệt với biến số nghiêng.
  "\\imaginaryI": String.raw`\mathrm{i}`,
  "\\imaginaryJ": String.raw`\mathrm{j}`,
  "\\exponentialE": String.raw`\mathrm{e}`,
  "\\differentialD": String.raw`\mathrm{d}`,
  "\\capitalDifferentialD": String.raw`\mathrm{D}`,
  "\\rd": String.raw`\mathrm{d}`,
  "\\rD": String.raw`\mathrm{D}`,
  "\\odif": String.raw`\mathrm{d}`,

  // Tập số và kiểu chữ đặc biệt (ℕ ℤ ℚ ℝ ℂ, script, gothic).
  "\\CC": String.raw`\mathbb{C}`,
  "\\EE": String.raw`\exists`,
  "\\NN": String.raw`\mathbb{N}`,
  "\\QQ": String.raw`\mathbb{Q}`,
  "\\RR": String.raw`\mathbb{R}`,
  "\\ZZ": String.raw`\mathbb{Z}`,
  "\\doubleStruckCapitalN": String.raw`\mathbb{N}`,
  "\\doubleStruckCapitalP": String.raw`\mathbb{P}`,
  "\\doubleStruckCapitalQ": String.raw`\mathbb{Q}`,
  "\\doubleStruckCapitalR": String.raw`\mathbb{R}`,
  "\\doubleStruckCapitalZ": String.raw`\mathbb{Z}`,
  "\\gothicCapitalC": String.raw`\mathfrak{C}`,
  "\\gothicCapitalH": String.raw`\mathfrak{H}`,
  "\\gothicCapitalI": String.raw`\mathfrak{I}`,
  "\\gothicCapitalR": String.raw`\mathfrak{R}`,
  "\\scriptCapitalE": String.raw`\mathscr{E}`,
  "\\scriptCapitalH": String.raw`\mathscr{H}`,
  "\\scriptCapitalL": String.raw`\mathscr{L}`,

  // Tên hàm — MathLive dựng bằng \operatorname, KaTeX cũng hiểu nguyên vế phải.
  "\\arccosh": String.raw`\operatorname{arccosh}`,
  "\\arccsc": String.raw`\operatorname{arccsc}`,
  "\\arccsch": String.raw`\operatorname{arccsch}`,
  "\\arcosh": String.raw`\operatorname{arcosh}`,
  "\\arcsec": String.raw`\operatorname{arcsec}`,
  "\\arcsech": String.raw`\operatorname{arcsech}`,
  "\\arctanh": String.raw`\operatorname{arctanh}`,
  "\\arsinh": String.raw`\operatorname{arsinh}`,
  "\\artanh": String.raw`\operatorname{artanh}`,
  "\\bessel": String.raw`\operatorname{bessel}`,
  "\\erf": String.raw`\operatorname{erf}`,
  "\\erfc": String.raw`\operatorname{erfc}`,
  "\\fft": String.raw`\operatorname{fft}`,
  "\\lb": String.raw`\operatorname{lb}`,
  "\\lcm": String.raw`\operatorname{lcm}`,
  "\\mean": String.raw`\operatorname{mean}`,
  "\\median": String.raw`\operatorname{median}`,
  "\\randomInteger": String.raw`\operatorname{randomInteger}`,
  "\\randomReal": String.raw`\operatorname{randomReal}`,
  "\\sech": String.raw`\operatorname{sech}`,

  // Ký hiệu, toán tử và lối viết tắt còn lại của phương ngữ MathLive.
  "\\Approxcolon": String.raw`\mathrel{\approx\mathrel{\mkern-1.2mu}\dblcolon}`,
  "\\Simcolon": String.raw`\mathrel{\sim\mathrel{\mkern-1.2mu}\dblcolon}`,
  "\\TT": String.raw`\top`,
  "\\and": String.raw`\land`,
  "\\approaches": String.raw`\to`,
  "\\asterisk": String.raw`\ast`,
  "\\del": String.raw`\partial`,
  "\\divide": String.raw`\div`,
  "\\grad": String.raw`\nabla`,
  "\\infinity": String.raw`\infty`,
  "\\nn": String.raw`\cap`,
  "\\nnn": String.raw`\bigcap`,
  "\\of": String.raw`\circ`,
  "\\or": String.raw`\lor`,
  "\\prop": String.raw`\propto`,
  "\\union": String.raw`\cup`,
  "\\uu": String.raw`\cup`,
  "\\uuu": String.raw`\bigcup`,
  "\\vv": String.raw`\vee`,
  "\\vvv": String.raw`\bigvee`,
  "\\xx": String.raw`\times`,
});

/**
 * Ký hiệu MathLive có mà KaTeX không có SẴN lệnh tương ứng.
 *
 * Đây là bảng ánh xạ TAY, nên mỗi dòng phải nói được nghĩa nó giữ lại:
 * - Có lệnh KaTeX cùng nghĩa thì dùng lệnh đó (`\divides` → `\mid`).
 * - Không có thì dựng lại hình (`\questeq` → `\overset{?}{=}`).
 * - Không dựng lại được thì in thẳng ký tự Unicode trong `\text{…}`, kèm
 *   `\mathord`/`\mathrel` để khoảng cách quanh nó vẫn đúng loại nguyên tử.
 *   Chữ do phông của trình duyệt vẽ, không phải phông toán của KaTeX — chấp
 *   nhận được, vì thà đúng ký hiệu còn hơn một dòng chữ đỏ.
 */
const MATHLIVE_SYMBOL_MACROS: Readonly<Record<string, string>> = Object.freeze({
  // Sai phân hữu hạn. MathLive viết thường cả cụm — xem ghi chú hoa thường ở trên.
  "\\differencedelta": String.raw`\Delta`,
  // Quan hệ chia hết và song song: hai tên, cùng một ký hiệu.
  "\\divides": String.raw`\mid`,
  "\\mvert": String.raw`\mid`,
  "\\mVert": String.raw`\|`,
  // Logic và tập hợp.
  "\\biconditional": String.raw`\longleftrightarrow`,
  "\\nor": String.raw`\veebar`,
  "\\nsubset": String.raw`\not\subset`,
  "\\nsupset": String.raw`\not\supset`,
  "\\Colon": String.raw`\dblcolon`,
  // Các dấu bằng có chú thích — dựng lại bằng \overset thay vì một ký tự rời.
  "\\measeq": String.raw`\overset{\text{def}}{=}`,
  "\\eqdef": String.raw`\overset{\text{def}}{=}`,
  "\\questeq": String.raw`\overset{?}{=}`,
  // Dấu phẩy trên kép (đơn vị giây, phút góc).
  "\\doubleprime": String.raw`{}^{\prime\prime}`,
  "\\backdoubleprime": String.raw`{}^{\backprime\backprime}`,
  // Không có lệnh KaTeX nào tương ứng — in ký tự Unicode.
  "\\parallelogram": String.raw`\mathord{\text{▱}}`,
  "\\euro": String.raw`\mathord{\text{€}}`,
  "\\originalof": String.raw`\mathrel{\text{⊶}}`,
  "\\laplace": String.raw`\mathrel{\text{⊶}}`,
  "\\Laplace": String.raw`\mathrel{\text{⊷}}`,
  "\\roundimplies": String.raw`\mathrel{\text{⥰}}`,
  "\\twoheadrightarrowtail": String.raw`\mathrel{\text{⤖}}`,
  "\\nvrightarrow": String.raw`\mathrel{\text{⇸}}`,
  "\\nvtwoheadrightarrow": String.raw`\mathrel{\text{⤀}}`,
  "\\nvrightarrowtail": String.raw`\mathrel{\text{⤔}}`,
  "\\nvtwoheadrightarrowtail": String.raw`\mathrel{\text{⤗}}`,
  // Mẫu chèn của bàn phím ảo. `#?` của MathLive là Ô NHẮC soạn thảo chứ không
  // phải tham số, nên các lệnh này gần như không nằm trong TeX đã lưu; vẫn khai
  // với một tham số để nếu có lọt ra thì cũng dựng đúng hình.
  "\\ceil": String.raw`\left\lceil #1 \right\rceil`,
  "\\floor": String.raw`\left\lfloor #1 \right\rfloor`,
  "\\cbrt": String.raw`\sqrt[3]{#1}`,
});

/**
 * Lệnh MathLive CỐ Ý không dịch — guard test đọc danh sách này, nên mỗi tên ở
 * đây là một lời khai có lý do, không phải chỗ quét rác.
 *
 * - `yellow` `magenta` `black` `grey` `lime` `teal` `cyan` `indigo`: không phải
 *   lệnh toán. Vế phải của chúng là mã màu (`#ffc02b`), dùng cho `\textcolor`
 *   của MathLive; dịch sang KaTeX là dịch sai loại.
 * - `anglr` `anglk`: dựng bằng `\enclose` — KaTeX không có cơ chế này, và vẽ
 *   lại khung actuarial bằng tay thì sai hình hơn là bỏ.
 * - `defaulthyphenchar` `defint`: một cái là tham số xếp chữ của TeX, một cái là
 *   mẫu chèn `\int_{#?}^{#?}` — cả hai không mang nghĩa toán để dịch.
 */
export const KATEX_UNSUPPORTED_MATHLIVE_COMMANDS: readonly string[] = Object.freeze([
  "yellow",
  "magenta",
  "black",
  "grey",
  "lime",
  "teal",
  "cyan",
  "indigo",
  "anglr",
  "anglk",
  "defaulthyphenchar",
  "defint",
]);

const MATHLIVE_KATEX_MACROS: Readonly<Record<string, string>> = Object.freeze({
  ...MATHLIVE_UPSTREAM_MACROS,
  ...MATHLIVE_SYMBOL_MACROS,
});

/**
 * Bảng macro cho MỘT lần dựng — luôn là bản sao mới, không bao giờ là bảng gốc.
 *
 * KaTeX GHI vào object `macros` trong lúc phân tích: dựng `\begin{matrix}` là nó
 * đặt thêm `\cr` vào đó. Truyền thẳng bảng gốc (đã `Object.freeze`) thì KaTeX ném
 * `TypeError: Cannot add property \cr, object is not extensible` — mọi công thức
 * có ma trận sẽ hỏng. Truyền một object dùng chung không đóng băng thì cũng
 * không xong: định nghĩa rò từ công thức này sang công thức khác.
 *
 * Nên: bảng gốc đóng băng để không ai sửa nhầm, và mỗi lần dựng lấy một bản sao.
 */
export function katexMacros(): Record<string, string> {
  return { ...MATHLIVE_KATEX_MACROS };
}

/**
 * Hạ một công thức tác giả soạn xuống dạng KaTeX dựng được trọn vẹn.
 *
 * `\placeholder` KHÔNG nằm trong bảng macro trên vì nó mang tham số tuỳ chọn
 * trong ngoặc vuông, mà cơ chế macro của KaTeX không bóc được — đặt macro cho
 * nó thì `[blank_1]` rò ra màn hình thành chữ. Phải xử lý bằng một lượt quét
 * riêng, xem {@link latexWithoutPlaceholders}.
 */
export function katexSafeLatex(latex: string): string {
  return latexWithoutPlaceholders(latex);
}
