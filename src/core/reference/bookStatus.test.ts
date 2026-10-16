import { describe, expect, it } from "vitest";
import { isDraftBook, isPublishedBook } from "./bookStatus";

describe("isPublishedBook", () => {
  it("chỉ 'published' mới là đã công bố", () => {
    expect(isPublishedBook("published")).toBe(true);
    expect(isPublishedBook("draft")).toBe(false);
  });

  it("trạng thái lạ coi là chưa công bố, không phải đã công bố", () => {
    // status phía máy chủ là chuỗi tự do, không phải enum — gói nhập cũ từng
    // ghi được chuỗi bất kỳ. Không được đoán nhầm thành đã công bố.
    expect(isPublishedBook("ai_extracted")).toBe(false);
    expect(isPublishedBook("Published")).toBe(false);
    expect(isPublishedBook("")).toBe(false);
    expect(isPublishedBook(null)).toBe(false);
    expect(isPublishedBook(undefined)).toBe(false);
  });

  it("isDraftBook là phần bù của isPublishedBook", () => {
    for (const s of [
      "published",
      "draft",
      "ai_extracted",
      "",
      null,
      undefined,
    ]) {
      expect(isDraftBook(s)).toBe(!isPublishedBook(s));
    }
  });
});
