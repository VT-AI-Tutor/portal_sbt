/**
 * Hàng rào lỗi render cho toàn app — không có nó, mọi lỗi render đều thành
 * trang trắng câm lặng. Phủ cả khu học sinh, giáo viên, quản lý nên lời nhắn
 * phải trung tính.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/core/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

class ErrorBoundaryView extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }

    return (
      <div className="mx-auto max-w-lg p-8 text-center space-y-3">
        <AlertTriangle className="size-10 text-destructive mx-auto" />
        <h1 className="font-display text-xl font-bold">
          Trang gặp sự cố hiển thị
        </h1>
        <p className="text-sm text-muted-foreground">
          Trang này không hiển thị được. Bạn thử tải lại, nếu vẫn lỗi thì báo bộ
          phận hỗ trợ giúp nhé.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Button onClick={() => window.location.reload()}>
            Tải lại trang
          </Button>
        </div>
      </div>
    );
  }
}

/**
 * Khoá theo pathname: hàng rào nằm TRONG router, nên chuyển trang là dựng lại
 * hàng rào và xoá lỗi. Không có khoá này thì trang lỗi dính lại vĩnh viễn —
 * bấm gì cũng render lại đúng route vừa sập.
 */
export function AppErrorBoundary({ children }: Props) {
  const { pathname } = useLocation();
  return <ErrorBoundaryView key={pathname}>{children}</ErrorBoundaryView>;
}
