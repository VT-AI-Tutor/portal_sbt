/**
 * Bảng tiến độ học bài giảng theo lớp — giáo viên xem lớp mình học bài giảng
 * ĐÃ GẮN vào một tiết tới đâu: 4 hoạt động theo ĐÚNG thứ tự cố định
 * (khởi động → hình thành kiến thức → luyện tập → vận dụng), điểm quiz từng
 * hoạt động, và mốc hoàn thành. Máy chủ trả CẢ học sinh chưa học (sections
 * rỗng) — bảng phải giữ nguyên dòng đó, ô trống hiện "—", KHÔNG được lọc bỏ:
 * giáo viên cần thấy chính xác ai chưa học.
 *
 * Việc 1 (lát "gắn liên kết bài giảng") — nguồn `linkId` đổi hẳn sang
 * `GET /{id}/links` (nguồn sự thật: ClassMaterialLink, do máy chủ lọc sẵn
 * theo quyền lớp) THAY vì tự suy từ `lecture.class_context` (trường ghi MỘT
 * LẦN lúc tạo, tuỳ chọn) rồi dò ngược qua `teacherClassesApi.getMaterials` +
 * lọc theo `session_id` như bản trước (BẪY vòng sửa 1: cùng bài giảng gắn 2
 * tiết CÙNG lớp → nhiều liên kết trùng `material_id`, phải đoán). Cách đoán
 * đó đã BỎ HẲN — không còn khả dĩ để tái diễn: `/links` liệt kê ĐẦY ĐỦ mọi
 * liên kết đang hoạt động của bài giảng này, dialog xử lý cả ba ca:
 *   - 0 liên kết → báo "chưa gắn vào lớp nào", không hiện bảng.
 *   - 1 liên kết → mở thẳng bảng tiến độ của liên kết đó, không bắt chọn.
 *   - nhiều liên kết → hiện bộ chọn lớp/tiết, giáo viên chọn thì mới tải bảng.
 * Đây cũng chính là cách chữa ca hai lớp (Lát 1 để lại): gắn bài giảng vào
 * lớp THỨ HAI giờ xem được tiến độ NGAY, không cần biết `class_context`.
 *
 * MỞ LẠI PHẢI HỎI LẠI MÁY CHỦ: dữ liệu tiến độ đổi liên tục (học sinh vừa nộp
 * xong lúc nào cũng được) — fetch cục bộ bằng useEffect mỗi lần `open` bật
 * lên (khuôn `AssignmentSubmissionsDialog.tsx`), KHÔNG qua TanStack Query
 * cache. Đúng tinh thần ghi chú gốc ở `useTeacherBlueprint.ts:94-99`
 * (`useSuggestBlueprint`): "bấm lại phải hỏi lại — query có bộ nhớ đệm sẽ trả
 * bảng cũ và giáo viên tưởng hệ không phản hồi". Áp dụng cho CẢ danh sách
 * liên kết lẫn bảng tiến độ: mỗi lần mở dialog, gọi lại `/links` từ đầu (danh
 * sách lớp đã gắn cũng có thể đổi giữa hai lần mở).
 */
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/core/ui/table";
import { Skeleton } from "@/core/ui/skeleton";
import { Button } from "@/core/ui/button";
import { useAccessToken } from "@/core/auth/AuthContext";
import { teacherLectureApi } from "@/modules/teacher/api/teacherLectureApi";
import type {
  LectureLinkRow,
  LectureProgressRow,
  LectureSectionKey,
  TeacherLecture,
} from "@/modules/teacher/api/teacherLectureApi";

/** Đúng thứ tự 4 hoạt động của bài giảng — KHÔNG được đảo. */
const SECTION_ORDER: LectureSectionKey[] = [
  "khoidong",
  "hinhthanh",
  "luyentap",
  "vandung",
];

const SECTION_LABEL: Record<LectureSectionKey, string> = {
  khoidong: "Khởi động",
  hinhthanh: "Hình thành kiến thức",
  luyentap: "Luyện tập",
  vandung: "Vận dụng",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("vi-VN");
}

