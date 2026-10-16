import { Eye, EyeOff } from "lucide-react";

interface PreviewBannerProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * Sticky top banner shown when the current route is a preview (UUID) route.
 * Lets the admin toggle between draft preview and published catalog data.
 */
export function PreviewBanner({ enabled, onToggle }: PreviewBannerProps) {
  return (
    <div
      className={`sticky top-0 z-50 flex items-center justify-center gap-3 px-4 py-1.5 text-xs font-semibold transition-colors ${
        enabled
          ? "bg-amber-400 text-amber-950"
          : "bg-slate-600 text-slate-100"
      }`}
    >
      {enabled ? (
        <Eye className="size-3.5 shrink-0" />
      ) : (
        <EyeOff className="size-3.5 shrink-0" />
      )}
      <span>
        {enabled
          ? "Đang xem bản nháp — dữ liệu chưa công bố"
          : "Đang xem bản công bố"}
      </span>
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className={`rounded-full px-3 py-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
          enabled
            ? "bg-amber-950/15 hover:bg-amber-950/25 text-amber-950"
            : "bg-white/15 hover:bg-white/25 text-white"
        }`}
      >
        {enabled ? "Xem bản công bố" : "Xem bản nháp"}
      </button>
    </div>
  );
}
