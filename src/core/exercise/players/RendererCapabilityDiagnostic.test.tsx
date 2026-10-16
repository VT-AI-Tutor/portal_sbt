import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  RendererCapabilityDiagnostic,
  type RendererCapabilityDiagnosticCode,
} from "./RendererCapabilityDiagnostic";

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

function render(code: RendererCapabilityDiagnosticCode) {
  act(() => root.render(<RendererCapabilityDiagnostic code={code} type="future_type" />));
  return container.querySelector<HTMLElement>('[role="alert"]')!;
}

describe("RendererCapabilityDiagnostic", () => {
  it.each([
    ["UNKNOWN_TYPE", "Không hỗ trợ loại câu hỏi"],
    ["UNKNOWN_INTERACTION", "Không hỗ trợ kiểu tương tác"],
    ["UNSUPPORTED_LAYOUT", "Không hỗ trợ bố cục"],
    ["UNSUPPORTED_LEGACY_CAPABILITY", "Không hỗ trợ capability legacy"],
    ["COLORING_NO_REGIONS", "Câu tô màu không có vùng tô"],
    ["CROSSWORD_NO_ENTRIES", "Ô chữ không có từ khoá nào"],
  ] as const)("renders stable QA metadata and copy for %s", (code, title) => {
    const alert = render(code);

    expect(alert.dataset.rendererDiagnostic).toBe(code);
    expect(alert.dataset.diagnosticCode).toBe(code);
    expect(alert.dataset.diagnosticScope).toBe("top-level");
    expect(alert.getAttribute("aria-label")).toContain(`${code}: ${title}`);
    expect(alert.textContent).toContain(title);
    expect(alert.textContent).toContain("Cần xử lý capability này trước khi duyệt nội dung.");
  });

  it("renders nested location and every supplied resolver detail", () => {
    act(() => {
      root.render(
        <RendererCapabilityDiagnostic
          code="UNSUPPORTED_LAYOUT"
          type="single_choice"
          interactionType="radio"
          layout={{ mode: "spiral", columns: 3 }}
          legacyCapability="LegacyRadio"
          path="children[2]"
          scope="nested"
          className="qa-marker"
        />,
      );
    });

    const alert = container.querySelector<HTMLElement>('[role="alert"]')!;
    expect(alert.dataset.diagnosticScope).toBe("nested");
    expect(alert.dataset.diagnosticPath).toBe("children[2]");
    expect(alert.classList.contains("p-3")).toBe(true);
    expect(alert.classList.contains("qa-marker")).toBe(true);
    expect(alert.textContent).toContain("single_choice");
    expect(alert.textContent).toContain("radio");
    expect(alert.textContent).toContain('{"mode":"spiral","columns":3}');
    expect(alert.textContent).toContain("LegacyRadio");
    expect(alert.textContent).toContain("children[2]");
  });

  it("does not crash while describing a circular unsupported value", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    act(() => {
      root.render(
        <RendererCapabilityDiagnostic code="UNSUPPORTED_LAYOUT" layout={circular} />,
      );
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("[object Object]");
  });
});
