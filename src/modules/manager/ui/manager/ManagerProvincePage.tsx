/**
 * Màn cấp Tỉnh (Owner 22/08) — mỗi dòng một xã. Trường gắn thẳng vào tỉnh, không
 * qua xã, hiện ở dòng gộp "Chưa gắn xã" cuối bảng: bỏ đi thì tổng các dòng không
 * bằng số liệu của tỉnh và không ai biết vì sao.
 */
import { useParams } from "react-router-dom";
import { TerritoryPageFrame } from "./TerritoryPageFrame";
import { TerritoryReportTable } from "./TerritoryReportTable";
import { useTerritoryExport, useTerritoryReport } from "@/modules/manager/hooks/useTerritory";

export function ManagerProvincePage() {
  const { id } = useParams<{ id: string }>();
  const report = useTerritoryReport("ward", id);
  const name = report.data?.parent?.name ?? "Tỉnh";
  const exporter = useTerritoryExport("ward", id, "bao-cao-tinh.xlsx");

  return (
    <TerritoryPageFrame
      title={name}
      subtitle="Chất lượng học tập theo xã và phường"
      crumbs={[{ label: "Toàn quốc", to: "/manager/national" }, { label: name }]}
      isLoading={report.isLoading}
      error={report.error}
      exportBusy={exporter.busy}
      exportError={exporter.error}
      onExport={exporter.run}
    >
      <TerritoryReportTable
        rows={report.data?.rows ?? []}
        unitLabel="Xã / Phường"
        linkTo={(row) => `/manager/ward/${row.org_unit_id}`}
      />
    </TerritoryPageFrame>
  );
}
