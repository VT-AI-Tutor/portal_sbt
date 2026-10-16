import { useNavigate } from "react-router-dom";
import { Button } from "@/core/ui/button";

/**
 * Nội dung thay thế khi một TRANG ném lỗi lúc render — dùng chung cho mọi khu
 * (học sinh, giáo viên, quản lý).
 *
 * Đặt bên TRONG shell nên thanh điều hướng vẫn còn: người dùng đi tiếp được
 * thay vì đối diện màn hình trắng không lối thoát. Có nút tải lại vì phần lớn
 * lỗi render là do dữ liệu một lần, tải lại là qua.
 */
export function PageErrorFallback({ error }: { error: Error }) {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-xl space-y-4 p-8 text-center">
      <h2 className="font-display text-xl font-bold">Phần này đang gặp trục trặc</h2>
      <p className="text-sm text-muted-foreground">
        Trang không hiển thị được. Em thử tải lại, hoặc quay về trang trước nhé.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>Tải lại trang</Button>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Quay lại
        </Button>
      </div>
      {/* Thông điệp kỹ thuật để người dùng đọc cho bộ phận hỗ trợ khi báo lỗi —
          không có nó thì mọi báo lỗi đều chỉ là "màn hình trắng". */}
      <p className="text-xs text-muted-foreground/70">Chi tiết kỹ thuật: {error.message}</p>
    </div>
  );
}
