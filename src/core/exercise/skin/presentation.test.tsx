/**
 * skin.presentation — SHAPE theo surface (Owner 30/7, phương án 2):
 *
 *   • playfulSkin (surface "Học sinh") bật đủ 5 cờ hình dạng — preview khớp
 *     evo-books-web cả hình dạng: TOÀN BỘ content là tiêu đề to + 1 accent bar
 *     (Owner 30/7, bỏ heuristic block đầu), single-choice pill mọi layout,
 *     true/false 2 pill cạnh nhau, tile lưới to 2 cột, blank TO cố định 7rem.
 *   • studioSkin (QA) KHÔNG khai presentation — mọi cờ tắt, render trung thực
 *     theo sách: không phịa heading, radio-row ở list, stack dọc, clamp 42cqi.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { SkinProvider } from "./context";
import { AccentProvider } from "./accent-context";
import { PLAYER_ACCENTS } from "./accents";
import { playfulAccentSkin, playfulSkin, studioSkin } from "./skins";
import { RichContentBlocks, type ContentBlock } from "../players/shared";
import { SingleChoicePlayer } from "../players/SingleChoicePlayer";
import { TrueFalsePlayer } from "../players/TrueFalsePlayer";
import { TileSelectPlayer } from "../players/TileSelectPlayer";
import { FillBlankPlayer, type FillSegment } from "../players/FillBlankPlayer";

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

/** Mount `children` under the playful skin + a player accent (the student surface). */
function renderPlayful(children: ReactElement) {
  act(() => {
    root.render(
      <SkinProvider skin="playful">
        <AccentProvider accent="blue">{children}</AccentProvider>
      </SkinProvider>,
    );
  });
}

/**
 * Cùng surface học sinh nhưng khai `contentAsHeading: true` — nhánh "CẢ KHỐI
 * content là đề bài" của studio. Web-own SBT khai `"lead"`, nên các ca đo vị
 * trí thanh accent ở CUỐI đề phải tự dựng skin thay vì dùng skin mặc định.
 */
const allHeadingSkin = {
  name: "playful" as const,
  forAccent: (accent: Parameters<typeof playfulAccentSkin.forAccent>[0]) => {
    const tokens = playfulAccentSkin.forAccent(accent);
    return { ...tokens, presentation: { ...tokens.presentation, contentAsHeading: true as const } };
  },
};

function renderAllHeading(children: ReactElement) {
  act(() => {
    root.render(
      <SkinProvider skin={allHeadingSkin}>
        <AccentProvider accent="blue">{children}</AccentProvider>
      </SkinProvider>,
    );
  });
}

describe("presentation flags on the built-in skins", () => {
  it("playfulSkin declares ALL shape flags (accent-independent part of the factory)", () => {
    // web-own: skin mặc định của web là bản CHỈ-CỜ — cùng bộ cờ với factory.
    expect(playfulSkin.presentation).toEqual({
      contentAsHeading: "lead",
      choicePill: true,
      pairedBinaryChoice: true,
      bigTiles: true,
      spaciousBlanks: true,
      autoMediaSizing: true,
      // Cờ ĐẢO CHIỀU duy nhất: khai `true` = ẨN dòng phản hồi đúng/sai
      // tự-hiển-thị trong nội dung câu. Xem inline-feedback-gate.test.tsx.
      hideInlineFeedback: true,
    });
    // Any accent — presentation must not depend on it.
    const tokens = playfulAccentSkin.forAccent(PLAYER_ACCENTS.fuchsia);
    expect(tokens.presentation).toEqual({
      contentAsHeading: "lead",
      choicePill: true,
      pairedBinaryChoice: true,
      bigTiles: true,
      spaciousBlanks: true,
      autoMediaSizing: true,
      // Cờ ĐẢO CHIỀU duy nhất: khai `true` = ẨN dòng phản hồi đúng/sai
      // tự-hiển-thị trong nội dung câu. Xem inline-feedback-gate.test.tsx.
      hideInlineFeedback: true,
    });
  });

  it("studioSkin declares NO presentation flags — QA renders faithfully", () => {
    // Gồm cả `autoMediaSizing`: preview studio giữ ảnh NGUYÊN KHỔ xếp dọc, nên
    // sau khi bỏ lightbox thì đây chính là đường xem ảnh cỡ thật cho người
    // duyệt nội dung. Đánh đổi: câu nhiều ảnh trông khác surface học sinh.
    expect(studioSkin.presentation).toBeUndefined();
  });
});

