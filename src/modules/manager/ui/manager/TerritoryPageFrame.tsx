/**
 * Khung chung của ba màn báo cáo địa bàn: tiêu đề, dải đường dẫn, nút Xuất Excel,
 * trạng thái tải và lỗi. Ba màn giữ tệp riêng và tự quyết nội dung; chỉ phần
 * khung này là chung để nút xuất và cách báo lỗi không lệch nhau giữa ba cấp.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Skeleton } from "@/core/ui/skeleton";

export interface Crumb {
  label: string;
  to?: string;
}

interface Props {
  title: string;
  subtitle: string;
  crumbs: Crumb[];
  isLoading: boolean;
  error: Error | null;
  exportBusy: boolean;
  exportError: string | null;
  onExport: () => void;
  children: ReactNode;
}

export function TerritoryPageFrame({
  title,
  subtitle,
  crumbs,
  isLoading,
  error,
  exportBusy,
  exportError,
  onExport,
  children,
}: Props) {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
      {crumbs.length > 0 && (
        <nav aria-label="Đường dẫn" className="text-sm text-muted-foreground">
          {crumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`}>
              {i > 0 && <span className="px-1.5">›</span>}
              {crumb.to ? (
                <Link className="hover:underline" to={crumb.to}>
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="outline" onClick={onExport} disabled={exportBusy || isLoading}>
          {exportBusy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Xuất Excel
        </Button>
      </div>

      {exportError && (
        <Card className="border-destructive/40 p-3 text-sm text-destructive">{exportError}</Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{error.message}</Card>
      ) : (
        <>
          {children}
          <p className="text-xs text-muted-foreground">
            Số lớp đếm theo năm học hiện tại. Số liệu học tập tính trong 30 ngày gần nhất.
          </p>
        </>
      )}
    </div>
  );
}
