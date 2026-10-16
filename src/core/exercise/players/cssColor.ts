/**
 * Đọc chuỗi màu CSS do TÁC GIẢ khai — một nguồn sự thật cho mọi player.
 *
 * VÌ SAO TÁCH RA. Luật này vốn nằm trong `region-ink-overlay.tsx` vì P62
 * (`image_color`) cần `[r, g, b]` cho canvas. Khi classification cũng bắt đầu
 * đọc `categories[].color`, nó viết lại một bản thứ hai chỉ hiểu hex và `rgb()`
 * — thành ra CÙNG một trường nội dung lại render khác nhau giữa `image_color`
 * và `two_bucket`/`buckets`: tác giả khai `red` thì bên này ra màu, bên kia rơi
 * về skin trong im lặng. Gộp về đây để không còn hai luật cho một trường.
 *
 * Bài học đã trả giá một lần, giữ lại ở đây: bản đọc-hex-thuần biến `"red"`
 * thành `NaN` rồi rơi về 0 và TÔ ĐEN, trông y như một màu cố ý. Nên đường đọc
 * luôn là quy chuẩn qua trình duyệt TRƯỚC, đọc kênh SAU.
 */

export type Rgb = [number, number, number];

/**
 * Đọc các dạng màu mà canvas trả về sau khi quy chuẩn — "#rgb", "#rrggbb",
 * "#rrggbbaa", "rgb(…)", "rgba(…)". null nếu không đọc được.
 *
 * Phần trăm ("rgb(100% 0% 0%)") trả null chứ không đoán bừa: canvas không bao
 * giờ trả về dạng đó, nên gặp nó nghĩa là chuỗi chưa qua quy chuẩn.
 */
export function parseColorString(value: string): Rgb | null {
  const v = value.trim();

  if (v.startsWith("#")) {
    const h = v.slice(1);
    const expanded =
      h.length === 3 || h.length === 4
        ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
        : h.length === 6 || h.length === 8
          ? h.slice(0, 6)
          : null;
    if (!expanded || !/^[0-9a-f]{6}$/i.test(expanded)) return null;
    return [
      parseInt(expanded.slice(0, 2), 16),
      parseInt(expanded.slice(2, 4), 16),
      parseInt(expanded.slice(4, 6), 16),
    ];
  }

  if (v.includes("%")) return null;
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  if (!m) return null;
  const channels = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!channels.every(Number.isFinite)) return null;
  return channels.map((n) => Math.max(0, Math.min(255, Math.round(n)))) as Rgb;
}

/** Chỉ cần đúng phần `fillStyle` của canvas 2d — để test tiêm bản giả vào. */
export interface ColorProbe {
  fillStyle: string | CanvasGradient | CanvasPattern;
}

let cachedProbe: ColorProbe | null | undefined;

function defaultProbe(): ColorProbe | null {
  if (cachedProbe !== undefined) return cachedProbe;
  try {
    cachedProbe = document.createElement("canvas").getContext("2d");
  } catch {
    cachedProbe = null; // jsdom, hoặc trình duyệt không cho tạo context
  }
  return cachedProbe;
}

/**
 * Nhờ trình duyệt quy mọi cú pháp CSS ("red", "rgb(…)", "hsl(…)"…) về dạng
 * chuẩn. null khi màu không hợp lệ, hoặc môi trường không có canvas 2d.
 *
 * Gán `fillStyle` một chuỗi KHÔNG hợp lệ thì trình duyệt giữ nguyên giá trị cũ
 * chứ không báo lỗi — nên phải thử hai mốc khác nhau: khớp nhau mới là màu thật
 * đọc được, lệch nhau nghĩa là cả hai lần gán đều bị bỏ qua.
 */
export function normalizeCssColor(
  color: string,
  probe: ColorProbe | null = defaultProbe(),
): string | null {
  if (!probe) return null;
  probe.fillStyle = "#000000";
  probe.fillStyle = color;
  const fromBlack = probe.fillStyle;
  probe.fillStyle = "#ffffff";
  probe.fillStyle = color;
  const fromWhite = probe.fillStyle;
  return typeof fromBlack === "string" && fromBlack === fromWhite ? fromBlack : null;
}

/**
 * `[r, g, b]` của một chuỗi màu CSS bất kỳ, null khi không đọc được.
 *
 * Nhận cả giá trị KHÔNG phải chuỗi: `color` đi từ payload schemaless, backend
 * không ép kiểu trường nào, nên một số hay một object lọt tới đây là chuyện có
 * thật — và `.trim()` trên nó sẽ ném.
 *
 * Trong jsdom (không có canvas 2d) thì không quy chuẩn được, nên tên màu CSS và
 * `hsl()` trả null ở test dù trên trình duyệt chúng đọc được bình thường.
 */
export function toRgbOrNull(color: unknown): Rgb | null {
  if (!color || typeof color !== "string") return null;
  const normalized = normalizeCssColor(color);
  return parseColorString(normalized ?? color);
}

/** {@link toRgbOrNull} với màu thay thế sẵn, cho call site không tự rơi về được. */
export function toRgbOr(color: string | undefined, fallback: Rgb): Rgb {
  return toRgbOrNull(color) ?? fallback;
}
