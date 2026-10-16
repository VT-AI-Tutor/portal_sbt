/**
 * Ô viết bài giải có công thức — MỘT trường duy nhất.
 *
 * Trước đây tính năng này là hai ô cạnh nhau: một ô soạn công thức, một ô viết
 * văn xuôi. Học sinh phải nhớ gõ ở đâu, và không thấy bài giải liền mạch. Giờ chỉ
 * còn một trường MathLive ở `default-mode="text"`: văn xuôi là mặc định, nút bàn
 * phím của chính trường mở bàn phím công thức, công thức nằm ngay trong dòng chữ.
 *
 * Cố ý KHÔNG dùng hộp thoại và KHÔNG dùng `core/ui`: thư mục `players/` được chép
 * nguyên văn sang các repo học sinh, nơi `core/ui/Modal` không tồn tại.
 */
import React, { useEffect, useRef } from "react";
import { MathField, type MathFieldHandle } from "@/core/math/MathField";
import { useSkin } from "@/core/exercise/skin";
import { MATH_FIELD_AS_INPUT, MathFieldChromeStyles } from "./math-field-chrome";

export interface EssaySolutionFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  /** Số dòng lúc ô còn trống, giống `rows` của ô tự luận thường. */
  rows?: number;
}

/**
 * Bàn phím ảo của MathLive là MỘT thể dùng chung cho cả trang, lấy qua `window`.
 *
 * Đọc rời ra thế này để chỗ dùng không phụ thuộc khai báo kiểu toàn cục của
 * MathLive, và để trang không có bàn phím (test chạy ngoài trình duyệt) chỉ nhận
 * `undefined` thay vì ném lỗi.
 */
