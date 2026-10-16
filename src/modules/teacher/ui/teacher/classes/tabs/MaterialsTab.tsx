/**
 * MaterialsTab — quản lý học liệu gắn vào lớp (GAP-132 teacher stack).
 * Gắn/gỡ học liệu theo mã material_id; bộ chọn học liệu đầy đủ sẽ bổ sung sau.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Skeleton } from "@/core/ui/skeleton";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type {
  TabProps,
  MaterialRow,
  AttachMaterialInput,
} from "@/modules/teacher/api/classTypes";

export function MaterialsTab({ classId, token, reload }: TabProps) {
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const [materialId, setMaterialId] = useState("");
  const [titleSnapshot, setTitleSnapshot] = useState("");
  const [isRequired, setIsRequired] = useState(false);

  async function refetch() {
    setLoading(true);
    try {
      const data = await teacherClassesApi.getMaterials(classId, token);
      setRows(data);
    } catch {
      toast.error("Không thực hiện được thao tác với học liệu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, token]);

  async function handleAttach() {
    if (!materialId.trim() || !titleSnapshot.trim()) {
      toast.error("Nhập đủ mã học liệu và tiêu đề.");
      return;
    }
    setIsBusy(true);
    try {
      const input: AttachMaterialInput = {
        material_id: materialId.trim(),
        title_snapshot: titleSnapshot.trim(),
        is_required: isRequired,
      };
      await teacherClassesApi.attachMaterial(classId, input, token);
      toast.success("Đã gắn học liệu.");
      setMaterialId("");
      setTitleSnapshot("");
      setIsRequired(false);
      await refetch();
      reload();
    } catch {
      toast.error("Không thực hiện được thao tác với học liệu.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDetach(row: MaterialRow) {
    if (!window.confirm(`Gỡ học liệu "${row.name}" khỏi lớp?`)) return;
    setIsBusy(true);
    try {
      await teacherClassesApi.detachMaterial(classId, row.id, token);
      toast.success("Đã gỡ học liệu.");
      await refetch();
      reload();
    } catch {
      toast.error("Không thực hiện được thao tác với học liệu.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-medium">
          <Paperclip className="h-4 w-4" />
          Gắn học liệu
        </div>
        <p className="text-sm text-muted-foreground">
          Nhập mã học liệu (material_id) — bộ chọn học liệu đầy đủ sẽ bổ sung
          sau.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Mã học liệu (material_id)"
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            disabled={isBusy}
          />
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Tiêu đề học liệu"
            value={titleSnapshot}
            onChange={(e) => setTitleSnapshot(e.target.value)}
            disabled={isBusy}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            disabled={isBusy}
          />
          Bắt buộc
        </label>
        <div>
          <Button onClick={handleAttach} disabled={isBusy}>
            Gắn học liệu
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <FileText className="h-8 w-8" />
            <p className="text-sm">Chưa gắn học liệu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Tên học liệu</th>
                  <th className="px-2 py-2 font-medium">Loại</th>
                  <th className="px-2 py-2 font-medium">Bắt buộc</th>
                  <th className="px-2 py-2 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-2 py-2">{row.name}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {row.material_type ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      {row.is_required ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Bắt buộc
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDetach(row)}
                        disabled={isBusy}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Gỡ
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
