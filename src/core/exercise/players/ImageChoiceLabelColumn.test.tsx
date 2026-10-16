/**
 * Issue #815 — thẻ image-choice có nhãn chữ đi kèm phải luôn xếp DỌC.
 *
 * `skin.optionCard` trả về TOÀN BỘ className (kể cả layout) và thay thế hẳn
 * fallback của player (xem chú thích đầu `skin/skins.ts`). `studioSkin` — cũng
 * là `defaultSkin`, tức skin mặc định khi không có `SkinProvider` — trả
 * `flex items-center`, một HÀNG NGANG. Nếu ảnh (`w-full aspect-square`) và
 * nhãn là con trực tiếp của nút thì ảnh chiếm gần hết hàng, nhãn bị ép thành
 * cột hẹp, tràn khỏi thẻ và chen sang cột kế bên của `grid_2`.
 *
 * Bản sửa: player tự sở hữu một khối bọc dọc bên trong nút, nên layout không
 * còn phụ thuộc skin. Token `optionCard` giữ nguyên cho các player dạng hàng
 * ngang (pill, chấm Likert, ô bảng) — khoá lại ở describe cuối file.
 *
 * jsdom không layout → test khoá cấu trúc DOM + class, không đo pixel.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SkinProvider, studioSkin } from "@/core/exercise/skin";
import { renderInteractionPlayer } from "./dispatch";
import { SingleChoicePlayer } from "./SingleChoicePlayer";

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
 * Phương án đúng hình dạng b13q1: `content.blocks` gồm khối ảnh + khối chữ.
 * Không có `imageUrl`/`text` phẳng — buộc đi qua `adaptImageOptions`.
 */
const blockOption = (i: number) => ({
  id: `o${i}`,
  content: {
    blocks: [
      {
        type: "image",
        url: `/uploads/books/6a60377f27dd0c46380749cc/assets/bai13_q1_${i}.png`,
        alt: `Việc tự phục vụ ${i}`,
        align: "center",
        altText: `Việc tự phục vụ ${i}`,
      },
      {
        type: "paragraph",
        align: "center",
        content: [{ text: `Lau miệng, rửa tay trước và sau khi ăn ${i}`, annotations: {} }],
      },
    ],
  },
});

const payload = (layout: string, count: number) => ({
  content: {
    blocks: [
      {
        type: "paragraph",
        content: [{ text: "Đánh dấu ✓ vào ☐ ở những việc em đã tự làm.", annotations: {} }],
      },
    ],
  },
  display: { layout, interactionType: "image" },
  selfAssessment: true,
  options: Array.from({ length: count }, (_, i) => blockOption(i + 1)),
});

const cards = () => Array.from(container.querySelectorAll<HTMLElement>('[role="checkbox"], [role="radio"]'));

/** Khối bọc dọc do player sở hữu, bên trong nút. */
const columnOf = (card: HTMLElement) => card.querySelector<HTMLElement>(":scope > span.flex-col");

