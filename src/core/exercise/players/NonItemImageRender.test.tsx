/**
 * #562 class — parity fix for non-item "title/label/header/cell/point" elements
 * that carry authored images. These render tests assert the bespoke-layout
 * players actually emit an <img> (not just that dispatch forwards the URL).
 * The three header-mirror players (TwoBucketSort, CardSort, LabelDiagram) reuse
 * CategorizePlayer's proven image-branch pattern and are covered by the dispatch
 * mapping tests in dispatch.media.test.ts.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { TrueFalseTablePlayer } from "./TrueFalseTablePlayer";
import { TableFillPlayer } from "./TableFillPlayer";
import { ConnectPointsTask } from "../tasks/ConnectPointsTask";

// motion/react + a few players observe element size; jsdom lacks ResizeObserver.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

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

const imgs = () => Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src"));

it("TrueFalseTablePlayer renders <img> for statement and situation images", () => {
  act(() =>
    root.render(
      <TrueFalseTablePlayer
        title="Q"
        statements={[
          {
            id: "s1",
            text: "",
            imageUrl: "https://api.test/uploads/stmt.png",
            situation: "",
            situationImageUrl: "https://api.test/uploads/sit.png",
            correct: true,
          },
          { id: "s2", text: "Nhận định chữ", correct: false },
        ]}
      />,
    ),
  );
  const srcs = imgs();
  expect(srcs).toContain("https://api.test/uploads/stmt.png");
  expect(srcs).toContain("https://api.test/uploads/sit.png");
  // The text-only statement contributes no image.
  expect(srcs).toHaveLength(2);
  expect(container.textContent).toContain("Nhận định chữ");
});

it("TableFillPlayer renders <img> for a static cell image, text cells stay text", () => {
  act(() =>
    root.render(
      <TableFillPlayer
        title="Q"
        table={{
          headers: [{ id: "h1", label: "Cột" }],
          rows: [
            { id: "r1", cells: [{ columnId: "h1", cellType: "text", text: "", imageUrl: "https://api.test/uploads/cell.png" }] },
            { id: "r2", cells: [{ columnId: "h1", cellType: "text", text: "chữ" }] },
          ],
        }}
      />,
    ),
  );
  expect(imgs()).toEqual(["https://api.test/uploads/cell.png"]);
  expect(container.textContent).toContain("chữ");
});

it("ConnectPointsTask renders <img> at a point that carries an image, label otherwise", () => {
  act(() =>
    root.render(
      <ConnectPointsTask
        title="Q"
        instruction=""
        points={[
          { id: "p1", label: "A", imageUrl: "https://api.test/uploads/pt.png", x: 0.2, y: 0.3 },
          { id: "p2", label: "B", x: 0.8, y: 0.7 },
        ]}
        correctConnections={[{ from: "p1", to: "p2" }]}
        onComplete={() => {}}
      />,
    ),
  );
  expect(imgs()).toContain("https://api.test/uploads/pt.png");
  expect(imgs()).toHaveLength(1);
  expect(container.textContent).toContain("B");
});
