import type { RichContent } from "@/core/question-schema";
import { plainTextFromRichContent } from "@/core/rich-text/html";
import { cn } from "@/core/utils";
import { AlignedRichText } from "./shared";

/**
 * Shared matching-column title boundary. Canonical rich content wins when it
 * carries text; the synchronized string remains a compatibility fallback.
 * Rich titles default to left alignment unless their block says otherwise.
 *
 * Typography is split by branch (#561): a *rich* title carries the author's own
 * formatting (bold/italic/casing/color from the editor toolbar), so we must NOT
 * force `uppercase`/`font-bold`/`text-sm`/`text-slate-500` over it — those
 * classes can't be overridden by inline runs (there is no "un-bold"/"un-upper"
 * annotation), which is exactly what made author formatting look ignored. Rich
 * titles therefore only keep the layout class (`text-left`). Legacy plain-string
 * titles (no rich content) keep the original small-bold-uppercase-muted default
 * so existing questions render unchanged.
 */
const BADGE_TONE = {
  fuchsia: "bg-fuchsia-500",
  violet: "bg-violet-600",
  blue: "bg-blue-600",
} as const;

export type MatchingColumnBadgeTone = keyof typeof BADGE_TONE;

/**
 * MỘT nguồn cho câu hỏi "nhãn cột này đọc từ đâu": rich thắng khi nó CÓ CHỮ,
 * rỗng thì rơi về chuỗi thường. Mọi thứ khác (dựng hay không, huy hiệu hay
 * chữ, render cái gì) đều phải hỏi hàm này — chép lại phép thử là đẻ ra bản
 * sao, và bản sao thì lệch im lặng: nhãn vẽ ra một cỡ, chỗ chừa tính một cỡ.
 *
 * `hasTitle` cố ý KHÔNG trim `title`: chuỗi toàn khoảng trắng vẫn tính là có
 * nhãn, giữ đúng hành vi cũ.
 */
function resolveColumnTitle(title?: string, titleContent?: RichContent) {
  const rich =
    titleContent && plainTextFromRichContent(titleContent).trim()
      ? titleContent
      : undefined;
  const text = (rich ? plainTextFromRichContent(rich) : title ?? "").trim();
  return { rich, text, hasTitle: Boolean(rich || title) };
}

/** Cột này có dựng nhãn hay không. Player lưới cần biết trước khi render vì
 *  item đặt hàng CỨNG (`gridRow`) — hàng nhãn phải được đếm hay bỏ từ đầu. */
export function hasMatchingColumnTitle(title?: string, titleContent?: RichContent): boolean {
  return resolveColumnTitle(title, titleContent).hasTitle;
}

/** Nhãn dựng ra hình gì — `none` không dựng, `badge` huy hiệu tròn, `text` một
 *  dòng chữ. Player ba cột cần biết để CHỪA đúng chỗ cho cột không khai nhãn:
 *  ba cột là ba lưới con rời nhau (khác bản hai cột chia chung hàng lưới), nên
 *  cột thiếu nhãn sẽ kéo ô của nó cao hơn hai cột kia. */
export type MatchingColumnLabelShape = "none" | "badge" | "text";

export function matchingColumnLabelShape(
  title?: string,
  titleContent?: RichContent,
  badgeTone?: MatchingColumnBadgeTone,
): MatchingColumnLabelShape {
  const { text, hasTitle } = resolveColumnTitle(title, titleContent);
  if (!hasTitle) return "none";
  return badgeTone && text.length > 0 && text.length <= 2 ? "badge" : "text";
}

export function MatchingColumnLabel({
  title,
  titleContent,
  className,
  badgeTone,
}: {
  title?: string;
  titleContent?: RichContent;
  className?: string;
  /** Cột A/B: nhãn 1–2 ký tự vẽ thành huy hiệu tròn có màu. */
  badgeTone?: MatchingColumnBadgeTone;
}) {
  const { rich: richTitle, text: badgeText, hasTitle } = resolveColumnTitle(
    title,
    titleContent,
  );
  if (!hasTitle) return null;
  // ponytail: chỉ nhãn ngắn (A, B, 1, 2) mới thành hình tròn — tiêu đề dài bo
  // tròn sẽ thành viên thuốc méo mó, giữ nguyên kiểu chữ cũ. Nhãn rich cũng
  // vào nhánh này: cột A/B ngoài đời được lưu dưới dạng rich content.
  // Hỏi `matchingColumnLabelShape` chứ KHÔNG viết lại phép thử: chỗ chừa của
  // player ba cột đo bằng chính hàm đó, hai bản là hai lần lệch.
  const badgeStyle =
    badgeTone && matchingColumnLabelShape(title, titleContent, badgeTone) === "badge"
      ? BADGE_TONE[badgeTone]
      : null;
  if (badgeStyle) {
    return (
      <div data-matching-col-title className={cn("flex justify-center", className)}>
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full text-base font-bold uppercase text-white shadow-md",
            badgeStyle,
          )}
        >
          {badgeText}
        </span>
      </div>
    );
  }
  return (
    <div
      data-matching-col-title
      className={cn(
        richTitle ? undefined : "text-sm font-bold uppercase tracking-wide text-slate-500",
        className,
        richTitle ? "text-left" : undefined,
      )}
    >
      <AlignedRichText blocks={richTitle?.blocks} fallback={title} />
    </div>
  );
}
