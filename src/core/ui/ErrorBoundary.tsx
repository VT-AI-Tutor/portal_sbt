import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Lưới an toàn cho lỗi render.
 *
 * Vì sao cần: React 18 gỡ SẠCH cây giao diện khi một component ném lỗi lúc
 * render. Không có ranh giới nào thì một câu hỏi dị dạng (thiếu trường, kiểu lạ)
 * làm TRẮNG cả trang — mất luôn thanh điều hướng, người dùng tưởng máy treo và
 * "không chuyển trang cũng không back về được" (đúng mô tả báo lỗi nghiệm thu
 * 17/8). Trước đây cả hai ứng dụng không có một ranh giới nào ngoài hai trang
 * demo dành cho người phát triển.
 *
 * Đặt ranh giới càng SÁT chỗ có thể hỏng càng tốt: bọc từng câu thì một câu
 * hỏng chỉ mất một thẻ, phần còn lại của bài vẫn đọc được.
 */
interface Props {
  children: ReactNode;
  /** Nội dung thay thế khi có lỗi. Nhận thông điệp lỗi để hiện/ghi log tuỳ nơi. */
  fallback: (error: Error) => ReactNode;
  /** Gọi khi bắt được lỗi — để nơi dùng gửi log/telemetry nếu muốn. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Luôn ghi console: không có dòng này thì lỗi bị ranh giới "nuốt" và người
    // phát triển mất manh mối duy nhất để lần ra nguyên nhân.
    console.error("ErrorBoundary bắt được lỗi render:", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  render(): ReactNode {
    const { error } = this.state;

    return error === null ? this.props.children : this.props.fallback(error);
  }
}
