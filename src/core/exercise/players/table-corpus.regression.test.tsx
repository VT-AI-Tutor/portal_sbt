/**
 * Kiểm chứng toàn kho — GAP-229.
 *
 * Dựng THẬT toàn bộ 734 câu `table_completion` của kho nội dung số hoá
 * (`nxbgd-sbt-digital/books` + `books_verified`) qua đúng đường render sản phẩm
 * (`renderInteractionPlayer` → `resolveTableModel` → `TableFillPlayer`), rồi
 * khẳng định các bất biến quan trọng nhất trong MỘT lượt quét.
 *
 * Vì sao cần bài test này: mô hình bảng v2 viết lại hoàn toàn vòng lặp render.
 * Bộ test đơn vị chỉ phủ các payload viết tay; chỉ có kho thật mới chứng minh
 * 734 câu đang chạy không bị vỡ. Bất biến `answerKeys` là quan trọng nhất — nó
 * chứng minh cả 1 589 khoá chấm vẫn tới được DOM, tức chấm điểm không đổi.
 *
 * Chạy riêng (không nằm trong `npm test` mặc định vì tốn ~2 phút và phụ thuộc
 * fixture kho):
 *   npx vitest run src/core/exercise/players/table-corpus.regression.test.tsx
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { renderInteractionPlayer } from "./dispatch";
import { validateQuestionPayloadCapabilities } from "./capability-validation";

interface CorpusEntry {
  src: string;
  id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

// Fixture không được commit (bản sao nội dung của repo khác, sẽ lệch pha ngay).
// Specifier không phải hằng chuỗi để TypeScript không cố phân giải lúc biên dịch —
// nhờ vậy `tsc -b` và `npm test` vẫn chạy được khi chưa sinh fixture.
const FIXTURE_PATH = "./__corpus__/table-corpus.json";
let ENTRIES: CorpusEntry[] = [];
try {
  const mod = (await import(/* @vite-ignore */ FIXTURE_PATH)) as { default?: CorpusEntry[] };
  ENTRIES = (mod.default ?? (mod as unknown as CorpusEntry[])) ?? [];
} catch {
  // Chưa sinh fixture → cả bộ được bỏ qua, xem thông báo ở describe bên dưới.
}
const HAS_FIXTURE = ENTRIES.length > 0;
const EDITABLE = new Set(["input", "essay", "tick", "cross"]);

/** Nhãn dễ truy vết khi một câu cụ thể vỡ. */
const label = (e: CorpusEntry) => `${e.src}:${e.id ?? "<no-id>"}`;

interface Findings {
  rendered: number;
  threw: string[];
  emptyTable: string[];
  overWideRow: string[];
  missingAnswerKey: string[];
  answerFieldMismatch: string[];
  flaggedByValidator: string[];
  questionsWithKeys: number;
  keysChecked: number;
}

let f: Findings;

