/**
 * Luật đọc chuỗi màu CSS tác giả khai — dùng chung cho `image_color` (canvas) và
 * classification (`authoredGroupColor`). Trước đây luật này nằm trong
 * `region-ink-overlay` và classification có một bản chép thứ hai chỉ hiểu hex;
 * test ở đây khoá bản DUY NHẤT còn lại.
 */
import { describe, expect, it } from "vitest";
import { normalizeCssColor, parseColorString, toRgbOr, toRgbOrNull, type ColorProbe } from "./cssColor";

const FALLBACK: [number, number, number] = [0x94, 0xa3, 0xb8];

/**
 * Bản giả của `fillStyle` canvas: gán màu hợp lệ thì quy về dạng chuẩn, gán
 * chuỗi hỏng thì GIỮ NGUYÊN giá trị cũ — đúng hành vi trình duyệt, và cũng là
 * chỗ khiến cách dò "gán rồi đọc lại" phải thử hai mốc.
 */
function fakeProbe(known: Record<string, string>): ColorProbe {
  let current = "#000000";
  return {
    get fillStyle() {
      return current;
    },
    set fillStyle(next: string | CanvasGradient | CanvasPattern) {
      const key = String(next).toLowerCase();
      if (key.startsWith("#") || key.startsWith("rgb")) current = key;
      else if (known[key]) current = known[key];
      // màu lạ: bỏ qua, giữ nguyên giá trị cũ
    },
  };
}

describe("parseColorString", () => {
  it("reads every shape canvas normalisation can hand back", () => {
    expect(parseColorString("#ef4444")).toEqual([239, 68, 68]);
    expect(parseColorString("#EF4444")).toEqual([239, 68, 68]);
    expect(parseColorString("#f00")).toEqual([255, 0, 0]);
    expect(parseColorString("#ef444455")).toEqual([239, 68, 68]);
    expect(parseColorString("#ef44")).toEqual([238, 255, 68]); // #rgba: alpha bỏ đi
    expect(parseColorString("rgb(34, 197, 94)")).toEqual([34, 197, 94]);
    expect(parseColorString("rgba(34, 197, 94, 0.33)")).toEqual([34, 197, 94]);
    expect(parseColorString("rgb(34 197 94 / 0.5)")).toEqual([34, 197, 94]);
    expect(parseColorString("  #22c55e  ")).toEqual([34, 197, 94]);
  });

  it("returns null instead of guessing on anything it cannot read", () => {
    // Đây chính là ca làm bản cũ tô ĐEN: parseInt("rr", 16) → NaN → 0.
    expect(parseColorString("red")).toBeNull();
    expect(parseColorString("#ef444")).toBeNull(); // 5 chữ số: không phải dạng hex nào
    expect(parseColorString("#gggggg")).toBeNull();
    expect(parseColorString("")).toBeNull();
    // Phần trăm và kênh âm không bao giờ là đầu ra của canvas → chưa qua quy chuẩn.
    expect(parseColorString("rgb(100%, 0%, 0%)")).toBeNull();
    expect(parseColorString("rgb(-20, 0, 0)")).toBeNull();
  });

  it("clamps and rounds channels that are in the right shape but out of range", () => {
    expect(parseColorString("rgb(300, 40, 12.6)")).toEqual([255, 40, 13]);
  });
});

describe("normalizeCssColor", () => {
  it("resolves a named colour through the probe", () => {
    expect(normalizeCssColor("red", fakeProbe({ red: "#ff0000" }))).toBe("#ff0000");
  });

  it("returns null for a colour the probe refuses, instead of the sentinel", () => {
    // Cả hai lần gán đều bị bỏ qua nên hai mốc lệch nhau → biết là màu hỏng.
    expect(normalizeCssColor("chartroose", fakeProbe({}))).toBeNull();
  });

  it("returns null when the environment has no canvas", () => {
    expect(normalizeCssColor("red", null)).toBeNull();
  });
});

describe("toRgbOr", () => {
  it("falls back to neutral rather than painting black", () => {
    // Không có canvas 2d (jsdom) nên tên màu không giải được — phải ra màu
    // trung tính, KHÔNG phải [0, 0, 0].
    expect(toRgbOr("red", FALLBACK)).toEqual(FALLBACK);
    expect(toRgbOr(undefined, FALLBACK)).toEqual(FALLBACK);
    expect(toRgbOr("", FALLBACK)).toEqual(FALLBACK);
  });

  it("still reads plain hex without any probe", () => {
    expect(toRgbOr("#22c55e", FALLBACK)).toEqual([34, 197, 94]);
  });
});

describe("toRgbOrNull", () => {
  it("trả null thay vì một màu thay thế — call site tự quyết cách rơi về", () => {
    expect(toRgbOrNull(undefined)).toBeNull();
    expect(toRgbOrNull(null)).toBeNull();
    expect(toRgbOrNull("")).toBeNull();
    expect(toRgbOrNull("không phải màu")).toBeNull();
  });

  it("chịu được giá trị KHÔNG phải chuỗi — payload schemaless không ép kiểu", () => {
    // Backend là pass-through: `color` lọt tới đây dưới dạng số hay object là
    // chuyện có thật, và `.trim()` trên nó sẽ ném.
    expect(toRgbOrNull(0xef4444)).toBeNull();
    expect(toRgbOrNull({ hex: "#ef4444" })).toBeNull();
    expect(toRgbOrNull(["#ef4444"])).toBeNull();
  });

  it("đọc hex và rgb() không cần probe", () => {
    expect(toRgbOrNull("#22c55e")).toEqual([34, 197, 94]);
    expect(toRgbOrNull("rgb(58, 170, 53)")).toEqual([58, 170, 53]);
  });
});
