/** Gợi ý code kebab-case từ label tiếng Việt (fold dấu, đ→d). Chỉ là gợi ý — admin sửa được trước khi tạo. */
export function suggestCode(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (c) => (c === "đ" ? "d" : "D"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