type VirtualKeyboardLike = {
  visible: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

const virtualKeyboard = (): VirtualKeyboardLike | undefined => {
  if (typeof window === "undefined") return undefined;
  const vk = (window as unknown as { mathVirtualKeyboard?: VirtualKeyboardLike })
    .mathVirtualKeyboard;
  return vk && typeof vk.addEventListener === "function" ? vk : undefined;
};

/**
 * Số lần lùi ra khỏi nhóm công thức khi đóng bàn phím.
 *
 * Đủ cho công thức lồng nhau ở mức bài phổ thông (phân số trong phân số, luỹ
 * thừa của một phân số). Lệnh này KHÔNG thoát khỏi `\displaylines`, nên bài
 * nhiều dòng không bị đẩy con trỏ ra khỏi môi trường — đã kiểm trên trình duyệt.
 */
const MAX_NESTED_GROUPS = 3;

export const EssaySolutionField: React.FC<EssaySolutionFieldProps> = ({
  value,
  onChange,
  onBlur,
  disabled = false,
  ariaLabel,
  placeholder,
  className,
  rows = 4,
}) => {
  const skin = useSkin();
  const fieldRef = useRef<MathFieldHandle>(null);
  const focusedRef = useRef(false);

  /**
   * Mở bàn phím là chuyển sang chế độ toán, đóng lại là về chế độ chữ.
   *
   * Ở chế độ chữ, gõ `1/2` chỉ ra "1/2"; ở chế độ toán, chính phím ấy dựng ngay
   * phân số. Trường mặc định là chế độ chữ vì bài giải chủ yếu là văn xuôi, nên
   * nếu không có bước này thì học sinh KHÔNG có lối vào phân số nào nhìn thấy
   * được — đúng chỗ nghẽn đã báo. Nút bàn phím là nút duy nhất trên ô, nên nó
   * cũng là chỗ tự nhiên để mang nghĩa "giờ tôi viết công thức".
   *
   * Bàn phím dùng chung cả trang nên chỉ ô đang có tiêu điểm mới đổi chế độ.
   */
  useEffect(() => {
    const vk = virtualKeyboard();
    if (!vk) return;
    const handleToggle = () => {
      if (!focusedRef.current || disabled) return;
      if (vk.visible) {
        fieldRef.current?.executeCommand(["switchMode", "math"]);
        return;
      }
      // Đóng bàn phím mà con trỏ còn KẸT TRONG công thức thì `switchMode` không
      // ăn: viết `1/2` xong đóng bàn phím rồi gõ tiếp ra `\frac12ab` — chữ bị
      // nuốt vào phân số và mất dấu cách. `moveAfterParent` đưa con trỏ ra khỏi
      // nhóm đang đứng, và gọi thừa khi đã ở ngoài cùng thì không đổi gì.
      for (let level = 0; level < MAX_NESTED_GROUPS; level += 1) {
        fieldRef.current?.executeCommand("moveAfterParent");
      }
      fieldRef.current?.executeCommand(["switchMode", "text"]);
    };
    vk.addEventListener("virtual-keyboard-toggle", handleToggle);
    return () => vk.removeEventListener("virtual-keyboard-toggle", handleToggle);
  }, [disabled]);

  /**
   * Enter xuống dòng.
   *
   * MathLive chỉ ngắt dòng BÊN TRONG một môi trường nhiều dòng; ở ngoài, `\\` chỉ
   * là ký tự chết và Enter không làm gì. `addRowAfter` vừa tạo môi trường
   * `\displaylines` từ nội dung phẳng vừa thêm hàng, nên một lệnh là đủ cho cả
   * dòng thứ hai lẫn các dòng sau.
   *
   * Rồi chuyển về chế độ chữ: mặc định BÊN TRONG môi trường là chế độ toán, mà gõ
   * văn xuôi ở đó ra "Maiphaitra" — mất dấu cách, chữ nghiêng kiểu biến số, và
   * không báo lỗi gì. Bài giải chủ yếu là chữ nên chữ phải là mặc định.
   */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey) return;
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    fieldRef.current?.executeCommand("addRowAfter");
    fieldRef.current?.executeCommand(["switchMode", "text"]);
  };

  /**
   * Ô rỗng nhận tiêu điểm thì đặt con trỏ ở chế độ chữ.
   *
   * `defaultMode` một mình KHÔNG đủ: đặt lúc mount không dính, con trỏ vẫn nằm ở
   * chế độ toán và dòng đầu học sinh gõ ra "Giabobutlongla:" — mất hết dấu cách,
   * không báo lỗi gì. Phải chuyển đúng lúc trường được focus.
   *
   * Trừ khi bàn phím công thức đang mở: khi ấy học sinh vừa chọn viết công thức,
   * kéo về chế độ chữ sau lưng họ là lấy mất phân số vừa mở ra.
   */
  const handleFocus = () => {
    focusedRef.current = true;
    if (disabled || value || virtualKeyboard()?.visible) return;
    fieldRef.current?.executeCommand(["switchMode", "text"]);
  };

  const handleBlur = () => {
    focusedRef.current = false;
    onBlur?.();
  };

  return (
    <div
      onKeyDownCapture={handleKeyDown}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
    >
      <MathFieldChromeStyles />
      <MathField
        ref={fieldRef}
        value={value}
        onChange={onChange}
        disabled={disabled}
        defaultMode="text"
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        // Thẻ `math-field` là inline-block và co đúng bằng nội dung: để nguyên thì
        // ô rộng 240px trong khung 333px và cao một dòng, nhìn ra một ô nhập ngắn
        // chứ không ra chỗ viết bài. Đặt bằng style chứ không bằng lớp tiện ích để
        // không phụ thuộc lớp mà skin truyền vào có `w-full` hay không.
        //
        // `1.6em` là chiều cao một dòng, `1.5rem` là phần đệm dọc của ô tự luận
        // (`py-3`) — hai số này bám theo `textareaClass`, đổi bên ấy thì đổi ở đây.
        style={{ display: "block", width: "100%", minHeight: `calc(${rows} * 1.6em + 1.5rem)` }}
        className={`${MATH_FIELD_AS_INPUT} ${
          className ??
          (skin.input?.("idle") ??
            `rounded-2xl border-4 border-violet-300 bg-white px-4 py-3
             text-lg text-slate-800 outline-none transition-colors
             focus-within:border-violet-500`)
        }`}
      />
    </div>
  );
};
