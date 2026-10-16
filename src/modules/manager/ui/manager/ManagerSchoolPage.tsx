import { useParams, useSearchParams } from "react-router-dom";
import { SchoolReportPage } from "./SchoolReportPage";
import { ManagerClassesTab } from "./ManagerClassesTab";
import { ManagerLoginStatusTab } from "./ManagerLoginStatusTab";
import { ManagerStudentsTab } from "./ManagerStudentsTab";
import { ManagerTeachersTab } from "./ManagerTeachersTab";

/**
 * Khung khu Ban giám hiệu cho MỘT trường. Trước đây khu này chỉ có đúng màn tổng quan —
 * phản ánh "chưa có gì ở role này ngoại trừ phần tổng quan" (nghiệm thu 15/8).
 *
 * Tab nằm ở query `?tab=` chứ không phải route con: lãnh đạo hay gửi link cho nhau ("xem giúp
 * danh sách em dưới báo động"), giữ được đường dẫn chia sẻ mà không phải dựng thêm tầng route.
 */
const TABS = [
  { key: "tong-quan", label: "Tổng quan" },
  { key: "hoc-sinh", label: "Học sinh" },
  { key: "lop-hoc", label: "Lớp học" },
  { key: "giao-vien", label: "Giáo viên" },
  { key: "dang-nhap", label: "Chưa đăng nhập" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ManagerSchoolPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : "tong-quan";
  const schoolId = id ?? "";

  const select = (key: TabKey) => {
    const next = new URLSearchParams(searchParams);
    if (key === "tong-quan") next.delete("tab");
    else next.set("tab", key);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
      <nav className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => select(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab tổng quan giữ nguyên trang báo cáo cũ, không viết lại: nó đã được nghiệm thu và
          có khung riêng (tiêu đề trường + chọn năm học). */}
      {tab === "tong-quan" && <SchoolReportPage />}
      {tab === "hoc-sinh" && <ManagerStudentsTab schoolId={schoolId} />}
      {tab === "lop-hoc" && <ManagerClassesTab schoolId={schoolId} />}
      {tab === "giao-vien" && <ManagerTeachersTab schoolId={schoolId} />}
      {tab === "dang-nhap" && <ManagerLoginStatusTab schoolId={schoolId} />}
    </div>
  );
}
