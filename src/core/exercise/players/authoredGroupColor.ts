/**
 * web-own: CHƯA upstream lên studio (09/2026) — studio chưa có file này và
 * dispatch bên đó vẫn bốc thiếu `color`. Xem checklist WEB-OWN cuối
 * `apps/learner/scripts/detokenize-players.mjs`.
 *
 * Màu nhóm do TÁC GIẢ khai — `categories[].color` (spec §5.12).
 *
 * VÌ SAO CÓ FILE NÀY. Trường `color` đã nằm trong nội dung từ lâu và đã đi
 * trọn đường ống (JSON → API schemaless → `mapBackendQuestion` spread nguyên
 * payload), nhưng `dispatch.tsx` chỉ bốc `{id,label,imageUrl,imageWidth}` sang
 * player nên màu rơi ở đó — player KHÔNG BAO GIỜ nhận được. Hệ quả: hai rổ của
 * `two_bucket` luôn cùng một màu (skin `playfulAccent` tô mọi dropZone theo
 * accent của player, xem skins.ts §dropZone), và tác giả phải viết màu vào
 * nhãn — "Thân thiện ( tô màu xanh)" — để học sinh phân biệt được nhóm.
 * Nhánh `image_color` ngay cạnh đã đọc `c.color` từ đầu, nên đây là bỏ sót
 * chứ không phải một quyết định thiết kế.
 *
 * LUẬT ƯU TIÊN. Màu tác giả là NGHĨA (xanh = thân thiện), không phải trang trí,
 * nên nó THẮNG skin trên khung rổ và thanh tiêu đề — cùng luật "ý đồ tác giả
 * thắng" mà `blankBoxStyle` đang dùng cho bề rộng ô điền. Ba thứ KHÔNG đụng tới:
 *
 *   1. Màu thẻ (chip) và phản hồi đúng/sai — vẫn do skin quyết. Để màu nhóm đè
 *      lên đó thì rổ "Không thân thiện" màu đỏ sẽ nuốt mất tín hiệu chấm sai.
 *   2. Hiệu ứng đang-kéo/đang-chọn — giữ nguyên `border-dashed` + `scale` +
 *      `ring` của skin. Inline style chỉ đè MÀU (specificity inline > class),
 *      nên khung vẫn đổi nét và nảy như cũ khi kéo thẻ tới.
 *   3. Câu KHÔNG khai `color` — render y hệt trước, không một pixel nào đổi.
 *
 * CHỮ TRÊN NỀN MÀU — HAI TẦNG, vì chọn màu chữ KHÔNG ĐỦ. Đỏ `#ED1C24` (tác giả
 * đang dùng ở HĐTN 1) cho 4.38:1 với chữ trắng và 3.02:1 với chữ đậm: cả hai
 * đều trượt WCAG AA 4.5:1. Nên:
 *
 *   Tầng 1 — chọn trắng hay slate-800 theo bên nào tương phản cao hơn.
 *   Tầng 2 — nếu vẫn chưa đạt 4.5:1, kéo NỀN THANH TIÊU ĐỀ tối/sáng dần từng
 *            nấc 4% cho tới khi đạt. Vòng lặp dừng ngay khi đủ nên mức chỉnh
 *            luôn là nhỏ nhất có thể — `#ED1C24` chỉ nhích một nấc, mắt không
 *            phân biệt được. Chỉ NỀN TIÊU ĐỀ bị chỉnh, vì đó là chỗ duy nhất có
 *            chữ đặt lên; viền và nền khung rổ giữ ĐÚNG mã màu tác giả khai.
 *
 * NỀN PHA ALPHA, KHÔNG MÀU ĐẶC. Khung rổ dùng `rgba(…, 0.12)` nên sống được cả
 * trên nền sáng lẫn `darkSkin` (skin tối cũng dùng `bg-gray-800/60`, cùng ngữ
 * pháp) — không cần tác giả khai hai màu cho hai chế độ.
 *
 * PHẢI TỰ LO TRẠNG THÁI "ĐANG NHẮM TỚI" (`activeZone`). Skin báo drop-target CHỈ
 * BẰNG MÀU — `dropZone("active")` khác `dropZone("idle")` ở đúng hai class màu
 * (`a.ring` = `border-blue-400`, `a.soft` = `bg-blue-50`); cả hai trạng thái đều
 * `border-dashed`. Nên khi màu tác giả đè lên viền + nền, tín hiệu "thả được vào
 * đây" BIẾN MẤT: TwoBucket còn mỗi `scale-[1.02]`, Categorize không còn gì. Học
 * sinh kéo thẻ tới rổ mà rổ không sáng lên — hỏng đúng thao tác chính của hai
 * player này, và chỉ hỏng ở câu CÓ màu nên rất dễ lọt QA.
 *
 * `activeZone` trả tín hiệu đó lại bằng CHÍNH màu tác giả: nền đậm hơn + một
 * quầng `boxShadow`. Chọn `boxShadow` vì đó là kênh DUY NHẤT còn trống ở đây —
 * `border`/`background` đã bị màu tác giả chiếm, `transform` là của skin.
 *
 * Quầng CHỈ đặt lúc `active`. Đường chạm-để-chọn của TwoBucket khoác
 * `ring-2 ring-amber-300`, mà Tailwind ring CŨNG là box-shadow nên inline
 * `boxShadow` sẽ nuốt nó. Lúc chạm thì `dragId` là null → `active` false → trả
 * `zone` (không boxShadow) → vòng amber còn nguyên.
 */
import type React from "react";
import { toRgbOrNull } from "./cssColor";

