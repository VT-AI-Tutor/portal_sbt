import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import { KIND_LABEL, type PaperKind } from "@/core/lib/paperKind";
import {
  BlueprintFlow,
  type BlueprintFocus,
} from "@/modules/teacher/ui/shared/blueprint/BlueprintFlow";

/**
 * Luồng ma trận đề chạy NGAY TRONG Ngân hàng đề/phiếu.
 *
 * Trước đây thẻ "Sinh theo ma trận" điều hướng sang một trang khác — giáo viên
 * đang soạn dở ở ngân hàng đề bị đá đi chỗ khác, trong khi thẻ bên cạnh ("Tạo
 * thủ công") lại mở hộp thoại tại chỗ. Hai thẻ cạnh nhau, cùng một việc "tạo
 * đề", mà một cái ở lại một cái bỏ đi thì không có lý do gì để giáo viên đoán trước.
 *
 * Hộp thoại rộng vì bảng ma trận là bảng thật: một cột chủ đề cộng bốn cột mức
 * nhận thức, và danh sách chủ đề của một môn có thể hơn mười dòng.
 */
export function BlueprintDialog({
  open,
  onOpenChange,
  kind,
  focus,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: PaperKind;
  /** Ô cần tập trung, đến từ màn "Đọc theo ma trận" (một chạm ra phiếu củng cố). */
  focus?: BlueprintFocus;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            🧮 Sinh {KIND_LABEL[kind].toLowerCase()} theo ma trận
          </DialogTitle>
          <DialogDescription>
            Khai <strong>chủ đề × mức nhận thức</strong>, hệ lấy câu từ kho học
            liệu và nhờ trợ lý AI sinh bù chỗ thiếu.
          </DialogDescription>
        </DialogHeader>

        {/* `key` gắn theo loại đề và ô tập trung: đổi tab Phiếu/Đề hay đến từ
            một ô khác thì luồng dựng mới hoàn toàn, không mang theo ma trận
            đang gõ dở của lần trước. */}
        <BlueprintFlow
          key={`${kind}:${focus?.contentCode ?? ""}:${focus?.levelCode ?? ""}`}
          kind={kind}
          focus={focus}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
