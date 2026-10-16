/**
 * Xuất bảng đang xem ra tệp mở được bằng Excel.
 *
 * Dùng CSV chứ không kéo thêm thư viện .xlsx: gói sinh xlsx nhẹ nhất cũng thêm vài trăm KB vào
 * gói tải về, trong khi Excel mở CSV bình thường. Hai điều kiện để Excel (bản tiếng Việt trên
 * Windows) mở đúng, thiếu một là ra bảng lỗi font hoặc dồn hết vào một cột:
 *   1. BOM UTF-8 ở đầu tệp — thiếu thì tiếng Việt thành ký tự lạ.
 *   2. Khai báo `sep=;` ở dòng đầu và dùng dấu chấm phẩy — Excel theo bảng mã địa phương Việt
 *      Nam coi dấu phẩy là dấu thập phân, nên CSV phẩy bị dồn cột.
 */

/** Một ô: chuỗi, số, hoặc rỗng. */
export type CellValue = string | number | null | undefined;

export interface TableExport {
  /** Tên tệp, không cần đuôi. */
  filename: string;
  headers: string[];
  rows: CellValue[][];
}

const SEPARATOR = ";";

function cell(v: CellValue): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Bọc ngoặc kép khi có ký tự phá cấu trúc; nhân đôi ngoặc kép bên trong theo chuẩn CSV.
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv({ headers, rows }: Omit<TableExport, "filename">): string {
  const lines = [
    `sep=${SEPARATOR}`,
    headers.map(cell).join(SEPARATOR),
    ...rows.map((r) => r.map(cell).join(SEPARATOR)),
  ];

  // BOM viết dạng thoát (\uFEFF) chứ không phải ký tự thật: ký tự thật vô hình trong mã
  // nguồn, dễ bị xoá nhầm lúc sửa, và ESLint chặn (no-irregular-whitespace).
  return `\uFEFF${lines.join("\r\n")}`;
}

/** Tạo tệp và bấm tải xuống. Trả về tên tệp thật đã dùng (kèm ngày) để nơi gọi báo lại. */
export function downloadTable({ filename, headers, rows }: TableExport): string {
  const csv = buildCsv({ headers, rows });
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `${filename}-${stamp}.csv`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Thu hồi ở nhịp sau: thu ngay lập tức thì Safari huỷ luôn lượt tải đang bắt đầu.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return name;
}
