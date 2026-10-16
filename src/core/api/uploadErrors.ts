/**
 * 413 Request Entity Too Large — thân request vượt trần máy chủ nhận.
 *
 * Nhận diện theo MÃ HTTP chứ không dò chuỗi: thân 413 do gateway trả khi thì là
 * nguyên trang HTML của nginx, khi thì JSON tiếng Anh của tầng ứng dụng, khi
 * thì text thuần "413 Request Entity Too Large" — không câu nào đưa cho học
 * sinh đọc được, mà cũng không câu nào đoán trước được.
 *
 * Ba tầng API trong repo ném ba lớp lỗi khác nhau (`LcmsApiError.statusCode`,
 * `AssessmentApiError.statusCode`, `AuthApiError.status`) nhưng lớp nào cũng
 * giữ mã lại, nên chỉ cần đọc hai tên field đó là đủ cho cả ba.
 *
 * KHÔNG bắt được mọi trường hợp — và đây là giới hạn phải biết trước khi tin
 * vào nó: nginx thường ngắt kết nối NGAY KHI đang nhận body thay vì đọc hết rồi
 * trả 413, lúc ấy fetch reject bằng `TypeError: Failed to fetch` không mang mã
 * nào. Lớp chắc chắn vẫn là kiểm dung lượng TRƯỚC khi gửi; muốn làm được thế
 * thì phải biết trần thật của hạ tầng, hiện chưa ai chốt (mỗi nơi trong FE đang
 * tự đoán một số: 5MB ở avatar, 10MB ở UploadTask, không giới hạn ở chỗ còn lại).
 */
const PAYLOAD_TOO_LARGE_STATUS = 413;

/**
 * Câu chữ dùng chung cho mọi chỗ chạm 413 — muốn đổi thì sửa đúng dòng này,
 * không phải đi lùng từng màn.
 *
 * Câu này CỐ Ý nói ra lý do: bản chỉ có "thử lại nhé" khiến học sinh chọn lại
 * đúng file vừa rồi và hỏng tiếp thành vòng lặp. Còn thiếu mức trần cụ thể để
 * học sinh biết phải nén xuống bao nhiêu — bổ sung được khi hạ tầng chốt số
 * thật (xem ghi chú ở đầu file).
 */
export const PAYLOAD_TOO_LARGE_MESSAGE = "File quá lớn, em thử lại nhé!";

/** Lỗi vừa bắt được có phải 413 không (mọi tầng API trong repo). */
export function isPayloadTooLarge(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { statusCode, status } = error as {
    statusCode?: unknown;
    status?: unknown;
  };
  return (
    statusCode === PAYLOAD_TOO_LARGE_STATUS || status === PAYLOAD_TOO_LARGE_STATUS
  );
}
