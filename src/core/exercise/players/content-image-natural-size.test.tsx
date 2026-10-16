import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RichContentBlock } from "@/core/question-schema";
import { PlayerHeader, RichContentBlocks } from "./shared";

/**
 * A picture inside a question's content IS the content — a music sheet, a
 * workbook scan, a diagram. It renders at its natural pixel size; the old
 * `max-h-48 sm:max-h-64` ceiling turned a tall music sheet into an unreadable
 * 256px-high thumbnail regardless of question type (VBT Âm nhạc 4, `b8q3`).
 * Only `max-w-full` survives, so a picture wider than the column scales down
 * instead of overflowing the layout.
 */
describe("content images render at natural size", () => {
  it("puts no height ceiling on a content-block image", () => {
    const blocks: RichContentBlock[] = [
      { type: "image", url: "https://cdn.example.test/ban-nhac.png" } as RichContentBlock,
    ];
    const html = renderToString(<RichContentBlocks blocks={blocks} />);

    expect(html).toContain("max-w-full");
    expect(html).not.toContain("max-h-");
  });

  it("still honours an authored block width as explicit author intent", () => {
    const blocks: RichContentBlock[] = [
      { type: "image", url: "https://cdn.example.test/ban-nhac.png", width: "60%" } as RichContentBlock,
    ];
    const html = renderToString(<RichContentBlocks blocks={blocks} />);

    expect(html).toContain("max-width:60%");
  });

  it("emits no style attribute when no width is authored", () => {
    const blocks: RichContentBlock[] = [
      { type: "image", url: "https://cdn.example.test/ban-nhac.png" } as RichContentBlock,
    ];
    const html = renderToString(<RichContentBlocks blocks={blocks} />);

    expect(html).not.toContain("max-width:100%");
  });

  it("puts no height ceiling on the legacy header illustration either", () => {
    const html = renderToString(
      <PlayerHeader title="Hát karaoke" imageSrc="https://cdn.example.test/minh-hoa.png" />,
    );

    expect(html).toContain("max-w-full");
    expect(html).not.toContain("max-h-");
  });
});