describe("issue #815 — image-choice có nhãn: ảnh trên, chữ dưới trong cùng thẻ", () => {
  // Cả hai nhánh skin: studio (mặc định, có optionCard hàng ngang) và playful
  // (cố tình KHÔNG khai optionCard → dùng fallback flex-col của player).
  it.each(["studio", "playful"] as const)(
    "multiple_choice + grid_2 dưới %s: nhãn nằm trong nút, xếp dọc dưới ảnh",
    (skin) => {
      act(() => {
        root.render(
          <SkinProvider skin={skin}>
            {renderInteractionPlayer("multiple_choice", payload("grid_2", 9), {})}
          </SkinProvider>,
        );
      });

      const all = cards();
      expect(all).toHaveLength(9);
      expect(container.querySelector<HTMLElement>("[data-display-layout]")!.dataset.displayLayout).toBe("grid_2");

      for (const card of all) {
        const column = columnOf(card);
        // Ảnh và nhãn phải cùng nằm trong khối dọc — không phải con trực tiếp
        // của nút, nơi `optionCard` của skin quyết định phương của flex.
        expect(column).not.toBeNull();
        expect(column!.className).toContain("flex-col");
        expect(column!.className).toContain("w-full");
        expect(column!.className).toContain("min-w-0");

        const img = column!.querySelector("img")!;
        const label = column!.querySelector("span.break-words")!;
        expect(img).not.toBeNull();
        expect(label.textContent).toContain("Lau miệng, rửa tay trước và sau khi ăn");
        // Chữ đứng SAU ảnh trong cùng khối → ảnh trên, chữ dưới.
        expect(img.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        // Nhãn phải xuống dòng trong bề rộng thẻ thay vì tràn ra ngoài.
        expect(label.className).toContain("break-words");
        expect(label.className).toContain("min-w-0");
        // Nút vẫn chặn phần tử con làm rộng ô lưới.
        expect(card.className).toContain("min-w-0");
        expect(card.className).toContain("max-w-full");
      }
    },
  );

  it("single_choice + grid_2 dưới studioSkin cũng xếp dọc", () => {
    act(() => {
      root.render(
        <SkinProvider skin="studio">
          {renderInteractionPlayer("single_choice", payload("grid_2", 4), {})}
        </SkinProvider>,
      );
    });

    const all = cards();
    expect(all).toHaveLength(4);
    for (const card of all) {
      const column = columnOf(card);
      expect(column).not.toBeNull();
      expect(column!.className).toContain("flex-col");
      expect(column!.querySelector("img")).not.toBeNull();
      expect(column!.querySelector("span.break-words")!.textContent).toContain("Lau miệng");
    }
  });

  // Năm layout được hỗ trợ phải giữ nguyên hợp đồng container + cấu trúc thẻ.
  it.each([
    ["list", "flex flex-col"],
    ["grid_2", "sm:grid-cols-2"],
    ["grid_3", "lg:grid-cols-3"],
    ["grid_4", "lg:grid-cols-4"],
    ["inline", "flex flex-wrap"],
  ] as const)("layout %s: container giữ class cũ, thẻ vẫn xếp dọc", (layout, expected) => {
    act(() => {
      root.render(
        <SkinProvider skin="studio">
          {renderInteractionPlayer("multiple_choice", payload(layout, 4), {})}
        </SkinProvider>,
      );
    });

    const group = container.querySelector<HTMLElement>("[data-display-layout]")!;
    expect(group.dataset.displayLayout).toBe(layout);
    for (const token of expected.split(" ")) expect(group.className).toContain(token);
    for (const card of cards()) expect(columnOf(card)!.className).toContain("flex-col");
  });
});

describe("issue #815 — token optionCard dùng chung không đổi", () => {
  // Bản sửa nằm hoàn toàn trong player; token `optionCard` — dùng chung bởi 10
  // player với 4 hình dạng khác nhau (pill, tile, chấm, ô bảng) — phải giữ
  // nguyên chuỗi hàng ngang, nếu không pill/chấm/ô bảng sẽ vỡ.
  it("studioSkin.optionCard vẫn là hàng ngang cho mọi state", () => {
    for (const state of ["idle", "selected", "correct", "wrong"] as const) {
      const cls = studioSkin.optionCard!(state, "primary")!;
      expect(cls).toContain("flex items-center");
      expect(cls).not.toContain("flex-col");
    }
  });

  it("SingleChoicePlayer (pill) không bị kéo sang xếp dọc", () => {
    act(() => {
      root.render(
        <SkinProvider skin="studio">
          <SingleChoicePlayer title="Q" options={[{ id: "a", text: "Đúng" }]} correctId="a" />
        </SkinProvider>,
      );
    });
    const pill = container.querySelector<HTMLElement>('[role="radio"]')!;
    expect(pill.className).toContain("flex");
    expect(pill.className).not.toContain("flex-col");
  });
});