describe("contentAsHeading (RichContentBlocks)", () => {
  const blocks: ContentBlock[] = [
    { type: "paragraph", content: [{ text: "Đề bài dẫn nhập", annotations: {} }] },
    { type: "paragraph", content: [{ text: "Đoạn nội dung theo sau.", annotations: {} }] },
  ];

  it("lead: CHỈ đoạn đầu là h2, đoạn sau giữ prose, vạch ngay dưới tiêu đề", () => {
    renderPlayful(<RichContentBlocks blocks={blocks} />);
    const h2s = Array.from(container.querySelectorAll("h2"));
    expect(h2s.map((h) => h.textContent)).toEqual(["Đề bài dẫn nhập"]);
    expect(h2s[0].className).toContain("font-player-display");
    // Đoạn thứ hai là ngữ liệu — body prose, KHÔNG phóng cỡ tiêu đề.
    expect(Array.from(container.querySelectorAll("p")).map((el) => el.textContent)).toEqual([
      "Đoạn nội dung theo sau.",
    ]);
    // Đúng MỘT thanh accent, đứng ngay sau tiêu đề chứ không phải cuối đề.
    const bars = Array.from(container.querySelectorAll("div")).filter((d) => d.className.includes("bg-blue-400"));
    expect(bars.length).toBe(1);
    expect(h2s[0].nextElementSibling).toBe(bars[0]);
  });

  it("lead: nhiều đoạn → vẫn đúng MỘT h2 và một vạch, phần còn lại là <p>", () => {
    renderPlayful(
      <RichContentBlocks
        blocks={[
          { type: "paragraph", content: [{ text: "Đoạn một", annotations: {} }] },
          { type: "paragraph", content: [{ text: "Đoạn hai", annotations: {} }] },
          { type: "paragraph", content: [{ text: "Đoạn ba", annotations: {} }] },
        ]}
      />,
    );
    expect(container.querySelectorAll("h2").length).toBe(1);
    expect(container.querySelectorAll("p").length).toBe(2);
    const bars = Array.from(container.querySelectorAll("div")).filter((d) => d.className.includes("bg-blue-400"));
    expect(bars.length).toBe(1);
    expect(container.querySelector("h2")!.nextElementSibling).toBe(bars[0]);
  });

  it("lead: đề mang ngữ liệu — câu lệnh lên tiêu đề, đoạn trích và nguồn dẫn giữ prose", () => {
    // Ca thật 72700 (bai1 LUYỆN TỪ VÀ CÂU): [câu lệnh, đoạn văn, nguồn dẫn].
    // Để cả khối lên heading thì đoạn trích to đậm ngang câu lệnh — lý do bật "lead".
    renderPlayful(
      <RichContentBlocks
        blocks={[
          { type: "paragraph", content: [{ text: "Đọc đoạn văn dưới đây và tìm từ theo yêu cầu.", annotations: {} }] },
          { type: "paragraph", content: [{ text: "Sân thượng nhà Uyển là một trang trại tí hon.", annotations: {} }] },
          { type: "paragraph", content: [{ text: "(Ngân Quỳnh)", annotations: {} }] },
        ]}
      />,
    );
    const h2 = container.querySelector("h2")!;
    expect(h2.textContent).toBe("Đọc đoạn văn dưới đây và tìm từ theo yêu cầu.");
    const bars = Array.from(container.querySelectorAll("div")).filter((d) => d.className.includes("bg-blue-400"));
    expect(bars.length).toBe(1);
    expect(h2.nextElementSibling).toBe(bars[0]);
    expect(Array.from(container.querySelectorAll("p")).map((el) => el.textContent)).toEqual([
      "Sân thượng nhà Uyển là một trang trại tí hon.",
      "(Ngân Quỳnh)",
    ]);
  });

  it("contentAsHeading=true: đề kết bằng ẢNH thì vạch nằm DƯỚI ảnh", () => {
    // Ca thật `10834585/bai26` câu 3 (Owner 8/8): [chữ, chữ, hình thang vuông].
    // Vạch là ngăn giữa đề và phần trả lời, không phải gạch chân dòng chữ cuối.
    renderAllHeading(
      <RichContentBlocks
        blocks={[
          { type: "paragraph", content: [{ text: "Khoanh vào chữ đặt trước câu trả lời đúng.", annotations: {} }] },
          { type: "paragraph", content: [{ text: "Trong hình bên:", annotations: {} }] },
          { type: "image", url: "/uploads/trap.png", alt: "hình thang vuông" } as ContentBlock,
        ]}
      />,
    );
    const bars = Array.from(container.querySelectorAll("div")).filter((d) =>
      d.className.includes("bg-blue-400"),
    );
    expect(bars.length).toBe(1);
    // Vạch đứng SAU ảnh: mọi <img> phải nằm trước nó trong thứ tự tài liệu.
    const picture = container.querySelector("img")!;
    expect(picture.compareDocumentPosition(bars[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("contentAsHeading=true: đề kết bằng LƯỚI ảnh (block bị nuốt) — vạch dưới cả lưới", () => {
    renderAllHeading(
      <RichContentBlocks
        blocks={[
          { type: "paragraph", content: [{ text: "Quan sát:", annotations: {} }] },
          { type: "image", url: "/uploads/a.png" } as ContentBlock,
          { type: "image", url: "/uploads/b.png" } as ContentBlock,
        ]}
        allowMediaGrid
      />,
    );
    const bars = Array.from(container.querySelectorAll("div")).filter((d) =>
      d.className.includes("bg-blue-400"),
    );
    expect(bars.length).toBe(1);
    const grid = container.querySelector('[data-testid="content-media-grid"]')!;
    expect(grid.nextElementSibling).toBe(bars[0]);
  });

  it("playful: blank-marker block keeps prose (inputs must not scale to h2); bar follows the last REAL heading", () => {
    renderPlayful(
      <RichContentBlocks
        blocks={[
          { type: "paragraph", content: [{ text: "Đề bài", annotations: {} }] },
          { type: "paragraph", content: [{ text: "Điền {blank_1} vào", annotations: {} }] },
        ]}
        renderInlineBlank={() => <input aria-label="blank" />}
      />,
    );
    const h2s = container.querySelectorAll("h2");
    expect(h2s.length).toBe(1);
    expect(h2s[0].textContent).toBe("Đề bài");
    // The marker paragraph renders as prose with the inline input in place.
    const p = container.querySelector("p");
    expect(p?.querySelector("input")).toBeTruthy();
    expect(p?.textContent).toContain("Điền");
    // The bar sits after the heading, not after the prose blank block.
    expect(h2s[0].nextElementSibling?.className).toContain("bg-blue-400");
  });

  it("lead: heading TÁC GIẢ mở đầu vẫn là đề bài — giữ cấp, nhận cỡ to, có vạch", () => {
    renderPlayful(
      <RichContentBlocks
        blocks={[
          { type: "heading", level: 3, content: [{ text: "Tiêu đề tác giả", annotations: {} }] },
          { type: "paragraph", content: [{ text: "Ngữ liệu theo sau", annotations: {} }] },
        ]}
      />,
    );
    // `"lead"` là bản thu hẹp của `true`: cùng vị từ chấp nhận, nên heading tác
    // giả được thăng cấp y như nhánh `true` — giữ semantics level, nhận cỡ to.
    const h4 = container.querySelector('[data-content-heading-level="3"]');
    expect(h4?.tagName).toBe("H4");
    expect(h4?.className).toContain("font-player-display");
    // Vạch accent đóng ngay dưới nó; đoạn sau là ngữ liệu, giữ prose.
    const bars = Array.from(container.querySelectorAll("div")).filter((d) => d.className.includes("bg-blue-400"));
    expect(bars.length).toBe(1);
    expect(h4?.nextElementSibling).toBe(bars[0]);
    expect(container.querySelector("p")?.textContent).toBe("Ngữ liệu theo sau");
  });

  it("lead: KHÔNG bước qua bảng/list/quote để nhặt đoạn sau làm tiêu đề", () => {
    // Đoạn văn đứng sau một cái bảng là chú thích của bảng, không phải câu lệnh.
    // Bước qua thì "(Ngân Quỳnh)" thành tiêu đề và vạch rơi xuống đáy content.
    renderPlayful(
      <RichContentBlocks
        blocks={[
          { type: "list", ordered: false, items: ["Mục một"], itemsRuns: [[{ text: "Mục một", annotations: {} }]] },
          { type: "paragraph", content: [{ text: "(Ngân Quỳnh)", annotations: {} }] },
        ]}
      />,
    );
    expect(container.querySelector("h2")).toBeFalsy();
    expect(
      Array.from(container.querySelectorAll("div")).filter((d) => d.className.includes("bg-blue-400")).length,
    ).toBe(0);
  });

  it("lead: ẢNH sau câu lệnh là ngữ liệu — vạch ở TRÊN ảnh, cố ý khác luật Owner 8/8", () => {
    // Owner chốt 25/08/2026 sau khi so hai phương án trên /dev/players (câu
    // "Đọc bản nhạc…"): ở chế độ "lead", hình đứng sau câu lệnh nằm DƯỚI vạch.
    // Nhánh `contentAsHeading: true` vẫn giữ luật 8/8 (vạch đóng dưới hình) —
    // ca đó do test "contentAsHeading=true: đề kết bằng ẢNH…" ở trên khoá.
    renderPlayful(
      <RichContentBlocks
        blocks={[
          { type: "paragraph", content: [{ text: "Đọc bản nhạc rồi cho biết bài hát ở nhịp mấy?", annotations: {} }] },
          { type: "image", url: "/uploads/ban-nhac.png", alt: "bản nhạc" } as ContentBlock,
        ]}
      />,
    );
    const h2 = container.querySelector("h2")!;
    const bars = Array.from(container.querySelectorAll("div")).filter((d) => d.className.includes("bg-blue-400"));
    expect(bars.length).toBe(1);
    expect(h2.nextElementSibling).toBe(bars[0]);
    // Ảnh đứng SAU vạch trong thứ tự tài liệu.
    const picture = container.querySelector("img")!;
    expect(bars[0].compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("lead: đoạn thụt lề mở đầu vẫn được thăng cấp (cùng luật với nhánh true)", () => {
    renderPlayful(
      <RichContentBlocks
        blocks={[
          { type: "paragraph", content: [{ text: "   Điền dấu chấm vào ô trống.", annotations: {} }] },
          { type: "paragraph", content: [{ text: "Tú nói với anh Việt:", annotations: {} }] },
        ]}
      />,
    );
    const h2 = container.querySelector("h2");
    expect(h2?.textContent).toContain("Điền dấu chấm vào ô trống.");
    expect(h2?.nextElementSibling?.className).toContain("bg-blue-400");
  });

  it("playful: empty spacer paragraph keeps its <br> and never becomes an empty heading", () => {
    renderPlayful(
      <RichContentBlocks
        blocks={[
          { type: "paragraph", content: [{ text: "Đoạn một", annotations: {} }] },
          { type: "paragraph", content: [] },
          { type: "paragraph", content: [{ text: "Đoạn hai", annotations: {} }] },
        ]}
      />,
    );
    expect(container.querySelectorAll("h2").length).toBe(1);
    expect(container.querySelector("p br")).toBeTruthy();
  });

  it("studio skin: renders faithfully — no heading typography, no bar", () => {
    // web-own: default context skin của web là playful — chỉ định skin="studio" tường minh.
    act(() => {
      root.render(
        <SkinProvider skin="studio">
          <RichContentBlocks blocks={blocks} />
        </SkinProvider>,
      );
    });
    expect(container.querySelector("h2")).toBeFalsy();
    expect(container.querySelectorAll("p").length).toBe(2);
  });
});

describe("choicePill (SingleChoicePlayer)", () => {
  const props = {
    title: "Chọn đáp án",
    options: [{ id: "a", text: "Một" }, { id: "b", text: "Hai" }],
    correctId: "b",
    selfAssessment: true,
  };

  it.each(["list", "grid_2", "inline"] as const)(
    "playful: pill chrome (rounded-full border-4) + letter label in %s layout",
    (layout) => {
      renderPlayful(<SingleChoicePlayer {...props} layout={layout} />);
      const option = container.querySelector<HTMLButtonElement>('[role="radio"]');
      expect(option?.classList.contains("rounded-full")).toBe(true);
      expect(option?.classList.contains("border-4")).toBe(true);
      // No radio-row dot marker; the generated "a." reference letter stays.
      expect(option?.querySelector('span[aria-hidden="true"]')).toBeFalsy();
      expect(option?.textContent).toContain("a.");
    },
  );

  it("studio skin: list layout keeps the faithful radio-row branch", () => {
    // web-own: default context skin của web là playful — chỉ định skin="studio" tường minh.
    act(() => {
      root.render(
        <SkinProvider skin="studio">
          <SingleChoicePlayer {...props} layout="list" />
        </SkinProvider>,
      );
    });
    const option = container.querySelector<HTMLButtonElement>('[role="radio"]');
    expect(option?.classList.contains("rounded-full")).toBe(false);
    expect(option?.querySelector('span[aria-hidden="true"]')).toBeTruthy();
  });
});

describe("pairedBinaryChoice (TrueFalsePlayer)", () => {
  it("playful: no authored layout → two pills side by side, centered", () => {
    renderPlayful(<TrueFalsePlayer title="Đúng hay sai?" correct selfAssessment />);
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.className).toBe("flex flex-wrap gap-4 justify-center");
    expect(group?.getAttribute("data-display-layout")).toBe("inline");
  });

  it("playful: an authored layout is still honored", () => {
    renderPlayful(
      <TrueFalsePlayer title="Đúng hay sai?" correct selfAssessment layout="grid_2" />,
    );
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute("data-display-layout")).toBe("grid_2");
  });

  it("studio skin: stacked vertical list", () => {
    // web-own: default context skin của web là playful — chỉ định skin="studio" tường minh.
    act(() => {
      root.render(
        <SkinProvider skin="studio">
          <TrueFalsePlayer title="Đúng hay sai?" correct selfAssessment />
        </SkinProvider>,
      );
    });
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.className).toBe("flex flex-col gap-2 sm:gap-3");
    expect(group?.getAttribute("data-display-layout")).toBe("list");
  });
});

describe("bigTiles (TileSelectPlayer)", () => {
  const props = {
    title: "Chọn ô",
    options: [
      { id: "a", text: "Một" },
      { id: "b", text: "Hai" },
      { id: "c", text: "Ba" },
      { id: "d", text: "Bốn" },
    ],
    correctId: "b",
  };

  it("playful: no authored layout → big Kahoot 2-column grid, full-size tiles", () => {
    renderPlayful(<TileSelectPlayer {...props} />);
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.className).toBe("grid grid-cols-2 gap-3 sm:gap-4");
    expect(group?.getAttribute("data-display-layout")).toBe("grid_2");
    const tile = container.querySelector<HTMLButtonElement>('[role="radio"]');
    expect(tile?.classList.contains("rounded-3xl")).toBe(true);
    // The studio hug-content prefix must NOT wrap the joyful tile chrome.
    expect(tile?.classList.contains("min-w-0")).toBe(false);
  });

  it("studio skin: follows layoutContainerClass (vertical list default)", () => {
    // web-own: default context skin của web là playful — chỉ định skin="studio" tường minh.
    act(() => {
      root.render(
        <SkinProvider skin="studio">
          <TileSelectPlayer {...props} />
        </SkinProvider>,
      );
    });
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.className).toBe("flex flex-col gap-2 sm:gap-3");
    expect(group?.getAttribute("data-display-layout")).toBe("list");
  });

  // WEB18 — thẻ đáp án chữ một từ ở surface studio từng bị kéo cao 96–120px vì
  // prefix của player đè sàn chiều cao lên chrome gọn của `studioSkin`
  // (`px-4 py-2.5 text-sm`). Nay chỉ còn sàn vùng chạm 44px.
  it("studio: tile chữ ngắn co gọn theo nội dung, giữ khoảng đệm của skin", () => {
    act(() => {
      root.render(
        <SkinProvider skin="studio">
          <TileSelectPlayer {...props} multiple layout="grid_2" />
        </SkinProvider>,
      );
    });
    const tile = container.querySelector<HTMLButtonElement>('[role="checkbox"]');
    expect(tile?.className).toContain("min-h-11");
    expect(tile?.className).not.toContain("min-h-[96px]");
    expect(tile?.className).not.toContain("sm:min-h-[120px]");
    // Khoảng đệm vẫn đến từ studioSkin.optionCard, không bị prefix nuốt.
    expect(tile?.className).toContain("px-4");
    expect(tile?.className).toContain("py-2.5");
    // Lưới vẫn cân đối: ô giãn đều theo cột.
    const group = container.querySelector('[role="group"]');
    expect(group?.classList.contains("sm:grid-cols-2")).toBe(true);
  });

  // Surface học sinh (playful, bigTiles) KHÔNG bị WEB18 làm gọn — tile to kiểu
  // Kahoot là chrome cố ý của web. Test này là chốt chặn cho lần sửa sau.
  it("playful: tile TO giữ nguyên chrome joyful (không bị WEB18 làm gọn)", () => {
    renderPlayful(<TileSelectPlayer {...props} />);
    const tile = container.querySelector<HTMLButtonElement>('[role="radio"]');
    expect(tile?.className).toContain("min-h-[96px]");
    expect(tile?.className).toContain("sm:min-h-[120px]");
  });
});

describe("spaciousBlanks (FillBlankPlayer)", () => {
  const segments: FillSegment[] = [
    { text: "Ăn quả nhớ kẻ " },
    { blankId: "b1", acceptedAnswers: ["trồng cây"], widthAuthored: false },
  ];

  // Từ khi ô điền tự giãn, cỡ nói ở ba test dưới là SÀN (`min-width`) chứ không
  // còn là hộp khoá (`width`) — ô mở ra đúng cỡ đó lúc trống rồi chỉ rộng thêm
  // theo chữ. Tương quan giữa hai surface giữ nguyên: playful cố định, studio
  // vẫn co theo khung. Ô tác giả KHAI width cũng vào luật đó trên surface học
  // sinh (xem test giữa) — chỉ surface studio còn khoá cứng, để người soạn thấy
  // đúng con số mình đặt.
  it("playful: default blank opens at a FIXED 7rem floor (no 42cqi clamp)", () => {
    const html = renderToString(
      <SkinProvider skin="playful">
        <AccentProvider accent="amber">
          <FillBlankPlayer title="Điền" segments={segments} selfAssessment />
        </AccentProvider>
      </SkinProvider>,
    );
    // Sàn nay suy từ đáp án ("trồng cây" 9 ký tự → 11ch, Owner 12/8); điểm của
    // test này vẫn là playful KHÔNG clamp 42cqi, khác studio ngay dưới.
    expect(html).toContain("min-width:11ch");
    expect(html).not.toContain("42cqi");
  });

  it("playful: width tác giả khai thành SÀN — ô vẫn nở theo chữ, không cắt", () => {
    const html = renderToString(
      <SkinProvider skin="playful">
        <AccentProvider accent="amber">
          <FillBlankPlayer
            title="Điền"
            segments={[
              { text: "Ăn " },
              { blankId: "b1", acceptedAnswers: ["x"], width: "12rem", widthAuthored: true },
            ]}
            selfAssessment
          />
        </AccentProvider>
      </SkinProvider>,
    );
    // Sàn đúng con số tác giả khai — ô vẫn MỞ RA ở 12rem như ý đồ tác giả…
    expect(html).toContain("min-width:12rem");
    // …nhưng không còn trần, nên chữ dài hơn 12rem không bị nuốt vào hộp cuộn.
    expect(html).not.toContain("max-width:12rem");
    expect(html).not.toContain("42cqi");
  });

  it("studio skin: default blank keeps the responsive clamp as its floor", () => {
    // web-own: default context skin của web là playful — chỉ định skin="studio" tường minh.
    const html = renderToString(
      <SkinProvider skin="studio">
        <FillBlankPlayer title="Điền" segments={segments} selfAssessment />
      </SkinProvider>,
    );
    expect(html).toContain("min-width:max(3.5rem, min(11ch, 42cqi))");
  });
});
