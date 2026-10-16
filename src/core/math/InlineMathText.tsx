import {
  Fragment,
  createElement,
  useMemo,
  type ReactNode,
} from "react";
import DOMPurify from "dompurify";
import { MathRenderer } from "./MathRenderer";
import {
  normalizeRichTextColor,
  normalizeRichTextLink,
  sanitizeRichTextHtml,
} from "@/core/rich-text/html";
import {
  composeUnicodeFraction,
  tokenizeInlineMathText,
} from "./inlineMathTextTokens";

const INLINE_RICH_TEXT_TAGS = [
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "br",
  "sub",
  "sup",
  "code",
  "span",
] as const;

const INLINE_RICH_TEXT_ATTRIBUTES = ["href", "target", "rel", "style"] as const;

const INLINE_MARKUP_RE =
  /<(?:\/?(?:strong|b|em|i|u|s|a|br|sub|sup|code|span))(?:\s|>)/i;

const TAGGED_FRACTION_RE =
  /<sup>\s*([0-9]+)\s*<\/sup>\s*[⁄/]\s*<sub>\s*([0-9]+)\s*<\/sub>/gi;

function renderTokens(value: string, keyPrefix: string): ReactNode[] {
  return tokenizeInlineMathText(value).map((token, index) => {
    const key = `${keyPrefix}-${token.kind}-${index}`;
    if (token.kind === "text") {
      return <Fragment key={key}>{token.value}</Fragment>;
    }

    if (token.kind === "latex") {
      // No ariaLabel: arbitrary TeX has no faithful Vietnamese phrasing, and
      // MathRenderer already emits MathML for assistive technology. An
      // aria-label here would override that with something less accurate.
      return (
        <MathRenderer
          key={key}
          latex={token.latex}
          displayMode={false}
          className="inline-block align-middle"
        />
      );
    }

    const latex = `\\frac{${token.numerator}}{${token.denominator}}`;
    return (
      <MathRenderer
        key={key}
        latex={latex}
        displayMode={false}
        ariaLabel={`${token.numerator} trên ${token.denominator}`}
        className="inline-block whitespace-nowrap align-middle"
      />
    );
  });
}

/**
 * Legacy plain-text fields sometimes contain entities without any HTML tags
 * (for example `&quot;`). React correctly escapes those strings again, so
 * rendering them as-is exposes the entity to the user. Decode through a
 * textarea raw-text element, protecting literal angle brackets first: this
 * converts entities while keeping markup such as `<script>` as literal text
 * and never turning it into executable HTML or truncating at `</textarea>`.
 *
 * The HTML parser drops a single U+000A immediately after the `<textarea>`
 * opening tag ("newlines at the start of textarea are ignored"). Without a
 * guard this silently eats a leading newline segment (e.g. a `"\n"`-only
 * segment collapses to `""`), so we prepend one sentinel newline that the
 * parser consumes in place of any authored leading newline.
 */
function decodePlainTextEntities(value: string): string {
  if (typeof DOMParser === "undefined") return value;
  const protectedValue = value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const document = new DOMParser().parseFromString(
    `<textarea>\n${protectedValue}</textarea>`,
    "text/html",
  );
  return document.querySelector("textarea")?.value ?? value;
}

function renderRichNode(node: Node, key: string): ReactNode {
  if (node.nodeType === 3) {
    return <Fragment key={key}>{renderTokens(node.textContent ?? "", key)}</Fragment>;
  }
  if (node.nodeType !== 1) return null;

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (!INLINE_RICH_TEXT_TAGS.includes(tag as (typeof INLINE_RICH_TEXT_TAGS)[number])) {
    return null;
  }

  const props: Record<string, unknown> = {};
  if (tag === "a") {
    const link = normalizeRichTextLink({
      href: element.getAttribute("href"),
      target: element.getAttribute("target"),
      rel: element.getAttribute("rel"),
    });
    if (link) Object.assign(props, link);
  }
  if (tag === "span") {
    const color = normalizeRichTextColor((element as HTMLElement).style.color);
    if (color) props.style = { color };
  }

  const children = Array.from(element.childNodes).map((child, index) =>
    renderRichNode(child, `${key}-${index}`),
  );
  if (tag === "br") return createElement("br", { key });
  return createElement(tag, { ...props, key }, children);
}

function renderRichText(value: string): ReactNode[] | null {
  if (typeof DOMParser === "undefined" || typeof DOMPurify.sanitize !== "function") {
    return null;
  }

  const sanitized = sanitizeRichTextHtml(String(
    DOMPurify.sanitize(value, {
      ALLOWED_TAGS: [...INLINE_RICH_TEXT_TAGS],
      ALLOWED_ATTR: [...INLINE_RICH_TEXT_ATTRIBUTES],
    }),
  ));
  const normalized = sanitized.replace(
    TAGGED_FRACTION_RE,
    (_, numerator: string, denominator: string) =>
      composeUnicodeFraction(numerator, denominator),
  );
  // Parse inside a wrapper element, never as a bare document: a string that
  // starts with raw whitespace text before any tag (e.g. a Tab-indented line
  // whose run also contains a later <br>/<strong>/... marker) is parsed with
  // the browser still in the "before head" insertion mode, which silently
  // drops that leading whitespace-only prefix per the HTML5 parsing
  // algorithm. Wrapping in <div> puts the parser in "in body" from the start
  // so leading indentation survives (#526).
  const document = new DOMParser().parseFromString(`<div>${normalized}</div>`, "text/html");
  const root = document.body.firstElementChild;
  if (!root) return [];
  return Array.from(root.childNodes).map((node, index) =>
    renderRichNode(node, `rich-${index}`),
  );
}

/**
 * Render inline authored text while promoting unambiguous fraction encodings
 * to KaTeX. Supported inline formatting is sanitized and preserved.
 */
export function InlineMathText({
  value,
  className,
}: {
  // Content comes from persisted question payloads. Keep this boundary
  // defensive so one malformed legacy field cannot take down a QA screen.
  value: unknown;
  className?: string;
}) {
  const normalizedValue = typeof value === "string" ? value : "";
  const plainValue = useMemo(
    () => decodePlainTextEntities(normalizedValue),
    [normalizedValue],
  );
  const richText = useMemo(
    () =>
      (INLINE_MARKUP_RE.test(normalizedValue)
        ? renderRichText(normalizedValue)
        : null),
    [normalizedValue],
  );

  return (
    <span className={className}>
      {richText ?? renderTokens(plainValue, "plain")}
    </span>
  );
}
