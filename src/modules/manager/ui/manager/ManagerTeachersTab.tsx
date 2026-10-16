import { useQuery } from "@tanstack/react-query";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Skeleton } from "@/core/ui/skeleton";
import { useAccessToken } from "@/core/auth/AuthContext";
import { useSubjects } from "@/core/reference";
import { managerApi } from "@/modules/manager/api/managerApi";
import { downloadTable } from "@/modules/manager/lib/exportTable";

/** Tab "Giáo viên" của khu Ban giám hiệu — chỉ đọc: tổ bộ môn, chủ nhiệm, phân công dạy. */
export function ManagerTeachersTab({ schoolId }: { schoolId: string }) {
  const token = useAccessToken();
  const { data: subjects } = useSubjects();
  const subjectLabel = (code: string) =>
    subjects?.find((s) => s.code === code)?.label ?? code;

  const { data, isLoading, error } = useQuery({
    queryKey: ["manager-teachers", schoolId],
    queryFn: () => managerApi.teachers(token!, { school_org_unit_id: schoolId }),
    enabled: !!token,
  });

  const exportCsv = () => {
    downloadTable({
      filename: "danh-sach-giao-vien",
      headers: ["Họ tên", "Email", "Tổ bộ môn", "Chủ nhiệm", "Số phân công", "Môn dạy"],
      rows: (data ?? []).map((t) => [
        t.full_name,
        t.email ?? "",
        t.departments.map((d) => d.name).join(", "),
        t.homeroom_classes.map((c) => c.name).join(", "),
        t.assignment_count,
        t.subject_codes.map(subjectLabel).join(", "),
      ]),
    });
  };

  if (error) {
    return (
      <Card className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Không tải được danh sách giáo viên."}
      </Card>
    );
  }

  if (isLoading && !data) {
    return <Skeleton className="h-60 w-full" />;
  }

  const items = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{items.length} giáo viên</span>
        <Button variant="outline" className="ml-auto" onClick={exportCsv} disabled={items.length === 0}>
          Xuất Excel
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Họ tên</th>
              <th className="px-4 py-3 font-medium">Tổ bộ môn</th>
              <th className="px-4 py-3 font-medium">Chủ nhiệm</th>
              <th className="px-4 py-3 font-medium">Phân công</th>
              <th className="px-4 py-3 font-medium">Môn dạy</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.user_id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <div className="font-medium">{t.full_name || "—"}</div>
                  {t.email && <div className="text-xs text-muted-foreground">{t.email}</div>}
                </td>
                <td className="px-4 py-2">
                  {t.departments.length > 0
                    ? t.departments.map((d) => d.name).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-2">
                  {t.homeroom_classes.length > 0
                    ? t.homeroom_classes.map((c) => c.name).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-2">{t.assignment_count}</td>
                <td className="px-4 py-2">
                  {t.subject_codes.length > 0
                    ? t.subject_codes.map(subjectLabel).join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Trường chưa có giáo viên nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
