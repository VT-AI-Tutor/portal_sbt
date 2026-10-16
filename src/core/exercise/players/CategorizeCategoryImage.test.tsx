/**
 * #562 — classification (buckets) category headers must render images the same
 * way item chips do. A category with `imageUrl` shows an <img> in its bucket
 * header; a text-only category keeps rendering its label as text.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { CategorizePlayer } from "./CategorizePlayer";

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

const items = [{ id: "i1", text: "Chó", imageUrl: "https://api.test/uploads/dog.png" }];
const correctMappings = { i1: "c_img" };

it("renders an <img> in the bucket header for a category with imageUrl, text for one without", () => {
  act(() =>
    root.render(
      <CategorizePlayer
        title="Q"
        categories={[
          { id: "c_img", label: "Phòng bừa bộn", imageUrl: "https://api.test/uploads/room.png" },
          { id: "c_txt", label: "Nhóm chữ" },
        ]}
        items={items}
        correctMappings={correctMappings}
      />,
    ),
  );

  const headers = Array.from(container.querySelectorAll("h3"));
  const imgHeader = headers.find((h) => h.querySelector("img"));
  const txtHeader = headers.find((h) => h.textContent?.includes("Nhóm chữ"));

  // Category with imageUrl → <img> in header (alt falls back to the label).
  const img = imgHeader?.querySelector("img");
  expect(img).toBeTruthy();
  expect(img!.getAttribute("src")).toBe("https://api.test/uploads/room.png");
  expect(img!.getAttribute("alt")).toBe("Phòng bừa bộn");

  // Text-only category → no <img>, label text preserved.
  expect(txtHeader).toBeTruthy();
  expect(txtHeader!.querySelector("img")).toBeNull();
});

it("keeps unsorted picture cards compact so the tray can wrap horizontally", () => {
  act(() =>
    root.render(
      <CategorizePlayer
        title="Q"
        categories={[{ id: "c", label: "NhÃ³m" }]}
        items={[
          { id: "i1", text: "HÃ¬nh 1", imageUrl: "/one.png" },
          { id: "i2", text: "HÃ¬nh 2", imageUrl: "/two.png" },
        ]}
        correctMappings={{ i1: "c", i2: "c" }}
      />,
    ),
  );

  const card = container.querySelector<HTMLElement>('[draggable="true"]')!;
  expect(card.parentElement?.className).toContain("w-full");
  expect(card.className).toContain("w-full");
  expect(card.querySelector("img")!.className).toContain("sm:!max-h-40");
  const tray = container.querySelector<HTMLElement>('[data-layout-region="classification-tray"]')!;
  expect(tray.className).toContain("grid-cols-2");
  expect(tray.className).toContain("lg:grid-cols-4");
});
