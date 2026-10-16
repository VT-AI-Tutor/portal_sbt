import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Skeleton } from "@/core/ui/skeleton";
import { useAccessToken } from "@/core/auth/AuthContext";
import {
  managerApi,
  type LoginStatusGroupKey,
  type LoginStatusPerson,
} from "@/modules/manager/api/managerApi";
import { downloadTable } from "@/modules/manager/lib/exportTable";

/**
 * Ba nhóm CẦN BA HÀNH ĐỘNG KHÁC NHAU của nhà trường — gộp làm một danh sách "chưa đăng nhập"
 * thì lãnh đạo không biết phải làm gì với ai (quyết định Owner 2026-08-15).
 */
const GROUPS: Record<
  LoginStatusGroupKey,
  { title: string; hint: string; tone: string }
> = {
  chua_kich_hoat: {
    title: "Chưa kích hoạt tài khoản",
    hint: "Chưa từng đặt mật khẩu — nhà trường cần cấp lại mã đăng nhập cho em.",
    tone: "border-destructive/40",
  },
  chua_dang_nhap: {
    title: "Chưa đăng nhập lần nào",
    hint: "Đã có mật khẩu nhưng chưa vào hệ thống lần nào — cần nhắc em đăng nhập.",
    tone: "border-amber-400",
  },
  lau_khong_vao: {
    title: "Lâu rồi không vào",
    hint: "Có đăng nhập nhưng đã lâu không quay lại.",
    tone: "border-sky-400",
  },
};

function formatDate(iso: string | null): string {
  if (iso === null) return "—";
  const d = new Date(iso);

  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("vi-VN");
}

export function ManagerLoginStatusTab({ schoolId }: { schoolId: string }) {
  const token = useAccessToken();
  const [days, setDays] = useState("");
  const [memberType, setMemberType] = useState<"learner" | "instructor">("learner");

  const params = {
    school_org_unit_id: schoolId,
    days: days === "" ? undefined : Number(days),
    member_type: memberType,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["manager-login-status", params],
    queryFn: () => managerApi.loginStatus(token!, params),
    enabled: !!token,
  });

  const exportGroup = (key: LoginStatusGroupKey, people: LoginStatusPerson[]) => {
    downloadTable({
      filename: `chua-dang-nhap-${key.replace(/_/g, "-")}`,
      headers: ["Họ tên", "Email", "Đăng nhập gần nhất", "Số ngày không vào", "Đã từng làm bài"],
      rows: people.map((p) => [
        p.full_name,
        p.email ?? "",
        formatDate(p.last_login_at),
        p.days_since_login ?? "",
        p.has_practiced ? "Có" : "Chưa",
      ]),
    });
  };

  if (error) {
    return (
      <Card className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Không tải được danh sách."}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="login-member-type">Đối tượng</Label>
          <select
            id="login-member-type"
            className="h-10 rounded-md border px-3 text-sm"
            value={memberType}
            onChange={(e) => setMemberType(e.target.value as "learner" | "instructor")}
          >
            <option value="learner">Học sinh</option>
            <option value="instructor">Giáo viên</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="login-days">Coi là "lâu không vào" sau (ngày)</Label>
          <Input
            id="login-days"
            className="w-32"
            inputMode="numeric"
            placeholder={String(data?.days ?? 30)}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>
        <span className="pb-2 text-sm text-muted-foreground">
          Tổng {data?.total_people ?? 0} người trong trường.
        </span>
      </div>

      {isLoading && !data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        (Object.keys(GROUPS) as LoginStatusGroupKey[]).map((key) => {
          const people = data?.groups?.[key] ?? [];
          const g = GROUPS[key];

          return (
            <Card key={key} className={`overflow-x-auto border-l-4 ${g.tone}`}>
              <div className="flex flex-wrap items-center gap-3 border-b p-4">
                <div>
                  <div className="font-display font-bold">
                    {g.title} · {people.length}
                  </div>
                  <div className="text-sm text-muted-foreground">{g.hint}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={people.length === 0}
                  onClick={() => exportGroup(key, people)}
                >
                  Xuất Excel
                </Button>
              </div>

              {people.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Không có ai trong nhóm này.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Họ tên</th>
                      <th className="px-4 py-2 font-medium">Đăng nhập gần nhất</th>
                      <th className="px-4 py-2 font-medium">Làm bài</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p) => (
                      <tr key={p.user_id} className="border-b last:border-0">
                        <td className="px-4 py-2">
                          <div className="font-medium">{p.full_name || "—"}</div>
                          {p.email && (
                            <div className="text-xs text-muted-foreground">{p.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {formatDate(p.last_login_at)}
                          {p.days_since_login !== null && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({p.days_since_login} ngày trước)
                            </span>
                          )}
                        </td>
                        {/* Phần Ban giám hiệu hỏi thêm: vào rồi mà KHÔNG làm bài là chuyện
                            khác hẳn chưa vào bao giờ. */}
                        <td className="px-4 py-2">
                          {p.has_practiced ? (
                            <span className="text-muted-foreground">Đã từng làm bài</span>
                          ) : (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                              Chưa làm bài nào
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
