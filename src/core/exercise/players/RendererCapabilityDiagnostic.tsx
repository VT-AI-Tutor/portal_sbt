import React from "react";
import { AlertTriangle } from "lucide-react";

export type RendererCapabilityDiagnosticCode =
  | "UNKNOWN_TYPE"
  | "UNKNOWN_INTERACTION"
  | "UNSUPPORTED_LAYOUT"
  | "UNSUPPORTED_LEGACY_CAPABILITY"
  // Payload resolves to a supported player, but carries no answerable content —
  // the widget would render as an empty shell (issue #810). Codes are shared
  // verbatim with `capability-validation.ts` so QA sees one vocabulary.
  | "COLORING_NO_REGIONS"
  | "CROSSWORD_NO_ENTRIES";

export interface RendererCapabilityDiagnosticProps {
  code: RendererCapabilityDiagnosticCode;
  /** Matches the strict resolver's failure shape for direct prop spreading. */
  type?: string;
  interactionType?: string;
  layout?: unknown;
  legacyCapability?: string;
  /** QA location, e.g. `children[2]` or `anchors[1].question`. */
  path?: string;
  scope?: "top-level" | "nested";
  className?: string;
}

const COPY: Record<RendererCapabilityDiagnosticCode, { title: string; description: string }> = {
  UNKNOWN_TYPE: {
    title: "Không hỗ trợ loại câu hỏi",
    description: "Renderer chưa đăng ký loại câu hỏi này. Không thể hiển thị an toàn bằng player mặc định.",
  },
  UNKNOWN_INTERACTION: {
    title: "Không hỗ trợ kiểu tương tác",
    description: "Kiểu tương tác không thuộc capability của loại câu hỏi này. Dữ liệu được giữ nguyên để QA xử lý.",
  },
  UNSUPPORTED_LAYOUT: {
    title: "Không hỗ trợ bố cục",
    description: "Player đã chọn không hỗ trợ bố cục được yêu cầu. Renderer không tự đổi sang bố cục khác.",
  },
  UNSUPPORTED_LEGACY_CAPABILITY: {
    title: "Không hỗ trợ capability legacy",
    description: "Capability từ renderer cũ chưa có đường tương thích đã được kiểm chứng trong Evo.",
  },
  COLORING_NO_REGIONS: {
    title: "Câu tô màu không có vùng tô",
    description:
      "Payload không có vùng tô hợp lệ nào nên học sinh không có gì để tô. Renderer không tự sinh vùng — cần bổ sung `regions` trong dữ liệu.",
  },
  CROSSWORD_NO_ENTRIES: {
    title: "Ô chữ không có từ khoá nào",
    description:
      "Payload không có mục `entries` hợp lệ nào nên lưới ô chữ không có ô nhập. Cần bổ sung dữ liệu từ khoá trước khi duyệt.",
  },
};

function diagnosticValue(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const RendererCapabilityDiagnostic: React.FC<RendererCapabilityDiagnosticProps> = ({
  code,
  type,
  interactionType,
  layout,
  legacyCapability,
  path,
  scope = "top-level",
  className = "",
}) => {
  const copy = COPY[code];
  const details = [
    ["Loại", type],
    ["Tương tác", interactionType],
    ["Bố cục", layout == null ? undefined : diagnosticValue(layout)],
    ["Capability legacy", legacyCapability],
    ["Vị trí", path],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0);
  const nested = scope === "nested";

  return (
    <section
      role="alert"
      aria-label={`${code}: ${copy.title}`}
      data-renderer-diagnostic={code}
      data-diagnostic-code={code}
      data-diagnostic-scope={scope}
      data-diagnostic-path={path}
      className={`${nested ? "p-3" : "p-4 sm:p-6"} w-full rounded-lg border border-red-300 bg-red-50 text-red-950 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`${nested ? "text-sm" : "text-base"} font-semibold`}>{copy.title}</h3>
            <code className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">
              {code}
            </code>
          </div>
          <p className="mt-1 text-sm leading-5 text-red-800">{copy.description}</p>
          {details.length > 0 && (
            <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[max-content_minmax(0,1fr)]">
              {details.map(([label, value]) => (
                <React.Fragment key={label}>
                  <dt className="font-medium text-red-700">{label}</dt>
                  <dd className="min-w-0 break-words font-mono text-red-950">{value}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
          <p className="mt-3 text-xs font-medium text-red-700">
            Cần xử lý capability này trước khi duyệt nội dung.
          </p>
        </div>
      </div>
    </section>
  );
};
