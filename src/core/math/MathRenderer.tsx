import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { katexMacros, katexSafeLatex } from "./katexDialect";

export interface MathRendererProps {
  latex?: string;
  /** Legacy rich-content payloads used `text` for formula content. */
  text?: string;
  displayMode?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * The only read-only math renderer used by rich-content surfaces.
 *
 * KaTeX is deliberately configured with `trust: false` and no HTML fallback
 * so a formula can never turn into executable markup. Invalid TeX is rendered
 * as KaTeX's visible error marker instead of breaking the question surface.
 */
export function MathRenderer({
  latex,
  text,
  displayMode = true,
  className,
  ariaLabel,
}: MathRendererProps) {
  const source = (latex ?? text ?? "").trim();
  const markup = useMemo(() => {
    if (!source) return "";
    // Công thức tới đây do tác giả soạn trong ô MathLive, nên có thể mang lệnh
    // của phương ngữ MathLive mà KaTeX không biết. Dịch trước khi dựng, kẻo
    // KaTeX in tên lệnh ra chữ đỏ giữa bài (xem katexDialect).
    return katex.renderToString(katexSafeLatex(source), {
      displayMode,
      output: "htmlAndMathml",
      throwOnError: false,
      strict: "warn",
      trust: false,
      macros: katexMacros(),
    });
  }, [displayMode, source]);

  if (!markup) return null;
  const Element = displayMode ? "div" : "span";
  return (
    <Element
      className={className}
      aria-label={ariaLabel}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

