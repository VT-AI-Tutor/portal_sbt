/**
 * Báo cáo địa bàn cấp Xã · Tỉnh · Bộ (Owner 22/08) — chỉ đọc.
 * Thiết kế: evo-books-docs/designs/2026-08-22-territory-report.md
 *
 * `level` là loại của các DÒNG trả về, không phải cấp của người xem.
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";

const API_BASE = getAuthenticatedApiBaseUrl();

export type TerritoryLevel = "province" | "ward" | "school";

export interface TerritoryRow {
  /** null ở dòng gộp "chưa gắn xã" — dòng đó không đi xuống được cấp dưới. */
  org_unit_id: string | null;
  code: string | null;
  name: string;
  schools: number;
  classes: number;
  students: number;
  active_30d: number;
  active_rate: number;
  sessions_30d: number;
  correct_rate: number;
}

export interface TerritoryReport {
  level: TerritoryLevel;
  parent: { id: string; name: string; type: string } | null;
  rows: TerritoryRow[];
}

export interface TerritoryScope {
  global: boolean;
  units: { id: string; name: string; type: string }[];
}

function query(level: TerritoryLevel, parentId?: string | null): string {
  const p = new URLSearchParams({ level });
  if (parentId) p.set("parent_id", parentId);
  return p.toString();
}

async function call<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    message?: string;
    error_code?: string;
  };
  if (!res.ok || body.success === false) {
    throw new Error(
      body.error_code === "OUT_OF_SCOPE"
        ? "Tài khoản của bạn không có quyền xem báo cáo ở cấp này."
        : (body.message ?? `Territory API error ${res.status}`),
    );
  }
  return body.data as T;
}

export const territoryApi = {
  scope: (token: string) => call<TerritoryScope>("/api/v1/manager/territory-scope", token),

  report: (token: string, level: TerritoryLevel, parentId?: string | null) =>
    call<TerritoryReport>(`/api/v1/manager/territory-report?${query(level, parentId)}`, token),

  /**
   * Tải tệp xlsx. Phải đi qua fetch chứ không mở thẳng đường dẫn: trình duyệt
   * không gắn Authorization vào một điều hướng thường, sẽ nhận 401.
   */
  async downloadExport(
    token: string,
    level: TerritoryLevel,
    parentId: string | null | undefined,
    filename: string,
  ): Promise<void> {
    const res = await fetch(
      `${API_BASE}/api/v1/manager/territory-report/export?${query(level, parentId)}`,
      { headers: { Accept: "*/*", Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      throw new Error(`Không xuất được tệp (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
