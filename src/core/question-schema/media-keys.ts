/**
 * media-keys.ts — the single list of payload keys that hold a media URL.
 *
 * The renderer resolves these to a loadable src (see
 * `core/exercise/players/dispatch.tsx` → `resolvePayloadMediaUrls`); the editor
 * uses the same list to tell an author how much media a destructive action is
 * about to drop. Both must agree — a key missing here is media the renderer
 * cannot load AND media the editor destroys without warning.
 */

/** Payload keys whose string value is a media URL (stored path or external). */
export const MEDIA_URL_KEYS: ReadonlySet<string> = new Set([
  "url",
  "src",
  "imageUrl",
  // `blanks[].image` của cloze (§5.6) — 21 câu Tiếng Việt production để đường
  // dẫn ảnh dạng CHUỖI ở đây. Các chỗ khác `image` là object {url} nên chỉ giá
  // trị chuỗi đi qua nhánh resolve; object vẫn được duyệt đệ quy như cũ.
  // CHỦ Ý kéo theo: `collectMediaUrls` cũng đếm chuỗi `image`, nên cảnh báo
  // xoá-media của editor nhìn thấy ảnh của các câu này.
  "image",
  "imageA",
  "imageB",
  "backgroundImage",
  "audioUrl",
  "videoUrl",
  "poster",
]);

/**
 * Every distinct media URL reachable under `node`, in first-seen order.
 *
 * Walks plain objects/arrays only — it reads the payload's own shape and makes
 * no assumption about question type, so it works for `options[].content.blocks`
 * (image blocks), `backgroundImage.url` (diagram_fill), `statements[]`, and any
 * future carrier alike. Empty strings are skipped; duplicates collapse, so the
 * count is "how many distinct assets", not "how many references".
 */
export function collectMediaUrls(node: unknown): string[] {
  const seen = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === "string") {
        if (MEDIA_URL_KEYS.has(key) && child.trim() !== "") seen.add(child);
        continue;
      }
      walk(child);
    }
  };
  walk(node);
  return [...seen];
}
