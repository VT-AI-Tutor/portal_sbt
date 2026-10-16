/**
 * Phần tử đáp án của cloze — kho từ (`wordBank`, §5.6.1) và ô trống (`blanks`,
 * §5.6). Cả hai có thể mang MEDIA cho các câu "chọn hình điền vào chỗ trống"
 * (Mỹ thuật) và "nhìn tranh rồi điền" (Tiếng Việt).
 *
 * Trường canonical là **`media`** — MỘT khối §4.2 không bọc mảng
 * (`{ type: "image", url, altText? }`). Loại đáp án về sau (audio, video,
 * math…) là giá trị `type` khác trong CÙNG field — không thêm field mới.
 *
 * Dữ liệu cũ để ảnh ở chỗ khác và tất cả là alias CHỈ ĐỌC, không bao giờ là
 * đích ghi mới: `imageUrl` / `image.url` / khối ảnh đầu trong `content.blocks`
 * (kho từ), và chuỗi `blanks[].image` (21 câu Tiếng Việt production).
 *
 * ĐÁP ÁN KHÔNG ĐỔI: `correctAnswer` vẫn trỏ id/chữ — khoá đáp án không bao giờ
 * chứa media; media luôn là ĐỀ BÀI của phần tử hoặc của ô trống.
 */

/** Một khối §4.2 không bọc mảng — media của phần tử kho từ hoặc ô trống. */
export interface AnswerElementMedia {
  /** Loại khối §4.2: `image` hôm nay; audio/video/math dùng CÙNG field về sau. */
  type: string;
  url?: string;
  altText?: string;
}

interface ImageBlock {
  type?: string;
  url?: string;
  altText?: string;
  alt?: string;
}

export interface WordBankEntrySource {
  id?: unknown;
  text?: unknown;
  media?: unknown;
  imageUrl?: string;
  image?: { url?: string; altText?: string };
  content?: { blocks?: ImageBlock[] };
}

/** Một phần tử kho từ sau khi chuẩn hoá — luôn có `id`. */
export interface WordBankEntry {
  id: string;
  text: string;
  media?: AnswerElementMedia;
}

/**
 * `media` hợp lệ khi là object có `type` chuỗi khác rỗng. `url`/`altText` sai
 * kiểu bị gỡ (khỏi lọt tới `<img src>`); field khác của khối §4.2 (vd `latex`
 * của math) đi qua nguyên vẹn — validate theo loại là việc của renderer.
 */
function readMedia(raw: unknown): AnswerElementMedia | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const m = raw as Record<string, unknown>;
  if (typeof m.type !== 'string' || m.type.trim() === '') return undefined;
  const media = { ...m } as AnswerElementMedia & Record<string, unknown>;
  if (media.url !== undefined && (typeof media.url !== 'string' || media.url === '')) {
    delete media.url;
  }
  if (media.altText !== undefined && typeof media.altText !== 'string') {
    delete media.altText;
  }
  return media;
}

/** Media của một phần tử kho từ: canonical `media` trước, rồi tới các alias ảnh. */
export function wordBankEntryMedia(
  entry: WordBankEntrySource | undefined,
): AnswerElementMedia | undefined {
  if (!entry) return undefined;
  const media = readMedia(entry.media);
  if (media) return media;
  // Alias phẳng đến từ dữ liệu thô — kiểm kiểu runtime chứ không tin cast,
  // kẻo `imageUrl: {url}` (dạng record có thật ngoài kia) thành src="[object…]".
  if (typeof entry.imageUrl === 'string' && entry.imageUrl !== '') {
    return { type: 'image', url: entry.imageUrl };
  }
  const image = entry.image;
  if (image && typeof image === 'object' && typeof image.url === 'string' && image.url !== '') {
    return {
      type: 'image',
      url: image.url,
      altText: typeof image.altText === 'string' ? image.altText : undefined,
    };
  }
  const block = entry.content?.blocks?.find((b) => b?.type === 'image' && b.url);
  if (block?.url) {
    return { type: 'image', url: block.url, altText: block.altText ?? block.alt };
  }
  return undefined;
}

