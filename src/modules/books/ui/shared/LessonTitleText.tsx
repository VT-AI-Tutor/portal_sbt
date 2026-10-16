import { RichTextValue } from "@/core/rich-text/RichTextValue";

/**
 * Các tên tác phẩm cần giữ kiểu chữ theo mục lục sách in.
 *
 * CẦU TẠM, sẽ gỡ: dùng cho nội dung đã nhập trước khi studio cho biên tập tự in
 * nghiêng. Tiêu đề nào đã mang thẻ từ studio thì đi nhánh rich-text bên dưới và
 * không đụng tới bảng này. Khi mọi tiêu đề cần nghiêng đã được soạn lại trong
 * studio, xoá hẳn phần này.
 */
const ITALIC_PHRASE = /(Ánh trăng)/giu;
const EXACT_ITALIC_PHRASE = /^Ánh trăng$/iu;

/** Tiêu đề đã mang thẻ định dạng từ studio chưa? */
function hasInlineMarkup(title: string): boolean {
  return /<\/?(?:em|strong|i|b)>/i.test(title);
}

/**
 * Render tiêu đề bài dưới dạng React node an toàn.
 *
 * Đây là điểm thay thế duy nhất mà bản đầu của component này đã chừa sẵn cho lúc
 * API có metadata rich-text — giờ có rồi: studio cho biên tập in nghiêng tên tác
 * phẩm, và `title` mang theo `<em>`/`<strong>`. `RichTextValue` là ranh giới hiển
 * thị an toàn dùng chung (lọc whitelist inline), không phải nhét HTML thô vào DOM.
 *
 * Nội dung nhập từ trước chưa có thẻ, nên bảng cụm cứng ở trên vẫn chạy cho
 * chúng — gỡ bảng ngay bây giờ là mất chữ nghiêng đang hiện trên site.
 */
export function LessonTitleText({ title }: { title: string }) {
  if (hasInlineMarkup(title)) {
    return <RichTextValue value={title} />;
  }

  return (
    <>
      {title
        .split(ITALIC_PHRASE)
        .map((part, index) =>
          EXACT_ITALIC_PHRASE.test(part) ? (
            <em key={`${part}-${index}`}>{part}</em>
          ) : (
            part
          ),
        )}
    </>
  );
}
