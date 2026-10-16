import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MathRenderer } from "./MathRenderer";

describe("MathRenderer", () => {
  it("renders canonical latex as MathML/KaTeX markup", () => {
    const html = renderToString(<MathRenderer latex={String.raw`\frac{1}{2}`} />);
    expect(html).toContain("mfrac");
    expect(html).toContain("1");
    expect(html).toContain("2");
  });

  it("keeps legacy text math readable", () => {
    const html = renderToString(<MathRenderer text="x^2" />);
    expect(html).toContain("x");
    expect(html).toContain("2");
  });
});
