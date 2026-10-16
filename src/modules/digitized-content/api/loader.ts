// Loader cho nội dung "tự số hóa" — đọc runtime từ public/digitized-content/
// thay vì gọi API. Data được serve từ public/ nên không cần backend.
//
// Quy ước folder: public/digitized-content/<bookId>/{manifest.json,
// data/content.json, assets/...}. Khi muốn thêm sách, copy folder mới vào
// public/digitized-content/ rồi thêm bookId vào public/digitized-content/index.json.
//
// Hai lớp cache:
// - Manifest: preload lúc app boot (file nhỏ, ~2KB) → getDigitizedManifest
//   vẫn sync, không cần đổi caller (BookDetailPage, AdvancedBookSection).
// - Content: lazy fetch khi vào bài (file lớn, ~1MB) → getDigitizedContent /
//   getDigitizedLesson là async, DigitizedExerciseDialog xử lý loading state.

import type {
  DigitizedManifest,
  DigitizedBookContent,
  DigitizedLesson,
} from "./types";
import { getDigitizedContentBaseUrl } from "@/core/api/config";

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/** URL tuyệt đối cho file trong public/digitized-content/. Tôn trọng
 *  VITE_DIGITIZED_CONTENT_BASE_URL nếu được đặt (vd "https://hoclieu.nxbgd.vn"). */
function publicUrl(relativePath: string): string {
  const base = getDigitizedContentBaseUrl();
  const path = relativePath.startsWith("/")
    ? relativePath
    : `/${relativePath}`;
  return base ? `${base}${path}` : path;
}

// ---------------------------------------------------------------------------
// Manifest cache (sync sau khi preload xong)
// ---------------------------------------------------------------------------

const MANIFESTS_BY_BOOK: Record<string, DigitizedManifest> = {};
let preloadPromise: Promise<void> | null = null;

/** Preload index.json + tất cả manifest.json. Gọi 1 lần ở app boot. */
export function preloadDigitizedManifests(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const indexRes = await fetch(publicUrl("digitized-content/index.json"));
    if (!indexRes.ok) {
      throw new Error(
        `Không tải được digitized-content/index.json: ${indexRes.status}`,
      );
    }
    const bookIds: string[] = await indexRes.json();
    await Promise.all(
      bookIds.map(async (bookId) => {
        try {
          const res = await fetch(
            publicUrl(`digitized-content/${bookId}/manifest.json`),
          );
          if (!res.ok) return;
          MANIFESTS_BY_BOOK[bookId] = (await res.json()) as DigitizedManifest;
        } catch {
          // Bỏ qua sách lỗi — không chặn các sách khác.
        }
      }),
    );
  })();
  return preloadPromise;
}

/** Lấy manifest theo bookCode. Trả về null nếu không có hoặc chưa preload xong. */
export function getDigitizedManifest(bookCode: string): DigitizedManifest | null {
  return MANIFESTS_BY_BOOK[bookCode] ?? null;
}

/** Lấy danh sách bookId đã preload xong (dùng cho debug / test). */
export function getLoadedDigitizedBookIds(): string[] {
  return Object.keys(MANIFESTS_BY_BOOK);
}

// ---------------------------------------------------------------------------
// Content cache (async, lazy)
// ---------------------------------------------------------------------------

const CONTENT_BY_BOOK: Record<string, DigitizedBookContent> = {};
const CONTENT_PROMISES: Record<string, Promise<DigitizedBookContent | null>> = {};

/** Lấy toàn bộ content (kèm questions) theo bookCode. Async vì content.json
 *  lớn (~1MB), chỉ fetch khi cần. Cache trong memory sau lần đầu. */
export  function getDigitizedContent(
  bookCode: string,
): Promise<DigitizedBookContent | null> {
  if (CONTENT_BY_BOOK[bookCode]) {
    return Promise.resolve(CONTENT_BY_BOOK[bookCode]);
  }
  // Check key tồn tại — Promise là object nên truthy luôn, không check được
  // bằng `if (CONTENT_PROMISES[bookCode])` (TS2801).
  if (bookCode in CONTENT_PROMISES) {
    return CONTENT_PROMISES[bookCode];
  }
  CONTENT_PROMISES[bookCode] = (async () => {
    try {
      const res = await fetch(
        publicUrl(`digitized-content/${bookCode}/data/content.json`),
      );
      if (!res.ok) return null;
      const data = (await res.json()) as DigitizedBookContent;
      CONTENT_BY_BOOK[bookCode] = data;
      return data;
    } catch {
      return null;
    }
  })();
  return CONTENT_PROMISES[bookCode];
}

/** Lấy 1 bài theo bookCode + lessonCode. Nhận nhiều dạng:
 *  - slug "bai1" (trường `code` trong content.json, id trong manifest)
 *  - lesson_id "57001" (trường `id`/`lesson_code` trong content.json)
 *  - số "1" → "bai1" */
export async function getDigitizedLesson(
  bookCode: string,
  lessonCode: string,
): Promise<DigitizedLesson | null> {
  const book = await getDigitizedContent(bookCode);
  if (!book) return null;
  // Chuẩn hoá: "1" → "bai1" để nhận cả số trần.
  const slug = /^\d+$/.test(lessonCode) ? `bai${lessonCode}` : lessonCode;
  for (const chapter of book.chapters) {
    for (const lesson of chapter.lessons) {
      if (
        lesson.id === lessonCode ||
        lesson.lesson_code === lessonCode ||
        lesson.code === slug
      ) {
        return lesson;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Asset URL
// ---------------------------------------------------------------------------

/** Prefix URL cho asset tương đối trong payload (vd: "assets/images/x.png").
 *  Assets nằm trong public/digitized-content/<bookCode>/assets/... nên URL
 *  runtime là /digitized-content/<bookCode>/assets/images/...
 *
 *  Nếu VITE_DIGITIZED_CONTENT_BASE_URL được đặt (vd "https://hoclieu.nxbgd.vn")
 *  thì prefix base URL đó — cho phép serve asset ở domain khác. Mặc định rỗng
 *  = cùng origin với portal.
 *
 *  CHỈ rewrite khi chuỗi trông giống đường dẫn asset (bắt đầu bằng "assets/"
 *  hoặc có đuôi file ảnh). Nếu không thì trả về nguyên — tránh prefix nhầm vào
 *  text câu hỏi, label, v.v. */
const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|m4a|mp4|webm|pdf)$/i;

export function assetUrl(bookCode: string, relativePath: string): string {
  if (!relativePath) return relativePath;
  if (/^(https?:|data:|\/)/.test(relativePath)) return relativePath;
  const looksLikeAsset =
    relativePath.startsWith("assets/") || ASSET_EXT.test(relativePath);
  if (!looksLikeAsset) return relativePath;
  const base = getDigitizedContentBaseUrl();
  const path = `/digitized-content/${bookCode}/${relativePath}`;
  return base ? `${base}${path}` : path;
}
