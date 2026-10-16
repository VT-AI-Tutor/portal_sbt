import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAccessToken } from "@/core/auth/AuthContext";
import {
  territoryApi,
  type TerritoryLevel,
  type TerritoryReport,
  type TerritoryScope,
} from "@/modules/manager/api/territoryApi";

export function useTerritoryScope() {
  const token = useAccessToken();
  return useQuery<TerritoryScope, Error>({
    queryKey: ["manager", "territory-scope"],
    queryFn: () => territoryApi.scope(token!),
    enabled: !!token,
  });
}

export function useTerritoryReport(level: TerritoryLevel, parentId?: string | null) {
  const token = useAccessToken();
  return useQuery<TerritoryReport, Error>({
    queryKey: ["manager", "territory-report", level, parentId ?? ""],
    queryFn: () => territoryApi.report(token!, level, parentId),
    // Cấp Bộ không có cha; hai cấp kia phải có, đừng hỏi khi chưa biết.
    enabled: !!token && (level === "province" || !!parentId),
  });
}

/** Tải tệp xlsx kèm trạng thái đang chạy và lỗi, để nút biết tự khoá. */
export function useTerritoryExport(
  level: TerritoryLevel,
  parentId: string | null | undefined,
  filename: string,
) {
  const token = useAccessToken();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    busy,
    error,
    run: async () => {
      if (!token || busy) return;
      setBusy(true);
      setError(null);
      try {
        await territoryApi.downloadExport(token, level, parentId, filename);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không xuất được tệp.");
      } finally {
        setBusy(false);
      }
    },
  };
}
