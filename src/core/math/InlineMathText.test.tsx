import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InlineMathText } from "./InlineMathText";
import {
  convertAsciiFractionsToUnicode,
  tokenizeInlineMathText,
} from "./inlineMathTextTokens";

describe("InlineMathText", () => {
  it("renders malformed persisted values as empty text instead of crashing", () => {
    expect(() =>
      renderToString(<InlineMathText value={{ blocks: [] }} />),
    ).not.toThrow();
    expect(() =>
      renderToString(<InlineMathText value={["not a rich text run"]} />),
    ).not.toThrow();
  });

  it("renders a Unicode vulgar fraction as inline KaTeX/MathML", () => {
    const html = renderToString(<InlineMathText value="⅕ thế kỉ" />);

    expect(html).toContain("mfrac");
    expect(html).toContain(String.raw`\frac{1}{5}`);
    expect(html).toContain("thế kỉ");
    expect(html).not.toContain("⅕");
  });

  it("renders a composed superscript/subscript fraction vertically", () => {
    const html = renderToString(<InlineMathText value="¹⁄₅ thế kỉ" />);

    expect(html).toContain("mfrac");
    expect(html).toContain(String.raw`\frac{1}{5}`);
    expect(html).not.toContain("¹⁄₅");
  });

  it("renders an authored sup/sub fraction inside sanitized rich text", () => {
    const html = renderToString(
      <InlineMathText value="<strong><sup>3</sup>/<sub>4</sub> giờ</strong>" />,
    );

    expect(html).toContain("<strong>");
    expect(html).toContain("mfrac");
    expect(html).toContain(String.raw`\frac{3}{4}`);
    expect(html).not.toContain("<sup>");
  });

  it("decodes a stored HTML fraction entity", () => {
    const html = renderToString(<InlineMathText value="&frac15; thế kỉ" />);

    expect(html).toContain(String.raw`\frac{1}{5}`);
    expect(html).not.toContain("frac15");
  });

  it("decodes entities without promoting plain text to markup or truncating it", () => {
    const html = renderToString(
      <InlineMathText value={'&quot;A &amp; B&quot; &lt;em&gt;không in nghiêng&lt;/em&gt; </textarea> sau'} />,
    );
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.body.textContent).toBe('"A & B" <em>không in nghiêng</em> </textarea> sau');
    expect(document.body.querySelector("em")).toBeNull();
  });

  it("removes unsupported markup before rendering rich text", () => {
    const html = renderToString(
      <InlineMathText value="<strong>⅕</strong><script>alert(1)</script>" />,
    );

    expect(html).toContain(String.raw`\frac{1}{5}`);
    expect(html).not.toContain("script");
    expect(html).not.toContain("alert(1)");
  });

  it("renders validated annotation markup and forces safe external-link attributes", () => {
    const html = renderToString(
      <InlineMathText value={'<span style="color: #dc2626"><a href="https://example.com" target="_blank" rel="opener">⅕ đỏ</a></span>'} />,
    );

    expect(html).toMatch(/color:(?:#dc2626|rgb\(220, 38, 38\))/);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('rel="opener"');
    expect(html).toContain(String.raw`\frac{1}{5}`);
  });

  it("supports every common Unicode vulgar-fraction denominator", () => {
    expect(tokenizeInlineMathText("¼ ⅓ ⅕ ⅙ ⅐ ⅛ ⅑ ⅒")).toEqual([
      { kind: "fraction", numerator: 1, denominator: 4 },
      { kind: "text", value: " " },
      { kind: "fraction", numerator: 1, denominator: 3 },
      { kind: "text", value: " " },
      { kind: "fraction", numerator: 1, denominator: 5 },
      { kind: "text", value: " " },
      { kind: "fraction", numerator: 1, denominator: 6 },
      { kind: "text", value: " " },
      { kind: "fraction", numerator: 1, denominator: 7 },
      { kind: "text", value: " " },
      { kind: "fraction", numerator: 1, denominator: 8 },
      { kind: "text", value: " " },
      { kind: "fraction", numerator: 1, denominator: 9 },
      { kind: "text", value: " " },
      { kind: "fraction", numerator: 1, denominator: 10 },
    ]);
  });

  // Authored content carries TeX inline inside a `paragraph` block's text
  // (e.g. `"Tính: \\(\\frac{1}{3} + \\frac{1}{6} = ?\\)"`), not only in a
  // dedicated `math` block. Before this the delimiters printed verbatim.
  it("renders TeX delimited by \\( … \\) inside surrounding prose", () => {
    const html = renderToString(
      <InlineMathText
        value={String.raw`Chiều dài \(\frac{51}{4}\) m và diện tích 34 m²`}
      />,
    );

    expect(html).toContain("mfrac");
    expect(html).toContain("Chiều dài");
    expect(html).toContain("m và diện tích 34 m²");
    expect(html).not.toContain(String.raw`\(`);
    expect(html).not.toContain(String.raw`\)`);
  });

  it("renders TeX delimited by \\[ … \\] without emitting a block inside the run", () => {
    const html = renderToString(
      <InlineMathText value={String.raw`Kết quả \[\frac{1}{2}\] đúng`} />,
    );

    expect(html).toContain("mfrac");
    expect(html).not.toContain(String.raw`\[`);
    // displayMode would emit a <div>, which cannot legally nest in the <p> the
    // paragraph block renders as.
    expect(html).not.toContain("<div");
  });

  it("keeps two formulas on one line separate instead of merging them", () => {
    expect(
      tokenizeInlineMathText(String.raw`\(a\) và \(b\)`),
    ).toEqual([
      { kind: "latex", latex: "a" },
      { kind: "text", value: " và " },
      { kind: "latex", latex: "b" },
    ]);
  });

  it("treats a Unicode fraction inside a TeX span as part of the formula", () => {
    expect(
      tokenizeInlineMathText(String.raw`\(x + ½\)`),
    ).toEqual([{ kind: "latex", latex: String.raw`x + ½` }]);
  });

  it("leaves an empty delimiter pair as literal text", () => {
    expect(tokenizeInlineMathText(String.raw`\(\)`)).toEqual([
      { kind: "text", value: String.raw`\(\)` },
    ]);
  });

  // `$ … $` is the standard TeX/Markdown inline delimiter (MathJax, KaTeX,
  // Pandoc, Jupyter), so authored maths carried that way must render. The
  // Pandoc rule disambiguates it from currency: an opening `$` needs a non-space
  // char to its right, a closing `$` a non-space char to its left and no digit
  // to its right — so a trailing-dollar price is left as prose.
  it("keeps trailing-dollar prices as prose, not maths", () => {
    const html = renderToString(<InlineMathText value="giá 5$ và 10$ một quyển" />);

    expect(html).toContain("giá 5$ và 10$ một quyển");
    expect(html).not.toContain("mfrac");
    expect(html).not.toContain("katex");
  });

  it("keeps leading-dollar prices as prose (no digit after the closing $)", () => {
    const html = renderToString(<InlineMathText value="It costs $20,000 and $30,000." />);

    expect(html).toContain("$20,000 and $30,000.");
    expect(html).not.toContain("katex");
  });

  it("renders inline maths delimited by $ … $ (the standard delimiter)", () => {
    const html = renderToString(
      <InlineMathText
        value={String.raw`Cho $A = \{x \in \mathbb{N} \mid 5 < x < 10\}$ là tập hợp.`}
      />,
    );

    expect(html).toContain("Cho");
    expect(html).toContain("là tập hợp.");
    expect(html).toContain("katex");
    // The TeX reached KaTeX and rendered (blackboard-bold N, set-membership ∈),
    // rather than printing the `$ … $` source verbatim. KaTeX still echoes the
    // raw TeX inside a MathML <annotation>, so assert on the rendered glyphs and
    // on the absence of the visible `$` delimiters, not on the source string.
    expect(html).toContain('mathvariant="double-struck"');
    expect(html).toContain("∈");
    expect(html).not.toContain("$A");
    expect(html).not.toContain("là tập hợp.$");
  });

  it("renders a bare variable in $ … $ such as $A$", () => {
    const html = renderToString(<InlineMathText value="Tập hợp $A$ có 5 phần tử." />);

    expect(html).toContain("Tập hợp");
    expect(html).toContain("có 5 phần tử.");
    expect(html).toContain("katex");
    expect(html).not.toContain("$A$");
  });

  it("renders display maths delimited by $$ … $$ without a block inside the run", () => {
    const html = renderToString(
      <InlineMathText value={String.raw`Kết quả $$\frac{1}{2}$$ đúng`} />,
    );

    expect(html).toContain("mfrac");
    expect(html).not.toContain("$$");
    // Like \[ … \], a display <div> cannot legally nest in the paragraph's <p>.
    expect(html).not.toContain("<div");
  });

  it("keeps two $ … $ formulas on one line separate", () => {
    expect(tokenizeInlineMathText(String.raw`$a$ và $b$`)).toEqual([
      { kind: "latex", latex: "a" },
      { kind: "text", value: " và " },
      { kind: "latex", latex: "b" },
    ]);
  });

  it("renders TeX inside sanitized rich text", () => {
    const html = renderToString(
      <InlineMathText value={String.raw`<strong>Đáp số: \(\frac{34}{5}\)</strong>`} />,
    );

    expect(html).toContain("<strong>");
    expect(html).toContain("mfrac");
    expect(html).not.toContain(String.raw`\(`);
  });

  it("shows invalid TeX as KaTeX's error marker instead of breaking the surface", () => {
    expect(() =>
      renderToString(<InlineMathText value={String.raw`\(\frac{1\)`} />),
    ).not.toThrow();
  });

  it("does not guess that slash-delimited text is a fraction", () => {
    const html = renderToString(<InlineMathText value="Ngày 1/5/2026" />);

    expect(html).toContain("Ngày 1/5/2026");
    expect(html).not.toContain("mfrac");
  });

  it("converts explicitly formatted ASCII fractions to the canonical upright form", () => {
    expect(convertAsciiFractionsToUnicode("3/4 và 1 / 4")).toBe("³⁄₄ và ¹⁄₄");
    expect(renderToString(<InlineMathText value={convertAsciiFractionsToUnicode("3/4")} />)).toContain(
      String.raw`\frac{3}{4}`,
    );
  });

  it("leaves dates and chained slash values untouched", () => {
    expect(convertAsciiFractionsToUnicode("Ngày 1/5/2026, phiên bản 1/2/3")).toBe(
      "Ngày 1/5/2026, phiên bản 1/2/3",
    );
  });

  it("renders a line break without passing children to the void element", () => {
    expect(() => renderToString(<InlineMathText value="Dòng 1<br>Dòng 2" />)).not.toThrow();
    expect(renderToString(<InlineMathText value="Dòng 1<br>Dòng 2" />)).toContain("Dòng 1<br/>Dòng 2");
  });

  it.each([
    ["một segment chỉ có newline", "\n", "\n"],
    ["newline ở đầu chuỗi", "\nDòng mới", "\nDòng mới"],
    ["newline ở cuối chuỗi", "Dòng cũ\n", "Dòng cũ\n"],
    ["nhiều newline liên tiếp", "\n\n", "\n\n"],
  ])("preserves plain-text newlines (%s)", (_label, value, expected) => {
    const html = renderToString(<InlineMathText value={value} />);
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.body.textContent).toBe(expected);
  });

  it("decodes entities while still preserving an authored leading newline", () => {
    const html = renderToString(<InlineMathText value={'\n&quot;A &amp; B&quot;'} />);
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.body.textContent).toBe('\n"A & B"');
  });

  // #526 — a value with raw leading whitespace (Tab-indented line) that ALSO
  // contains a later inline marker (e.g. a <br> from an embedded newline, or
  // <strong>/<a>/...) takes the "rich" markup parse path. Parsing that string
  // as a bare HTML document (no wrapper element) puts the browser's parser in
  // the "before head" insertion mode, which silently drops a leading
  // whitespace-only prefix per the HTML5 parsing algorithm — losing exactly
  // the indentation QA preview must reproduce.
  it("keeps leading whitespace when the value also contains a later inline marker (#526)", () => {
    const html = renderToString(
      <InlineMathText value={"   Mùa xuân vừa sang,<br>cây cối đâm chồi nảy lộc"} />,
    );
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.body.textContent).toBe("   Mùa xuân vừa sang,cây cối đâm chồi nảy lộc");
    expect(html).toContain("<br/>");
  });

  it("keeps leading whitespace when a link appears later in the same value (#526)", () => {
    const html = renderToString(
      <InlineMathText value={'   Mùa xuân <a href="https://example.com">vừa sang</a>'} />,
    );
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.body.textContent?.startsWith("   Mùa xuân")).toBe(true);
  });
});
