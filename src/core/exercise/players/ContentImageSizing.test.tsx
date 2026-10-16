/**
 * Ảnh nội dung trong player giữ kích thước gốc — khung co theo ảnh.
 *
 * Hồi quy cho bản scan vở bài tập bị ép qua khung nhỏ rồi QA từ chối
 * "ảnh quá bé" (câu classification / interaction `buckets`). PR #644 đã sửa
 * cho nhóm matching nhưng không với tới các player tự viết thẻ `<img>` với
 * class cap cứng — file này khoá lại toàn bộ nhóm còn lại.
 *
 * jsdom không layout ảnh, nên bài test khoá đường ống class sinh ra kích
 * thước: kích thước gốc, không khung vuông, không cap rộng/cao.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SkinProvider } from "@/core/exercise/skin";
import type { QuestionPlayerSkin } from "@/core/exercise/skin";
import { MEDIA_ITEM_MAX_HEIGHT } from "./shared";
import { CategorizePlayer } from "./CategorizePlayer";
import { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";
import { CardSortPlayer } from "./CardSortPlayer";
import { CheckboxTablePlayer } from "./CheckboxTablePlayer";
import { ReorderListPlayer } from "./ReorderListPlayer";

/** Surface học sinh — cờ chỉnh cỡ ảnh BẬT (studioSkin để mặc định TẮT). */
const AUTO_MEDIA_SKIN: QuestionPlayerSkin = { presentation: { autoMediaSizing: true } };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * Mọi ảnh nội dung phải ở kích thước gốc: không khung vuông, không cắt ảnh,
 * không ép tỉ lệ — thẻ co theo ẢNH.
 *
 * Cập nhật 31/7: được phép có ĐÚNG hai trần, và chỉ hai:
 *  - `max-w-full` (không tràn ngang khỏi cột);
 *  - `style.maxHeight` = MEDIA_ITEM_MAX_HEIGHT (22rem, ngay trên p50 đo được
 *    336px) — chỉ cắn vào đuôi phân bố, kèm nút phóng to làm van xả.
 * Ảnh cỡ trung vị vẫn y như trước, nên hồi quy "ảnh quá bé" vẫn được khoá.
 */
function expectNaturalSize(img: HTMLImageElement | null | undefined) {
  expect(img).toBeTruthy();
  const cls = img!.className;
  expect(img!.classList.contains("h-auto")).toBe(true);
  expect(img!.classList.contains("w-auto")).toBe(true);
  expect(img!.classList.contains("object-contain")).toBe(true);
  expect(cls).not.toContain("object-cover");
  expect(cls).not.toContain("aspect-");
  // Không cap cứng theo class (h-24, w-16, max-h-48…) — chỉ trần theo cột.
  expect(cls).not.toContain("max-h");
  expect(cls.replace("max-w-full", "")).not.toContain("max-w");
  expect(img!.style.maxHeight).toBe(MEDIA_ITEM_MAX_HEIGHT);
}

const imgs = () => Array.from(container.querySelectorAll("img"));

describe("ảnh nội dung giữ kích thước gốc", () => {
  it("classification/buckets — ảnh mục và ảnh tiêu đề nhóm (lỗi QA gốc)", () => {
    act(() => {
      root.render(
        <SkinProvider skin={AUTO_MEDIA_SKIN}>
        <CategorizePlayer
          title="Tô màu đỏ vào bông hoa ở những hình không an toàn"
          categories={[{ id: "safe", label: "An toàn", imageUrl: "/an-toan.png" }]}
          items={[{ id: "i1", text: "", imageUrl: "/scan-1.png" }]}
          correctMappings={{ i1: "safe" }}
        />,
        </SkinProvider>,
      );
    });
    const found = imgs();
    expect(found).toHaveLength(2);
    // The unsorted tray is an interaction control: picture cards are compact
    // so multiple draggable scans can share a horizontal row. The category
    // header remains ordinary content media and keeps its natural-size policy.
    expect(found[0].className).toContain("sm:!max-h-40");
    expectNaturalSize(found[1]);
  });

  it("classification/two_bucket — ảnh thẻ và ảnh tiêu đề rổ", () => {
    act(() => {
      root.render(
        <SkinProvider skin={AUTO_MEDIA_SKIN}>
        <TwoBucketSortPlayer
          title="Chia hai nhóm"
          buckets={[
            { id: "b1", label: "Nhóm 1", imageUrl: "/ro-1.png" },
            { id: "b2", label: "Nhóm 2" },
          ]}
          items={[{ id: "i1", text: "", imageUrl: "/scan-2.png" }]}
          correctMappings={{ i1: "b1" }}
        />,
        </SkinProvider>,
      );
    });
    imgs().forEach(expectNaturalSize);
    expect(imgs().length).toBeGreaterThan(0);
  });

  it("classification/card_sort — ảnh thẻ", () => {
    act(() => {
      root.render(
        <SkinProvider skin={AUTO_MEDIA_SKIN}>
        <CardSortPlayer
          title="Phân loại thẻ"
          categories={[{ id: "c1", label: "Nhóm 1" }]}
          cards={[{ id: "i1", text: "", imageUrl: "/scan-3.png" }]}
          correctMappings={{ i1: "c1" }}
        />,
        </SkinProvider>,
      );
    });
    imgs().forEach(expectNaturalSize);
    expect(imgs().length).toBeGreaterThan(0);
  });

  it("bảng — ảnh trong nội dung hàng", () => {
    act(() => {
      root.render(
        <SkinProvider skin={AUTO_MEDIA_SKIN}>
        <CheckboxTablePlayer
          title="Đánh dấu vào ô"
          columns={[{ id: "c1", label: "Có" }]}
          rows={[{ id: "r1", label: "", imageUrl: "/scan-4.png" }]}
          correctCells={{ r1: ["c1"] }}
        />,
        </SkinProvider>,
      );
    });
    imgs().forEach(expectNaturalSize);
    expect(imgs().length).toBeGreaterThan(0);
  });

  it("ordering/sortable-list — ảnh mục", () => {
    act(() => {
      root.render(
        <SkinProvider skin={AUTO_MEDIA_SKIN}>
        <ReorderListPlayer
          title="Sắp xếp"
          items={[
            { id: "i1", text: "", imageUrl: "/scan-5.png" },
            { id: "i2", text: "Hai" },
          ]}
          correctOrder={["i1", "i2"]}
        />,
        </SkinProvider>,
      );
    });
    imgs().forEach(expectNaturalSize);
    expect(imgs().length).toBeGreaterThan(0);
  });
});
