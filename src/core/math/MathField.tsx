import React, {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { MathfieldElement } from "mathlive";
import { latexTextPlaceholder } from "./latexTextPlaceholder";
import "mathlive";

export interface MathFieldHandle {
  /** Insert at the caret; false when MathLive has not upgraded the element. */
  insert: (latex: string) => boolean;
  focus: () => void;
  /**
   * Mark one `\placeholder[id]{}` prompt right or wrong. Only MathLive can paint
   * inside the formula, so per-blank feedback has to go through the element.
   */
  setPromptState: (
    id: string,
    state: "correct" | "incorrect" | undefined,
    locked?: boolean,
  ) => void;
  /**
   * Trạng thái ô trống ĐANG hiển thị, hoặc `undefined` khi chưa đọc được.
   *
   * MathLive tự xoá trạng thái mọi ô mỗi khi công thức được dựng lại, nên bên gọi
   * không được nhớ "đã ghi gì" mà phải hỏi lại phần tử.
   */
  getPromptState: (
    id: string,
  ) => { state: "correct" | "incorrect" | undefined; locked: boolean } | undefined;
  /** Chạy một lệnh MathLive (`addRowAfter`, `switchMode`…); false khi chưa dựng xong. */
  executeCommand: (command: string | [string, ...unknown[]]) => boolean;
}

export interface MathFieldProps {
  value: string;
  onChange: (latex: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /**
   * Fill-in-the-blank mode: the formula is locked but its `\placeholder[id]{}`
   * prompts stay editable.
   *
   * This sets the SAME `read-only` attribute as `disabled` — MathLive has one
   * flag, and "prompts stay editable" is what read-only already means. The two
   * names exist to say which intent a call site has; passing both is redundant.
   * Locking an individual prompt is a separate step (`setPromptState`).
   */
  readOnly?: boolean;
  /**
   * Chế độ gõ mặc định. `"text"` cho bài giải: văn xuôi là mặc định, học sinh bấm
   * bàn phím của trường khi cần công thức. Bỏ trống thì giữ mặc định của MathLive
   * (`math`), đúng cho ô chỉ nhập biểu thức.
   */
  defaultMode?: "text" | "math" | "inline-math";
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Chữ mờ lúc ô trống. Truyền văn xuôi thường — bên trong sẽ bọc `\text{}`.
   */
  placeholder?: string;
}

/**
 * Dấu phẩy thập phân kiểu Việt, đặt MỘT LẦN cho toàn bộ bề mặt toán.
 *
 * `decimalSeparator` là `static` — MathLive không cho đặt theo từng ô — nên nó
 * nhất định là biến toàn cục. Đặt ở đây, cửa duy nhất mà mọi bề mặt toán đi qua
 * (player, trình soạn, hộp thoại công thức), để hành vi giống nhau ở mọi nơi thay
 * vì phụ thuộc người dùng đã mở màn nào trước. Đặt lúc import cũng là sớm nhất có
 * thể, trước khi MathLive dựng compute engine của nó.
 *
 * Hệ quả đã cân nhắc: dấu phẩy đứng NGAY SAU một chữ số sẽ thành `{,}`, kể cả khi
 * tác giả định viết danh sách — `f(1, 2)` ra `f(1{,}2)`. Chấp nhận được với nội
 * dung tiếng Việt, nơi danh sách viết bằng dấu chấm phẩy (`f(1; 2)`) chính vì dấu
 * phẩy đã mang nghĩa thập phân.
 *
 * Vì sao phải là `{,}` chứ không phải dấu phẩy trần: KaTeX coi phẩy trần là dấu
 * ngắt câu và chèn thêm khoảng trắng, nên `0,6` hiện thành "0, 6".
 */
if (typeof MathfieldElement?.decimalSeparator !== "undefined") {
  MathfieldElement.decimalSeparator = ",";
}

/** A small React boundary around MathLive's custom element. */
export const MathField = forwardRef<MathFieldHandle, MathFieldProps>(
  function MathField(
    {
      value,
      onChange,
      onBlur,
      disabled = false,
      readOnly = false,
      defaultMode,
      ariaLabel,
      className,
      style,
      placeholder,
    },
    forwardedRef,
  ) {
    const fieldRef = useRef<MathfieldElement>(null);

    useImperativeHandle(forwardedRef, () => ({
      insert: (latex: string) => {
        const field = fieldRef.current;
        if (!field || typeof field.insert !== "function") return false;
        // Trả lại đúng kết quả của MathLive: nó trả `false` khi phần tử đã nâng cấp
        // nhưng chưa dựng xong (cây DOM ẩn, vừa ngắt kết nối). Nuốt giá trị này thì
        // bên gọi tưởng đã chèn được và bỏ qua đường dự phòng của họ.
        return field.insert(latex) !== false;
      },
      setPromptState: (id, state, locked) => {
        const field = fieldRef.current;
        if (!field || typeof field.setPromptState !== "function") return;
        field.setPromptState(id, state, locked);
      },
      getPromptState: (id) => {
        const field = fieldRef.current;
        if (!field || typeof field.getPromptState !== "function") return undefined;
        const [state, locked] = field.getPromptState(id) ?? [];
        return { state: state ?? undefined, locked: locked === true };
      },
      focus: () => fieldRef.current?.focus(),
      executeCommand: (command) => {
        const field = fieldRef.current;
        if (!field || typeof field.executeCommand !== "function") return false;
        field.executeCommand(command as never);
        return true;
      },
    }));

    /**
     * `default-mode` phải đặt bằng PROPERTY, không phải attribute.
     *
     * React gán attribute SAU khi phần tử đã nâng cấp, nên MathLive không đọc lại
     * — thẻ mang `default-mode="text"` mà `field.defaultMode` vẫn là `math`, và
     * dòng đầu học sinh gõ ra "Giabobutlongla:", mất hết dấu cách, không báo lỗi.
     */
    useEffect(() => {
      const field = fieldRef.current;
      if (!field || !defaultMode) return;
      field.defaultMode = defaultMode;
    }, [defaultMode]);

    /**
     * Phím cách phải gõ ra dấu cách, kể cả ở chế độ toán.
     *
     * Mặc định của MathLive là `mathModeSpace = ""` — trong công thức thì khoảng
     * cách do bộ dựng lo, nên phím cách KHÔNG làm gì. Đúng với một biểu thức
     * thuần, nhưng ở đây học sinh mở bàn phím viết công thức rồi gõ tiếp văn xuôi
     * ngay trong cùng ô: gõ "Mai phải trả" ra "Maiphaitra", mất sạch dấu cách và
     * không báo lỗi gì.
     *
     * `\ ` là dấu cách giữa từ của LaTeX. Đã kiểm luật chấm không đổi vì thế:
     * `21\ 200` vẫn khớp `21200` (numeric), `2x\ +\ 1` vẫn khớp `1 + 2x`
     * (symbolic) — bộ phân tích bỏ qua khoảng trắng.
     */
    useEffect(() => {
      const field = fieldRef.current;
      if (!field) return;
      field.mathModeSpace = "\\ ";
    }, []);

    useEffect(() => {
      const field = fieldRef.current;
      // `setValue` only exists once MathLive has upgraded the custom element.
      // Outside a real browser it never does, and an unguarded call takes down
      // every screen that merely renders a math field.
      if (!field || typeof field.setValue !== "function" || field.value === value) return;
      field.setValue(value, { silenceNotifications: true });
    }, [value]);

    return createElement("math-field", {
      ref: (node: MathfieldElement | null) => {
        fieldRef.current = node;
      },
      className,
      /**
       * Chữ ở chế độ chữ phải cùng phông với chung quanh.
       *
       * MathLive vẽ `\text{}` bằng phông riêng của nó (`system-ui`), nên câu văn
       * học sinh gõ trông khác hẳn đề bài ngay phía trên. Neo vào
       * `--player-font-body` — token đã có ở cả ba repo, khai một lần và cố ý độc
       * lập với theme, nên player nhìn giống nhau ở mọi bề mặt.
       *
       * Phải là danh sách phông cụ thể: đặt `inherit` KHÔNG ăn (đã đo, chữ vẫn ra
       * `system-ui`). Lớp gọi truyền `style` thì đè được, nên để trước phần spread.
       *
       * KHÔNG đụng tới chữ nghiêng ở chế độ toán: `x` nghiêng là đúng quy ước
       * toán học. Văn xuôi ra nghiêng là vì con trỏ đang ở chế độ toán — đóng bàn
       * phím là về chế độ chữ. (`smartMode` tự chuyển giúp nhưng phá công thức:
       * `x^2` thành `\text{x}^2`, `sinx` thành `\text{sinx}` — đã đo.)
       */
      style: {
        ["--text-font-family" as string]: "var(--player-font-body, system-ui, sans-serif)",
        ...style,
      },
      "aria-label": ariaLabel,
      placeholder: placeholder ? latexTextPlaceholder(placeholder) : undefined,
      "read-only": disabled || readOnly ? "true" : undefined,
      "default-mode": defaultMode,
      onInput: (event: Event) => {
        onChange((event.currentTarget as MathfieldElement).value);
      },
      onBlur,
    });
  },
);
