import { masteryColor } from "./masteryColor";
import { MASTERY_THRESHOLD, isScored, remainingToScore, type LevelInsight } from "./insights";

/**
 * Khối B — Độ vững theo mức đề (spec §3). Bậc thang: rank cao ở TRÊN, thấp ở
 * DƯỚI. Tự vẽ bằng div (không recharts) để kiểm soát: vạch 60% xuyên hàng,
 * sọc chéo cho kết quả sơ bộ, khoảng dao động Wilson, hàng thiếu dữ liệu
 * không thanh/không 0%.
 */
export function LevelLadder({ insights }: { insights: LevelInsight[] }) {
  const rows = [...insights].sort((a, b) => b.rank - a.rank); // cao trên, thấp dưới

  return (
    <div>
      <div className="space-y-2">
        {rows.map((row) => {
          // Nguồn duy nhất cho "đủ mẫu để hiện %" là `isScored`/`SCORE_MIN_ATTEMPTS`
          // — không tự suy từ `status` (đã từng lệch, xem finding #3 review 2026-08-07).
          const scored = isScored(row.attempted);
          const color = masteryColor(scored ? row.percent : null);
          const provisional = row.status === "provisional";
          return (
            <div
              key={row.code}
              /* Mobile: 2 cột × 2 hàng — nhãn+giá trị nằm hàng trên (nhãn được
                 CẢ phần rộng còn lại của hàng, không phải một cột hẹp cố định
                 nữa), track xuống hàng dưới chiếm trọn bề ngang. Desktop: về
                 lại 3 cột 1 hàng như cũ (đặt vị trí tường minh bằng col/row
                 -start nên không cần đổi thứ tự DOM giữa hai chế độ — mỗi
                 data-testid vẫn chỉ có đúng một phần tử). */
              className="grid grid-cols-[1fr_auto] sm:grid-cols-[88px_1fr_64px] items-center gap-x-2 gap-y-1 sm:gap-2"
            >
              <div
                data-testid="ladder-label"
                title={row.label}
                className="col-start-1 row-start-1 sm:col-start-1 min-w-0 text-xs font-medium truncate text-left sm:text-right"
              >
                {row.label}
              </div>
              <div
                className="col-start-2 row-start-1 sm:col-start-3 text-right text-xs sm:text-sm font-display font-bold whitespace-nowrap"
                style={{ color: scored ? color.hex : undefined }}
              >
                {scored ? `${Math.round(row.percent)}%` : ""}
                {provisional && (
                  <span className="ml-1 align-middle text-[10px] font-normal text-muted-foreground">{"sơ bộ"}</span>
                )}
              </div>
              <div className="col-start-1 col-span-2 row-start-2 sm:col-start-2 sm:col-span-1 sm:row-start-1 relative h-6 rounded-md bg-muted/60 overflow-hidden">
                {/* vạch mốc 60% — mỗi hàng một tick thẳng cột, nhìn liền thành vạch dọc */}
                <div
                  data-testid="threshold-tick"
                  className="absolute inset-y-0 border-l-2 border-dashed border-foreground/30"
                  style={{ left: `${MASTERY_THRESHOLD}%` }}
                />
                {scored ? (
                  <>
                    {/* khoảng dao động (Wilson) — vệt mờ phía sau */}
                    <div
                      className="absolute inset-y-1 rounded-sm"
                      style={{
                        left: `${row.interval.lo}%`,
                        width: `${Math.max(row.interval.hi - row.interval.lo, 1)}%`,
                        backgroundColor: `${color.hex}33`,
                      }}
                    />
                    <div
                      data-testid={`bar-${row.code}`}
                      data-provisional={provisional ? "true" : "false"}
                      className="absolute inset-y-0 left-0 rounded-md"
                      style={{
                        width: `${row.percent}%`,
                        ...(provisional
                          ? {
                              backgroundImage: `repeating-linear-gradient(45deg, ${color.hex} 0 5px, ${color.hex}55 5px 10px)`,
                            }
                          : { backgroundColor: color.hex }),
                      }}
                    />
                  </>
                ) : (
                  <>
                    {/* Mobile: bản rút gọn tránh xuống dòng khi track hẹp; desktop: câu đầy đủ. */}
                    <span className="sm:hidden absolute inset-0 flex items-center px-1.5 text-[10px] leading-none whitespace-nowrap text-muted-foreground">
                      {`Còn ${remainingToScore(row.attempted)} câu nữa`}
                    </span>
                    <span className="hidden sm:flex absolute inset-0 items-center px-2 text-[11px] leading-none whitespace-nowrap text-muted-foreground">
                      {`Còn ${remainingToScore(row.attempted)} câu nữa để đánh giá`}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* trục + chú thích cách đọc — mobile: track hàng dữ liệu chiếm TRỌN bề
          ngang (xem col-span ở trên) nên trục căn theo full-width; desktop:
          thụt vào đúng bằng nhãn+khoảng cách bên trái, dành chỗ cột % bên
          phải, để thẳng hàng với track 1fr ở giữa 3 cột như cũ. */}
      <div className="relative text-[10px] text-muted-foreground h-4 mt-1 sm:ml-[96px] sm:mr-[72px]">
        <span className="absolute left-0">0</span>
        {/* Mobile: chỉ số 60 (đủ hẹp để không xuống dòng) — ý nghĩa "mốc thành
            thạo" đã nói ở caption bên dưới. Desktop: đủ chỗ ghi cả nhãn. */}
        <span
          className="sm:hidden absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${MASTERY_THRESHOLD}%` }}
        >
          {`${MASTERY_THRESHOLD}`}
        </span>
        <span
          className="hidden sm:inline absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${MASTERY_THRESHOLD}%` }}
        >
          {`${MASTERY_THRESHOLD} · mốc thành thạo`}
        </span>
        <span className="absolute right-0">100</span>
      </div>
    </div>
  );
}
