/**
 * Màu nhóm tác giả khai — `categories[].color` (spec §5.12).
 *
 * Bài toán gốc: hai rổ của `two_bucket` luôn cùng một màu trên surface học sinh
 * (skin tô mọi dropZone theo accent của player), nên tác giả phải viết màu vào
 * nhãn — "Thân thiện ( tô màu xanh)" — dù đã khai `color: "#3AAA35"` trong nội
 * dung. Màu chết ở `dispatch.tsx`, chưa bao giờ tới được player.
 *
 * Ở đây kiểm cái LÕI tính màu; `classificationAuthoredColor.test.tsx` kiểm việc
 * màu đi qua dispatch và được player gắn lên DOM.
 */
import { describe, expect, it } from "vitest";
import { authoredGroupColor, readableTextOn } from "./authoredGroupColor";

/** Sáu mã màu CÓ THẬT trong `books/` (HĐTN 1 và HĐTN 3), cộng hai màu phụ. */
const AUTHORED_IN_BOOKS = ["#3AAA35", "#ED1C24", "#1E88E5", "#E53935", "#22c55e", "#ef4444", "#0ea5e9", "#f59e0b"];

describe("authoredGroupColor", () => {
  it("trả null khi không khai màu → call site giữ nguyên đường skin cũ", () => {
    expect(authoredGroupColor(undefined)).toBeNull();
    expect(authoredGroupColor(null)).toBeNull();
    expect(authoredGroupColor("")).toBeNull();
  });

  it("đọc hex 6 ký tự — đúng hai màu HĐTN 1 bài 5 đang dùng", () => {
    expect(authoredGroupColor("#3AAA35")?.zone.borderColor).toBe("rgb(58, 170, 53)");
    expect(authoredGroupColor("#ED1C24")?.zone.borderColor).toBe("rgb(237, 28, 36)");
  });

  it("đọc cả hex 3 ký tự, hex có alpha, và rgb()/rgba()", () => {
    expect(authoredGroupColor("#3a5")?.zone.borderColor).toBe("rgb(51, 170, 85)");
    // Alpha của hex bị bỏ: nền khung tự pha alpha riêng, giữ alpha tác giả sẽ
    // nhân đôi độ mờ và làm rổ gần như trong suốt.
    expect(authoredGroupColor("#3AAA3580")?.zone.borderColor).toBe("rgb(58, 170, 53)");
    expect(authoredGroupColor("rgb(58, 170, 53)")?.zone.borderColor).toBe("rgb(58, 170, 53)");
    expect(authoredGroupColor("rgba(58,170,53,0.5)")?.zone.borderColor).toBe("rgb(58, 170, 53)");
  });

  it("trả null cho chuỗi KHÔNG phải màu → rơi về skin thay vì đoán màu chữ", () => {
    expect(authoredGroupColor("#12")).toBeNull();
    expect(authoredGroupColor("#gggggg")).toBeNull();
    expect(authoredGroupColor("xanh lá cây")).toBeNull();
  });

  it("tên màu CSS và hsl(): trình duyệt đọc được, jsdom thì không", () => {
    // `cssColor` quy chuẩn qua canvas 2d — thứ jsdom không có — nên ở đây hai
    // dạng này trả null, còn trên surface thật chúng ra màu đúng như nhánh
    // `image_color` vẫn làm. Luật quy chuẩn được khoá riêng bằng probe giả ở
    // `cssColor.test.ts`; ca này chỉ ghi nhận giới hạn của môi trường test.
    expect(authoredGroupColor("rebeccapurple")).toBeNull();
    expect(authoredGroupColor("hsl(120 60% 40%)")).toBeNull();
  });

  it("nền khung pha loãng, không phải màu đặc — sống được cả trên skin tối", () => {
    expect(authoredGroupColor("#3AAA35")?.zone.backgroundColor).toBe("rgba(58, 170, 53, 0.12)");
  });

  describe("chữ trên thanh tiêu đề", () => {
    it("chọn màu chữ theo nền: xanh lá #3AAA35 → chữ đậm, đỏ #ED1C24 → chữ trắng", () => {
      // Đây là lý do KHÔNG ép trắng: #3AAA35 + chữ trắng chỉ đạt 3.0:1.
      expect(authoredGroupColor("#3AAA35")?.head.color).toBe("rgb(30, 41, 59)");
      expect(authoredGroupColor("#ED1C24")?.head.color).toBe("rgb(255, 255, 255)");
    });

    it("hai cực: nền đen → chữ trắng, nền trắng → chữ đậm", () => {
      expect(readableTextOn({ r: 0, g: 0, b: 0 })).toBe("rgb(255, 255, 255)");
      expect(readableTextOn({ r: 255, g: 255, b: 255 })).toBe("rgb(30, 41, 59)");
    });

    it("màu đã đủ tương phản thì GIỮ NGUYÊN mã tác giả khai, không chỉnh gì", () => {
      // #3AAA35 + chữ đậm = 4.40… — chưa đạt, nên nó SẼ bị nhích (ca dưới).
      // #f59e0b + chữ đậm thì đã dư, phải giữ y nguyên.
      expect(authoredGroupColor("#f59e0b")?.head.backgroundColor).toBe("rgb(245, 158, 11)");
    });

    it("màu không đủ tương phản thì nhích nền, nhưng viền rổ vẫn ĐÚNG mã tác giả", () => {
      // #ED1C24 chỉ đạt 4.38:1 với chữ trắng và 3.02:1 với chữ đậm — không màu
      // chữ nào qua được AA, nên nền tiêu đề phải tối đi một nấc.
      const red = authoredGroupColor("#ED1C24")!;
      expect(red.zone.borderColor).toBe("rgb(237, 28, 36)");
      expect(red.head.backgroundColor).not.toBe("rgb(237, 28, 36)");
      // Nhích tối thiểu: vẫn là đỏ, mắt không phân biệt được.
      expect(channelDrift(red.head.backgroundColor as string, "#ED1C24")).toBeLessThanOrEqual(16);
    });

    it("ca nhích NHIỀU NHẤT trong sách — #ef4444 — vẫn cùng tông, lệch có trần", () => {
      // 88 lần trong nội dung, và là mã phải nhích nhiều nấc nhất (4). Thanh
      // tiêu đề sáng hơn viền ở mức THẤY ĐƯỢC — vẫn là đỏ, nhưng không còn là
      // "mắt không phân biệt được" như ca #ED1C24 một nấc. Trần ở đây để lần
      // sau ai chỉnh NUDGE_STEP thì thấy ngay mức lệch đổi.
      const red = authoredGroupColor("#ef4444")!;
      expect(red.zone.borderColor).toBe("rgb(239, 68, 68)");
      expect(channelDrift(red.head.backgroundColor as string, "#ef4444")).toBeLessThanOrEqual(32);
    });

    it("MỌI màu tác giả đang dùng trong sách đều đạt tương phản AA (>= 4.5:1)", () => {
      for (const hex of AUTHORED_IN_BOOKS) {
        const head = authoredGroupColor(hex)!.head;
        const ratio = contrastRatio(head.backgroundColor as string, head.color as string);
        expect(ratio, `${hex} → nền ${head.backgroundColor} / chữ ${head.color}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  it("MỌI màu trong khối RGB đều đạt AA — vòng nhích luôn hội tụ trong MAX_NUDGES", () => {
    // `MAX_NUDGES` là thứ DUY NHẤT chặn `ensureReadable` trả về màu dưới chuẩn:
    // hết vòng mà chưa đạt thì nó trả luôn màu đang có, KHÔNG báo gì. Không ca
    // màu cụ thể nào chứng minh được cái trần đó đủ, nên quét cả khối (bước 5,
    // ~140k màu). Hạ trần, đổi `NUDGE_STEP`, hay đổi `DARK_TEXT` sang một tông
    // trung tính hơn — ca này đỏ ngay thay vì đẻ ra chữ chìm trên một mã màu
    // chưa ai dùng tới.
    let worst = { ratio: Infinity, color: "" };
    for (let r = 0; r < 256; r += 5) {
      for (let g = 0; g < 256; g += 5) {
        for (let b = 0; b < 256; b += 5) {
          const color = `rgb(${r}, ${g}, ${b})`;
          const { head } = authoredGroupColor(color)!;
          const ratio = contrastRatio(head.backgroundColor as string, head.color as string);
          if (ratio < worst.ratio) worst = { ratio, color };
        }
      }
    }
    expect(worst.ratio, `tệ nhất: ${worst.color} → ${worst.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
});

/** Đọc "#rrggbb" hoặc "rgb(r, g, b)" thành ba kênh. */
function channels(value: string): number[] {
  const fn = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(value);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  const n = value.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}

/** Lệch kênh lớn nhất giữa hai màu — để chứng minh mức chỉnh là nhỏ. */
function channelDrift(a: string, b: string): number {
  const [x, y] = [channels(a), channels(b)];
  return Math.max(...x.map((c, i) => Math.abs(c - y[i])));
}

/** Tương phản WCAG 2.1 — tính độc lập với code đang test. */
function contrastRatio(a: string, b: string): number {
  const lum = (value: string) => {
    const lin = channels(value)
      .map((c) => c / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
