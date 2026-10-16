import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateTestWizard } from "@/modules/teacher/ui/shared/CreateTestWizard";


export function TeacherTestPage() {
  const [open, setOpen] = useState(false);

  return (
    <>
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">
              📋 Thi / Kiểm tra
            </h1>
            <p className="text-muted-foreground">
              Lên lịch và quản lí các kì thi, lấy đề từ{" "}
              <strong>Tạo đề/phiếu</strong>.
            </p>
          </div>
          <Button
            onClick={() => setOpen(true)}
            className="btn-pop rounded-full"
          >
            <Plus className="size-4 mr-1" /> Tạo cuộc thi/kiểm tra
          </Button>
        </div>

        <Card className="p-6 border-2 border-dashed text-center">
          <h2 className="font-display text-xl font-bold">
            {"📅 Lịch thi đã tạo (0)"}
          </h2>
          {/* Danh sách này từng hiện 3 kì thi mẫu lấy từ `mock-papers` — trông
              như thật nhưng không kì nào có thật, và nút tạo cũng chỉ hiện một
              dòng thông báo. Thà nói rõ tính năng chưa nối backend còn hơn bày
              số liệu giả cho giáo viên tin theo. */}
          <p className="text-sm text-muted-foreground mt-2">
            {"Chưa có kì thi nào. Phần lên lịch thi đang chờ backend — tạo xong chưa lưu lại được."}
          </p>
        </Card>
      </div>

      <CreateTestWizard open={open} onOpenChange={setOpen} />
    </>
  );
}
