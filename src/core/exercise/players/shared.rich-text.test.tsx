import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RichContentBlock } from "@/core/question-schema";
import { SkinProvider } from "../skin/context";
import { RichContentBlocks } from "./shared";

describe("RichContentBlocks text alignment", () => {
  // web-own SBT: `contentAsHeading: "lead"` — CHỈ block text ĐẦU thành tiêu đề
  // to đậm + thanh accent NGAY dưới nó; phần content còn lại là ngữ liệu nên
  // giữ body prose. Heading TÁC GIẢ giữ semantics level và cỡ faithful.
  it("promotes ONLY the lead text block, accent bar right under it", () => {
    const html = renderToString(
      <RichContentBlocks
        blocks={[
          { type: "paragraph", content: [{ text: "Lời dẫn", annotations: {} }] },
          { type: "heading", level: 3, content: [{ text: "Câu chuyện mùa đông", annotations: {} }] },
          { type: "paragraph", content: [{ text: "Mùa đông vừa gõ cửa…", annotations: {} }] },
        ]}
      />,
    );

    expect(html).toMatch(/<h2[^>]*>.*Lời dẫn.*<\/h2>/); // đoạn đầu là tiêu đề
    expect(html).toContain('data-content-heading-level="3"');
    expect(html).toContain("</h4>"); // heading tác giả giữ đúng cấp render
    // Đoạn sau tiêu đề KHÔNG còn là heading — trở lại body prose.
    expect(html).toContain("<p");
    expect(html).toMatch(/<p[^>]*>.*Mùa đông vừa gõ cửa….*<\/p>/);
    expect(html.match(/w-24 h-1\.5/g)?.length).toBe(1); // đúng MỘT thanh accent
    // Bar đứng NGAY sau tiêu đề, trước phần ngữ liệu.
    expect(html.indexOf("w-24 h-1.5")).toBeGreaterThan(html.indexOf("</h2>"));
    expect(html.indexOf("w-24 h-1.5")).toBeLessThan(html.indexOf("Câu chuyện mùa đông"));
  });

  it("keeps canonical alignment when rendering the saved content in a player", () => {
    const blocks: RichContentBlock[] = [
      { type: "heading", align: "center", content: [{ text: "Tiêu đề", annotations: {} }] },
      { type: "paragraph", align: "right", content: [{ text: "Đoạn văn", annotations: {} }] },
      { type: "quote", align: "justify", content: [{ text: "Trích dẫn", annotations: {} }] },
    ];
    const html = renderToString(
      <RichContentBlocks
        blocks={blocks}
      />,
    );

    expect(html).toContain("text-center");
    expect(html).toContain("text-right");
    expect(html).toContain("text-justify");
  });

  it("supports canonical layout variants and legacy src media aliases", () => {
    const html = renderToString(
      <RichContentBlocks
        blocks={[
          {
            type: "layout",
            layout: "image-right",
            columns: [
              [{ type: "paragraph", text: "Nội dung" }],
              [{ type: "image", src: "https://cdn.example.test/image.png" } as RichContentBlock],
            ],
          },
        ]}
      />,
    );

    expect(html).toContain("https://cdn.example.test/image.png");
    expect(html).toContain("sm:w-[42%]");
    expect(html).not.toContain("md:grid-cols-2");
  });

  it("puts audio media urls directly on the audio element", () => {
    const html = renderToString(
      <RichContentBlocks
        blocks={[
          { type: "audio", url: "https://cdn.example.test/bai-hat.mp3" } as RichContentBlock,
        ]}
      />,
    );

    expect(html).toContain('<audio src="https://cdn.example.test/bai-hat.mp3"');
    expect(html).toContain('preload="metadata"');
    expect(html).not.toContain("<source");
  });

  it("puts video media urls directly on the video element", () => {
    const html = renderToString(
      <RichContentBlocks
        blocks={[
          { type: "video", url: "https://cdn.example.test/clip.mp4" } as RichContentBlock,
        ]}
      />,
    );

    expect(html).toContain('<video src="https://cdn.example.test/clip.mp4"');
    expect(html).toContain('preload="metadata"');
    expect(html).not.toContain("<source");
  });
});

describe("RichContentBlocks #503 preview fidelity", () => {
  it("keeps an empty paragraph visible with a line break", () => {
    const html = renderToString(
      <RichContentBlocks
        blocks={[
          { type: "paragraph", content: [{ text: "Đoạn một", annotations: {} }] },
          { type: "paragraph", content: [] },
          { type: "paragraph", content: [{ text: "Đoạn hai", annotations: {} }] },
        ]}
      />,
    );
    // The blank paragraph renders a <br> so it keeps one line of height instead
    // of collapsing to nothing.
    expect(html).toContain("<br");
  });

  it("renders h1/h2/h3 with distinct level semantics and distinct sizes", () => {
    // web-own SBT (contentAsHeading "lead"): content mở đầu bằng heading tác
    // giả thì KHÔNG thăng cấp block nào, nên ba cấp giữ đúng ba cỡ faithful.
    const html = renderToString(
      <RichContentBlocks
        blocks={[
          { type: "heading", level: 1, content: [{ text: "Cấp một", annotations: {} }] },
          { type: "heading", level: 2, content: [{ text: "Cấp hai", annotations: {} }] },
          { type: "heading", level: 3, content: [{ text: "Cấp ba", annotations: {} }] },
        ]}
      />,
    );
    expect(html).toContain('data-content-heading-level="1"');
    expect(html).toContain('data-content-heading-level="2"');
    expect(html).toContain('data-content-heading-level="3"');
    expect(html).toContain("</h2>"); // level 1
    expect(html).toContain("</h3>"); // level 2
    expect(html).toContain("</h4>"); // level 3
    expect(html.match(/text-xl md:text-2xl/g)?.length).toBe(1); // chỉ cấp 1
    expect(html).toContain("text-lg md:text-xl"); // cấp 2
    expect(html).toContain("text-base md:text-lg"); // cấp 3
  });

  it("gives list items the same body typography as paragraphs", () => {
    // web-own (Owner 30/7 contentAsHeading): dưới skin playful mặc định MỌI
    // đoạn văn là heading nên không còn <p> để so — đo tính chẵn <p>/<li> dưới
    // skin studio (render trung thực), nơi đoạn văn vẫn là body prose.
    const html = renderToString(
      <SkinProvider skin="studio">
        <RichContentBlocks
          blocks={[
            { type: "paragraph", content: [{ text: "Đoạn", annotations: {} }] },
            { type: "list", ordered: false, items: ["Mục"], itemsRuns: [[{ text: "Mục", annotations: {} }]] },
          ]}
        />
      </SkinProvider>,
    );
    // The <li> class must equal the paragraph's body class (only marker + indent
    // differ), not the old hard-coded whitespace-only class.
    const paragraphClass = html.match(/<p class="([^"]*)"/)?.[1];
    expect(paragraphClass).toBeTruthy();
    expect(html).toContain(`<li class="${paragraphClass}"`);
  });

  it("keeps inline marks inside list items when rendering", () => {
    const html = renderToString(
      <RichContentBlocks
        blocks={[
          {
            type: "list",
            ordered: false,
            items: ["Mục đậm"],
            itemsRuns: [[{ text: "Mục ", annotations: {} }, { text: "đậm", annotations: { bold: true } }]],
          },
        ]}
      />,
    );
    expect(html).toContain("<strong>đậm</strong>");
  });
});
