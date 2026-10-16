/**
 * Một định nghĩa duy nhất cho "sách đã công bố".
 *
 * GAP-036 ghi là "hai nguồn sự thật: workspace dùng is_active, danh sách dùng
 * status === 'published'". Kiểm chứng lại thì KHÔNG phải: máy chủ chỉ lưu một
 * trường books.status; is_active là giá trị suy ra chỉ-đọc, luôn bằng
 * status === 'published', và không có đường nào ghi được is_active riêng. Hai
 * bên không thể lệch nhau.
 *
 * Cái có thật là vị từ "đã công bố" bị chép ở nhiều nơi. Gom về một chỗ để khi
 * nghiệp vụ đổi (thêm trạng thái mới) chỉ phải sửa một điểm.
 *
 * Lưu ý nghiệp vụ: status là chuỗi tự do phía máy chủ, không phải enum. Mọi giá
 * trị khác "published" đều coi là chưa công bố (bản nháp) — đúng như trang Quản
 * lý sách vẫn hiểu.
 */
export function isPublishedBook(status: string | null | undefined): boolean {
  return status === "published";
}

/** Chưa công bố — gồm bản nháp và mọi trạng thái lạ khác. */
export function isDraftBook(status: string | null | undefined): boolean {
  return !isPublishedBook(status);
}
