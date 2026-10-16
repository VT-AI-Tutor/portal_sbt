/**
 * Lưới bìa xếp "… Tập hai" TRƯỚC "… Tập một": nấc cuối là
 * `title.localeCompare(…, "vi")` mà "hai" < "một" theo alphabet.
 *
 * Comparator chỉ đọc field `tap`: adapter LCMS map `bookNumber` → `tap`, còn
 * provider legacy trả thẳng `tap`. Cả hai đều coi 0 là sách không chia tập, và
 * suy từ TÊN sách chỉ là dự phòng khi `tap` trống hoặc 0.
 * Tên trong test lấy nguyên văn từ response thật của LCMS.
 */
import { describe, expect, it } from "vitest";
import {
  compareBooksForGrid,
  volumeFromTitle,
  type BookGridOrderKey,
} from "./bookGridOrder";

function book(over: Partial<BookGridOrderKey> = {}): BookGridOrderKey {
  return {
    level: "1",
    subject: "Tiếng Việt",
    tap: null,
    title: "Vở bài tập Tiếng Việt 1",
    ...over,
  };
}

const titlesOf = (list: BookGridOrderKey[]) =>
  [...list].sort(compareBooksForGrid).map((b) => b.title);

describe("volumeFromTitle", () => {
  it("đọc số tập viết bằng chữ", () => {
    expect(volumeFromTitle("Vở bài tập Toán 4 - Tập một")).toBe(1);
    expect(volumeFromTitle("Vở bài tập Toán 4 - Tập hai")).toBe(2);
  });

  it("đọc số tập viết bằng chữ số (dữ liệu provider legacy)", () => {
    expect(volumeFromTitle("VBT Tiếng Việt 1 - Tập 1")).toBe(1);
    expect(volumeFromTitle("VBT Tiếng Việt 1 - Tập 2")).toBe(2);
  });

  it('lấy chữ "tập" CUỐI: "Vở Tập viết" không phải là số tập', () => {
    expect(volumeFromTitle("Vở Tập viết 1 - Tập một")).toBe(1);
    expect(volumeFromTitle("Vở Tập viết 2 - Tập hai")).toBe(2);
  });

  it("sách không chia tập trả null, không khớp nhầm tên môn", () => {
    expect(volumeFromTitle("Vở bài tập Tin học 4")).toBeNull();
    expect(volumeFromTitle("Vở bài tập Hoạt động trải nghiệm 4")).toBeNull();
    expect(volumeFromTitle("Vở bài tập Tự nhiên và Xã hội 1")).toBeNull();
    expect(volumeFromTitle("Sách autotest")).toBeNull();
  });
});

describe("compareBooksForGrid", () => {
  it("xếp tập 1 trước tập 2 khi API không trả số tập", () => {
    const tapHai = book({ title: "Vở bài tập Tiếng Việt 1 - Tập hai" });
    const tapMot = book({ title: "Vở bài tập Tiếng Việt 1 - Tập một" });

    expect(titlesOf([tapHai, tapMot])).toEqual([
      "Vở bài tập Tiếng Việt 1 - Tập một",
      "Vở bài tập Tiếng Việt 1 - Tập hai",
    ]);
  });

  it("ưu tiên số tập từ API hơn tên sách", () => {
    const tapHai = book({ tap: 2, title: "Quyển B - Tập một" });
    const tapMot = book({ tap: 1, title: "Quyển A - Tập hai" });

    expect(titlesOf([tapHai, tapMot])).toEqual([
      "Quyển A - Tập hai",
      "Quyển B - Tập một",
    ]);
  });

  it("tap = 0 là không chia tập, không phải tập 0", () => {
    const khongTap = book({ tap: 0, title: "Quyển không chia tập" });
    const tapMot = book({ tap: 1, title: "Quyển A" });

    expect(titlesOf([khongTap, tapMot])).toEqual([
      "Quyển A",
      "Quyển không chia tập",
    ]);
  });

  it("xếp sách không chia tập sau các tập đã đánh số của cùng môn", () => {
    const khongTap = book({
      subject: "Tập viết",
      title: "Vở Tập viết 1",
    });
    const tapMot = book({
      subject: "Tập viết",
      title: "Vở Tập viết 1 - Tập một",
    });

    expect(titlesOf([khongTap, tapMot])).toEqual([
      "Vở Tập viết 1 - Tập một",
      "Vở Tập viết 1",
    ]);
  });

  it("vẫn gom theo khối rồi tới môn trước khi xét tập", () => {
    const lop2TapMot = book({
      level: "2",
      title: "Vở bài tập Tiếng Việt 2 - Tập một",
    });
    const lop1TapHai = book({ title: "Vở bài tập Tiếng Việt 1 - Tập hai" });
    const lop1Toan = book({
      subject: "Toán",
      title: "Vở bài tập Toán 1 - Tập một",
    });

    expect(titlesOf([lop2TapMot, lop1TapHai, lop1Toan])).toEqual([
      "Vở bài tập Tiếng Việt 1 - Tập hai",
      "Vở bài tập Toán 1 - Tập một",
      "Vở bài tập Tiếng Việt 2 - Tập một",
    ]);
  });
});
