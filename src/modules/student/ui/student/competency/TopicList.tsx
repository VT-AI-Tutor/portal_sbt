import { Button } from "@/core/ui/button";
import type { CompetencySubjectDetail } from "@/modules/student/api/practiceApi";
import { isScored, remainingToScore, sampleStatus } from "./insights";
import { MASTERY_LEGEND, masteryColor } from "./masteryColor";
import { stripLeadingIndex } from "./shortLabel";

type Topic = CompetencySubjectDetail["topics"][number];

/**
 * Khối D — Chủ đề cần củng cố (spec §5): danh sách việc cần làm, yếu nhất lên
 * đầu, chưa đủ bài xuống cuối. Màu thanh và chú giải cùng đọc từ masteryColor
 * — không thể lệch nhau.
 */
export function TopicList({
  topics,
  onPractice,
  pendingCode,
  disabled = false,
}: {
  topics: Topic[];
  onPractice: (contentCode: string) => void;
  pendingCode: string | null;
  /** Có MỘT phiên đang được tạo ở bất kỳ đâu trên trang (kể cả hàng khác) —
   * khoá TẤT CẢ nút "Luyện →", không chỉ hàng khởi phát, để tránh hai phiên
   * cùng tạo và đua nhau điều hướng. */
  disabled?: boolean;
}) {
  if (topics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {"Chưa có chủ đề nào được ghi nhận. Em làm bài luyện tập để hệ thống biết em cần củng cố chỗ nào nhé!"}
      </p>
    );
  }

  const scored = topics.filter((t) => isScored(t.attempted)).sort((a, b) => a.percent - b.percent);
  const thin = topics.filter((t) => !isScored(t.attempted)).sort((a, b) => b.attempted - a.attempted);
  const rows = [...scored, ...thin];

  return (
    <div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
        {MASTERY_LEGEND.map((l) => (
          <span key={l.tone} className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm inline-block" style={{ backgroundColor: l.hex }} />
            {l.label}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((t) => {
          const hasScore = isScored(t.attempted);
          const provisional = sampleStatus(t.attempted) === "provisional";
          const color = masteryColor(hasScore ? t.percent : null);
          return (
            <div
              key={t.content_code}
              className="grid grid-cols-[110px_1fr_32px_auto] sm:grid-cols-[minmax(0,300px)_1fr_44px_auto] items-center gap-1.5 sm:gap-2"
            >
              {/* Tên chủ đề: cột rộng gấp đôi và CHỈ cắt bằng CSS. Trước đây cắt
                  hai lớp — `shortenLabel` cắt ở 28 ký tự rồi `truncate` cắt tiếp
                  theo bề ngang — nên tên rụng sớm hơn hẳn chỗ thật sự có. Nay
                  chỉ bỏ tiền tố đánh số, còn lại để bề ngang quyết định; tên đầy
                  đủ vẫn xem được khi rê chuột. */}
              <div data-testid="topic-name" title={t.label} className="text-xs font-medium truncate">
                {stripLeadingIndex(t.label)}
              </div>
              <div className="relative h-4 rounded bg-muted/60 overflow-hidden">
                {hasScore ? (
                  <div
                    data-testid={`topic-bar-${t.content_code}`}
                    className="absolute inset-y-0 left-0 rounded"
                    style={{
                      width: `${t.percent}%`,
                      ...(provisional
                        ? { backgroundImage: `repeating-linear-gradient(45deg, ${color.hex} 0 5px, ${color.hex}55 5px 10px)` }
                        : { backgroundColor: color.hex }),
                    }}
                  />
                ) : (
                  <>
                    {/* Mobile: bản rút gọn tránh xuống dòng khi track hẹp; desktop: câu đầy đủ. */}
                    <span className="sm:hidden absolute inset-0 flex items-center px-1.5 text-[9px] leading-none whitespace-nowrap text-muted-foreground">
                      {`Còn ${remainingToScore(t.attempted)} câu nữa`}
                    </span>
                    <span className="hidden sm:flex absolute inset-0 items-center px-2 text-[10px] leading-none whitespace-nowrap text-muted-foreground">
                      {`Còn ${remainingToScore(t.attempted)} câu nữa để đánh giá`}
                    </span>
                  </>
                )}
              </div>
              <div className="text-right text-xs font-bold truncate" style={{ color: hasScore ? color.hex : undefined }}>
                {hasScore ? `${Math.round(t.percent)}%` : ""}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-1.5 sm:px-2 text-xs"
                disabled={pendingCode === t.content_code || disabled}
                onClick={() => onPractice(t.content_code)}
              >
                {pendingCode === t.content_code ? "Đang tạo..." : "Luyện →"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