/**
 * Media của một Ô TRỐNG (`blanks[]`): canonical `media` trước, rồi alias
 * `image` — dạng chuỗi (`"assets/…"`, mẫu 21 câu Tiếng Việt) hoặc object
 * `{url}`. Chuỗi được resolve URL nhờ khoá `image` nằm trong `MEDIA_URL_KEYS`.
 */
export function blankMedia(
  blank: { media?: unknown; image?: unknown } | undefined,
): AnswerElementMedia | undefined {
  if (!blank) return undefined;
  const media = readMedia(blank.media);
  if (media) return media;
  const image = blank.image;
  // Alias chuỗi chỉ nhận path RESOLVE ĐƯỢC (bắt đầu `/` hoặc http): dữ liệu
  // trích xuất cũ còn để `assets/…` tương đối ở đây mà không surface nào có
  // base để phân giải — render sẽ ra icon ảnh vỡ, tệ hơn là không render
  // (ảnh của các câu đó đã có bản absolute nằm trong đề bài).
  if (
    typeof image === 'string' &&
    (image.startsWith('/') || /^https?:\/\//.test(image))
  ) {
    return { type: 'image', url: image };
  }
  if (image && typeof image === 'object' && !Array.isArray(image)) {
    const url = (image as Record<string, unknown>).url;
    if (typeof url === 'string' && url !== '') {
      return {
        type: 'image',
        url,
        altText:
          typeof (image as Record<string, unknown>).altText === 'string'
            ? ((image as Record<string, unknown>).altText as string)
            : undefined,
      };
    }
  }
  return undefined;
}

/**
 * Chuẩn hoá `wordBank` thô về `{id, text, media?}[]`.
 *
 * Nhận cả các dạng đang tồn tại trong dữ liệu: `string[]` (bản trích xuất cũ,
 * cũng là dạng trình soạn ghi ra khi ngân hàng chỉ có chữ), `{id, text}[]`,
 * `{id, content}[]`, và các alias ảnh kể trên. `id` sinh ra theo thứ tự
 * (`word-1`, `word-2`, …) và có chống trùng, để khoá đáp án đã lưu vẫn trỏ
 * đúng phần tử qua mỗi lần render.
 *
 * `textOf` là lối vào cho bên gọi tự giải nghĩa `content` giàu định dạng — chỉ
 * `dispatch` cần, nên module này không phải phụ thuộc vào `core/rich-text`.
 *
 * Phần tử chỉ-media (không có chữ) được GIỮ: đó chính là ca dùng của Mỹ thuật.
 * Chỉ phần tử vừa không chữ vừa không media vừa không id mới bị bỏ.
 */
export function normalizeWordBank(
  raw: unknown,
  textOf?: (content: unknown) => string,
): WordBankEntry[] {
  if (!Array.isArray(raw)) return [];
  const used = new Set<string>();
  const reserveId = (requested: string, index: number): string => {
    let id = requested;
    let suffix = index + 1;
    while (used.has(id)) {
      id = `${requested}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return id;
  };

  const entries: WordBankEntry[] = [];
  raw.forEach((item: unknown, index: number) => {
    const fallbackId = `word-${index + 1}`;
    if (typeof item === 'string') {
      entries.push({ id: reserveId(fallbackId, index), text: item });
      return;
    }
    if (!item || typeof item !== 'object') return;
    const source = item as WordBankEntrySource;
    const text =
      typeof source.text === 'string'
        ? source.text
        : (textOf?.(source.content) ?? '');
    const media = wordBankEntryMedia(source);
    if (!text && !media && source.id == null) return;
    const requestedId = String(source.id ?? fallbackId).trim() || fallbackId;
    entries.push({ id: reserveId(requestedId, index), text, media });
  });
  return entries;
}

/**
 * Nhãn đọc được của một phần tử, dùng cho bảng đáp án và `aria-label`.
 * Phần tử chỉ-media rơi về `altText` của media (mô tả cho người), id là
 * đường cùng — "Chỗ trống 1 → w1" không nói gì với học sinh.
 */
export function wordBankEntryLabel(entry: WordBankEntry): string {
  return entry.text.trim() || entry.media?.altText?.trim() || entry.id;
}