beforeAll(() => {
  if (!HAS_FIXTURE) return;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  f = {
    rendered: 0,
    threw: [],
    emptyTable: [],
    overWideRow: [],
    missingAnswerKey: [],
    answerFieldMismatch: [],
    flaggedByValidator: [],
    questionsWithKeys: 0,
    keysChecked: 0,
  };

  for (const entry of ENTRIES) {
    // --- chẩn đoán fail-loud: kho hiện tại toàn v1 nên phải sạch tuyệt đối ---
    const issues = validateQuestionPayloadCapabilities(entry.payload);
    if (issues.length > 0) {
      f.flaggedByValidator.push(`${label(entry)} → ${issues.map((i) => i.code).join(",")}`);
    }

    try {
      act(() => {
        root.render(renderInteractionPlayer("table_completion", entry.payload, {}));
      });
      f.rendered += 1;
    } catch (err) {
      f.threw.push(`${label(entry)} → ${(err as Error).message}`);
      continue;
    }

    // Bảng rỗng chính là chế độ hỏng ÂM THẦM mà v2 dễ gây ra nhất:
    // `columns`/`headerRows` bị xoá trắng thì bảng vẫn render nhưng không có ô nào.
    const cellCount = container.querySelectorAll("td, th").length;
    if (cellCount === 0) f.emptyTable.push(label(entry));

    // --- lưới không được có hàng nào rộng hơn bề rộng lớn nhất của bảng ---
    // (rowSpan làm một số hàng hụt cột một cách hợp lệ, nên chỉ chặn phía vượt)
    const table = container.querySelector("table");
    if (table) {
      const widths: number[] = [];
      for (const tr of Array.from(table.querySelectorAll("tr"))) {
        const cells = Array.from(tr.querySelectorAll(":scope > td, :scope > th"));
        if (cells.length === 0) continue;
        widths.push(cells.reduce((sum, c) => sum + ((c as HTMLTableCellElement).colSpan || 1), 0));
      }
      if (widths.length > 0) {
        const max = Math.max(...widths);
        const declared = Array.isArray(entry.payload?.table?.headers)
          ? entry.payload.table.headers.length
          : max;
        if (declared > 0 && max > declared) {
          f.overWideRow.push(`${label(entry)} → hàng rộng ${max} > ${declared} cột khai báo`);
        }
      }
    }

    const domKeys = new Set(
      Array.from(container.querySelectorAll("[data-answer-key]")).map((el) =>
        el.getAttribute("data-answer-key"),
      ),
    );

    // --- MỌI khoá chấm phải tới được DOM ---
    const ca = entry.payload?.correctAnswer;
    if (ca && typeof ca === "object" && !Array.isArray(ca)) {
      const keys = Object.keys(ca);
      if (keys.length > 0) {
        f.questionsWithKeys += 1;
        for (const key of keys) {
          f.keysChecked += 1;
          if (!domKeys.has(key)) f.missingAnswerKey.push(`${label(entry)} → thiếu "${key}"`);
        }
      }
    }

    // --- số ô nhập trên DOM khớp số ô editable khai trong payload ---
    const rows = entry.payload?.table?.rows;
    if (Array.isArray(rows)) {
      const expected = rows
        // Hàng isGroupHeader render thành một ô trải ngang, không có ô nhập.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((r: any) => !r?.isGroupHeader)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .flatMap((r: any) => (Array.isArray(r?.cells) ? r.cells : []))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => EDITABLE.has(c?.cellType)).length;
      if (domKeys.size !== expected) {
        f.answerFieldMismatch.push(`${label(entry)} → DOM ${domKeys.size} ≠ payload ${expected}`);
      }
    }

    act(() => root.render(<></>));
  }

  act(() => root.unmount());
  container.remove();
}, 300_000);

afterAll(() => {
  if (!HAS_FIXTURE) return;
  console.log(
    `[GAP-229 corpus] rendered=${f.rendered}/${ENTRIES.length} ` +
      `questionsWithKeys=${f.questionsWithKeys} keysChecked=${f.keysChecked}`,
  );
});

// Chưa sinh fixture thì bỏ qua thay vì báo đỏ:
//   node scripts/extract-table-corpus.mjs [đường-dẫn-tới-nxbgd-sbt-digital]
describe.skipIf(!HAS_FIXTURE)("kho nội dung thật — câu table_completion (GAP-229)", () => {
  it("kho fixture đúng như đã kiểm đếm", () => {
    expect(ENTRIES).toHaveLength(734);
  });

  it("mọi câu đều render được, không ném lỗi", () => {
    expect({ threw: f.threw.slice(0, 10), count: f.threw.length }).toEqual({ threw: [], count: 0 });
    expect(f.rendered).toBe(734);
  });

  it("không câu nào render ra bảng rỗng (chế độ hỏng âm thầm của v2)", () => {
    expect({ empty: f.emptyTable.slice(0, 10), count: f.emptyTable.length }).toEqual({
      empty: [],
      count: 0,
    });
  });

  it("không hàng nào rộng hơn số cột khai báo", () => {
    expect({ bad: f.overWideRow.slice(0, 10), count: f.overWideRow.length }).toEqual({
      bad: [],
      count: 0,
    });
  });

  it("MỌI khoá chấm trong correctAnswer đều tới được DOM (chấm điểm không đổi)", () => {
    expect(f.questionsWithKeys).toBe(301);
    expect(f.keysChecked).toBe(1589);
    expect({ missing: f.missingAnswerKey.slice(0, 15), count: f.missingAnswerKey.length }).toEqual({
      missing: [],
      count: 0,
    });
  });

  it("số ô nhập trên DOM khớp số ô editable khai trong payload", () => {
    expect({
      mismatched: f.answerFieldMismatch.slice(0, 15),
      count: f.answerFieldMismatch.length,
    }).toEqual({ mismatched: [], count: 0 });
  });

  it("không câu nào phát sinh chẩn đoán fail-loud (kho hiện tại toàn v1)", () => {
    expect({ flagged: f.flaggedByValidator.slice(0, 15), count: f.flaggedByValidator.length }).toEqual({
      flagged: [],
      count: 0,
    });
  });
});
