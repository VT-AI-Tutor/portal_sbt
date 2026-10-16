/**
 * Hai dáng của một trường MathLive: biểu thức là NỘI DUNG, hay là Ô NHẬP.
 *
 * Phải viết bằng CSS thật chứ không phải lớp tiện ích, vì `::part()` là cửa duy
 * nhất chạm được vào shadow DOM của MathLive — nơi hai nút bàn phím và menu nằm.
 * (`menuItems = []` KHÔNG ẩn được nút menu, đã thử.)
 *
 * File nằm trong `players/` để đi cùng chuyến sync sang các repo học sinh, và cố
 * ý không phụ thuộc `core/ui`.
 */
import React from "react";

/**
 * Biểu thức là NỘI DUNG: không khung, không nền, chữ to, căn giữa như một dòng
 * toán trong sách. Dùng cho câu điền vào biểu thức — ở đó công thức bị khoá và
 * chỉ các ô trống mới nhận chữ, nên khoác khung ô nhập lên cả biểu thức là nói
 * sai với học sinh rằng gõ được ở mọi chỗ.
 *
 * Nút menu ẩn hẳn (chrome của trình soạn). Nút bàn phím chỉ hiện KHI Ô CÓ TIÊU
 * ĐIỂM: lúc đọc đề thì biểu thức sạch như một dòng toán, còn khi học sinh bấm vào
 * ô trống thì lối vào bàn phím công thức xuất hiện ngay cạnh. Ẩn hẳn nó thì gõ vẫn
 * được (bấm vào ô trống rồi gõ `1/2` ra phân số) nhưng KHÔNG AI ĐOÁN RA — đúng câu
 * hỏi đã nhận: "nhập công thức kiểu gì?".
 */
export const MATH_FIELD_AS_CONTENT = "evo-mf-content";

/** Ô NHẬP thật (học sinh gõ cả biểu thức): giữ khung, chỉ bỏ nút menu — menu là
 *  chrome của trình soạn (cắt/dán/thiết lập), không phải thứ học sinh cần. */
export const MATH_FIELD_AS_INPUT = "evo-mf-input";

const CSS = `
math-field.${MATH_FIELD_AS_CONTENT} {
  display: block;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 4px 0;
  font-size: 1.65rem;
  /* Canh TRÁI, không canh giữa: nhiều biểu thức xếp chồng thì dấu "=" thẳng hàng
     nhau, và biểu thức dài hơn khung vẫn bắt đầu từ chỗ đọc thay vì bị đẩy khuất
     đầu ra ngoài mép trái. */
  text-align: left;
}
/* Menu ẩn hẳn nên "display: none" được — không bao giờ phải dựng lại. */
math-field.${MATH_FIELD_AS_CONTENT}::part(menu-toggle),
math-field.${MATH_FIELD_AS_INPUT}::part(menu-toggle) {
  display: none;
}

/* Nút bàn phím thì ẩn/hiện bằng "visibility", KHÔNG bằng "display": muốn dựng lại
   thì phải biết MathLive dựng nút bằng display gì, mà đó là nội thất của thư viện
   (đo hôm nay ra "flex"). "display: revert" không cứu được — đã thử, nó trả về
   "block" của trình duyệt chứ không lấy lại giá trị trong shadow DOM. Cái giá của
   "visibility" là nút vẫn giữ chỗ khi ẩn: một khoảng hẹp ở mép phải một dòng trong
   suốt, đổi lại không còn dính vào chi tiết bên trong MathLive. */
math-field.${MATH_FIELD_AS_CONTENT}::part(virtual-keyboard-toggle) {
  visibility: hidden;
}
math-field.${MATH_FIELD_AS_CONTENT}:focus-within::part(virtual-keyboard-toggle) {
  visibility: visible;
}
@media (max-width: 640px) {
  math-field.${MATH_FIELD_AS_CONTENT} { font-size: 1.35rem; }
}
`;

/** Nhúng cùng bộ luật; nhiều player trên một trang thì các thẻ trùng nhau vô hại. */
export const MathFieldChromeStyles: React.FC = () => <style>{CSS}</style>;