/** "Lớp X · Tiết Y" — bỏ phần tiết nếu liên kết không gắn tiết cụ thể. */
function linkLabel(link: LectureLinkRow): string {
  return link.session_title
    ? `${link.class_name} · ${link.session_title}`
    : link.class_name;
}

export interface LectureProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lecture: TeacherLecture;
}

export function LectureProgressDialog({
  open,
  onOpenChange,
  lecture,
}: LectureProgressDialogProps) {
  const token = useAccessToken();

  const [links, setLinks] = useState<LectureLinkRow[] | null>(null);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const [rows, setRows] = useState<LectureProgressRow[] | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);

  // Bước 1 — hỏi /links mỗi lần mở. 0 kết quả → báo lỗi ngay; 1 kết quả → tự
  // chọn luôn (không bắt chọn); nhiều kết quả → chờ giáo viên chọn ở bước 2.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLinks(null);
    setLinksError(null);
    setSelectedLinkId(null);
    setRows(null);
    setRowsError(null);

    if (!token) {
      // Khung xương chờ vĩnh viễn không phản hồi nếu bỏ nhánh này — token
      // rỗng (phiên hết hạn giữa lúc dialog đang mở) thì báo lỗi ngay thay
      // vì treo mãi ở trạng thái đang tải.
      setLinksError("Chưa xác thực — thử tải lại trang.");
      return;
    }

    void (async () => {
      try {
        const data = await teacherLectureApi.links(lecture.id, token);
        if (cancelled) return;
        if (data.length === 0) {
          setLinksError("Bài giảng chưa gắn vào lớp nào.");
          return;
        }
        setLinks(data);
        if (data.length === 1) {
          setSelectedLinkId(data[0].link_id);
        }
      } catch {
        if (!cancelled) {
          setLinksError("Không tải được danh sách lớp đã gắn. Thử lại sau.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, lecture.id, token]);

  // Bước 2 — có đúng MỘT liên kết đang chọn (tự động khi chỉ có 1, hoặc do
  // giáo viên bấm chọn khi có nhiều) thì mới hỏi bảng tiến độ của liên kết đó.
  useEffect(() => {
    if (!open || !selectedLinkId || !token) return;
    let cancelled = false;
    setRows(null);
    setRowsError(null);

    void (async () => {
      try {
        const data = await teacherLectureApi.progress(
          lecture.id,
          selectedLinkId,
          token,
        );
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setRowsError("Không tải được bảng tiến độ. Thử lại sau.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, selectedLinkId, lecture.id, token]);

  const showPicker = links !== null && links.length > 1 && !selectedLinkId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            📊 Tiến độ — {lecture.title}
          </DialogTitle>
          <DialogDescription>
            {showPicker
              ? "Bài giảng này đã gắn vào nhiều lớp — chọn lớp và tiết muốn xem."
              : "Lớp học tới đâu với 4 hoạt động của bài giảng này."}
          </DialogDescription>
        </DialogHeader>

        {linksError ? (
          <p className="py-6 text-center text-sm text-destructive">
            {linksError}
          </p>
        ) : links === null ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : showPicker ? (
          <div className="space-y-2">
            {links.map((link) => (
              <Button
                key={link.link_id}
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setSelectedLinkId(link.link_id)}
              >
                {linkLabel(link)}
              </Button>
            ))}
          </div>
        ) : rowsError ? (
          <p className="py-6 text-center text-sm text-destructive">
            {rowsError}
          </p>
        ) : rows === null ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Users className="h-8 w-8" />
            <p className="text-sm">Lớp chưa có học sinh nào.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Học sinh</TableHead>
                {SECTION_ORDER.map((key) => (
                  <TableHead key={key}>{SECTION_LABEL[key]}</TableHead>
                ))}
                <TableHead>Hoàn thành</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.student_id}>
                  <TableCell className="font-medium">
                    {row.full_name}
                  </TableCell>
                  {SECTION_ORDER.map((key) => {
                    const s = row.sections[key];
                    return (
                      <TableCell key={key} className="tabular-nums">
                        {s ? `${s.score}/${s.max_score}` : "—"}
                      </TableCell>
                    );
                  })}
                  <TableCell>{formatDate(row.completed_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