/** Chữ đậm cho nền sáng — slate-800, cùng tông với `skin.emphasis("neutral","strong")`. */
const DARK_TEXT = { r: 30, g: 41, b: 59 };
const LIGHT_TEXT = { r: 255, g: 255, b: 255 };

/** Độ mờ của màu tác giả khi dùng làm NỀN khung rổ (viền thì để nguyên màu đặc). */
const ZONE_FILL_ALPHA = 0.12;

/** Rổ đang được nhắm tới: nền đậm hơn hẳn + quầng sáng, vẫn một màu tác giả. */
const ACTIVE_FILL_ALPHA = 0.3;
const ACTIVE_RING_ALPHA = 0.45;
const ACTIVE_RING_WIDTH = "4px";

/** Ngưỡng WCAG 2.1 AA cho chữ thường. Tiêu đề nhóm ở mobile là 16px nên không
 *  được hưởng ngoại lệ "chữ lớn" (cần ≥ 18.66px in đậm). */
const AA_CONTRAST = 4.5;

/** Mỗi nấc kéo nền tối/sáng đi khi tương phản chưa đạt. */
const NUDGE_STEP = 0.04;
const MAX_NUDGES = 40;

export interface AuthoredGroupColor {
  /** Khung rổ lúc thường: viền màu đặc + nền pha loãng. Đúng mã tác giả khai. */
  zone: React.CSSProperties;
  /** Khung rổ lúc ĐANG ĐƯỢC NHẮM TỚI — dùng THAY `zone`, không cộng thêm vào nó. */
  activeZone: React.CSSProperties;
  /**
   * Thanh tiêu đề: nền màu đặc + màu chữ đi kèm.
   *
   * Nền ở đây có thể LỆCH MỘT NẤC so với `zone.borderColor` khi mã tác giả khai
   * chưa đạt tương phản AA — cố ý, xem `ensureReadable`. Đừng "sửa" cho khớp.
   */
  head: React.CSSProperties;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Màu tác giả khai → `{r, g, b}`. null khi không khai hoặc không đọc được —
 * call site giữ nguyên đường skin cũ.
 *
 * Luật đọc nằm ở `cssColor`, DÙNG CHUNG với `image_color`: cùng một trường
 * `categories[].color` thì hai họ player phải hiểu giống hệt nhau. Nhờ đó tên
 * màu CSS và `hsl()` cũng đọc được (qua canvas quy chuẩn), chứ không còn rơi về
 * skin như bản chép riêng trước đây. Riêng trong jsdom thì không có canvas nên
 * hai dạng đó vẫn trả null — xem `cssColor`.
 */
function parseColor(raw: unknown): Rgb | null {
  const rgb = toRgbOrNull(raw);
  return rgb ? { r: rgb[0], g: rgb[1], b: rgb[2] } : null;
}

/** Kênh sRGB → tuyến tính (WCAG 2.1 §relative luminance). */
function linear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function css({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Trắng hay slate-800 — bên nào tương phản cao hơn trên nền `rgb`.
 *
 * MỘT nguồn sự thật cho luật này: `authoredGroupColor` phải gọi nó chứ không
 * chép lại biểu thức, không thì đổi ngưỡng ở một chỗ là hai bên trôi khỏi nhau
 * mà test — vốn kiểm hai đường riêng — cũng không bắt được.
 */
function pickText(rgb: Rgb): Rgb {
  return contrast(rgb, LIGHT_TEXT) >= contrast(rgb, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

/** {@link pickText} dưới dạng chuỗi CSS. */
export function readableTextOn(rgb: Rgb): string {
  return css(pickText(rgb));
}

/** Kéo nền một nấc ra xa màu chữ: chữ trắng → tối đi, chữ đậm → sáng lên. */
function nudge(bg: Rgb, towardBlack: boolean): Rgb {
  const move = (c: number) => Math.round(towardBlack ? c * (1 - NUDGE_STEP) : c + (255 - c) * NUDGE_STEP);
  return { r: move(bg.r), g: move(bg.g), b: move(bg.b) };
}

/**
 * Nền tiêu đề đủ tương phản với `text`, giữ nguyên tông màu tác giả. Trả về
 * chính `bg` khi nó đã đạt — mã màu tác giả khai được tôn trọng y nguyên trong
 * đại đa số trường hợp.
 */
function ensureReadable(bg: Rgb, text: Rgb): Rgb {
  const towardBlack = luminance(text) > luminance(bg);
  let out = bg;
  for (let i = 0; i < MAX_NUDGES && contrast(out, text) < AA_CONTRAST; i += 1) {
    out = nudge(out, towardBlack);
  }
  return out;
}

/**
 * Style cho một nhóm theo màu tác giả khai. Trả `null` khi không khai màu hoặc
 * màu không đọc được — call site giữ nguyên đường skin cũ.
 */
export function authoredGroupColor(color: string | undefined | null): AuthoredGroupColor | null {
  const rgb = parseColor(color);
  if (!rgb) return null;

  const text = pickText(rgb);
  const tint = (alpha: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  return {
    zone: {
      borderColor: css(rgb),
      backgroundColor: tint(ZONE_FILL_ALPHA),
    },
    activeZone: {
      borderColor: css(rgb),
      backgroundColor: tint(ACTIVE_FILL_ALPHA),
      boxShadow: `0 0 0 ${ACTIVE_RING_WIDTH} ${tint(ACTIVE_RING_ALPHA)}`,
    },
    head: {
      backgroundColor: css(ensureReadable(rgb, text)),
      color: css(text),
    },
  };
}
