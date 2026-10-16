/**
 * Sách nhập từ ZIP mang bìa theo gói: API trả cover_url dạng đường dẫn không
 * kèm host ("/storage/book-assets/…"). Trả thẳng cho <img> thì trình duyệt hỏi
 * origin của web (localhost:4200) chứ không phải API và luôn 404 — bìa phải đi
 * qua resolveAssetUrl ngay ở lớp chuẩn hoá, như mọi asset khác.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBook, getBookLesson, listBooks } from "./catalogApi";
import { getCatalogApiBaseUrl } from "@/core/api/config";

const RELATIVE_COVER = "/storage/book-assets/abc/assets/images/cover.webp";
const ABSOLUTE_COVER = "https://media.example.com/evo/catalog/covers/lop-4.webp";

function stubFetchJson(body: unknown) {
  const fn = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("catalogApi cover_url", () => {
  it("prepends the API base to a host-relative book cover", async () => {
    stubFetchJson({
      success: true,
      data: { id: 1, title: "VBT Tiếng Việt 4", cover_url: RELATIVE_COVER },
    });

    const book = await getBook("99629588");

    expect(book.cover_url).toBe(`${getCatalogApiBaseUrl()}${RELATIVE_COVER}`);
  });

  it("leaves an absolute cover URL untouched", async () => {
    stubFetchJson({
      success: true,
      data: { id: 1, title: "VBT Tiếng Việt 4", cover_url: ABSOLUTE_COVER },
    });

    const book = await getBook("99629588");

    expect(book.cover_url).toBe(ABSOLUTE_COVER);
  });

  it("keeps a missing cover null", async () => {
    stubFetchJson({
      success: true,
      data: { id: 1, title: "VBT Tiếng Việt 4", cover_url: null },
    });

    const book = await getBook("99629588");

    expect(book.cover_url).toBeNull();
  });

  it("resolves covers in the catalog list", async () => {
    stubFetchJson({
      success: true,
      data: [{ id: 1, title: "VBT Tiếng Việt 4", cover_url: RELATIVE_COVER }],
    });

    const [book] = await listBooks();

    expect(book.cover_url).toBe(`${getCatalogApiBaseUrl()}${RELATIVE_COVER}`);
  });

  it("resolves the book cover carried by a lesson detail", async () => {
    stubFetchJson({
      success: true,
      data: {
        book: { id: 1, title: "VBT Tiếng Việt 4", cover_url: RELATIVE_COVER },
        chapter: { id: 1, index: 1, title: "Tuần 1" },
        lesson: { id: 2, title: "Điều kì diệu" },
      },
    });

    const detail = await getBookLesson("99629588", "2");

    expect(detail.book.cover_url).toBe(
      `${getCatalogApiBaseUrl()}${RELATIVE_COVER}`,
    );
  });
});
