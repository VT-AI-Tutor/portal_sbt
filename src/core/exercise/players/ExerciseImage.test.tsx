/**
 * Issue #427 — ExerciseImage: one shared rule for exercise images.
 *
 * `frame`  → fixed frame wrapper (overflow-hidden) + img h-full w-full object-contain (#465 — content images never cropped).
 * `cover`  → same wrapper, img object-cover (deliberate crop only).
 * `intrinsic` → natural-ratio img (w-auto h-auto, responsive max caps, object-contain).
 *
 * jsdom does not lay out images, so the regression coverage for landscape /
 * portrait / square sources asserts the class structure that produces the
 * correct rendering, not pixel geometry.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExerciseImage } from "./shared";

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

// Landscape, portrait and square sources go through the exact same class
// pipeline — the frame decides geometry for `cover`, the natural ratio for
// `intrinsic`. Cover each shape in both variants.
const shapeCases: [string, string][] = [
  ["landscape", "/img/landscape-400x200.png"],
  ["portrait", "/img/portrait-200x400.png"],
  ["square", "/img/square-300x300.png"],
];

describe("ExerciseImage cover variant", () => {
  it.each(shapeCases)(
    "renders a %s source inside a fixed frame shown in full with object-contain (#465)",
    (_shape, src) => {
      act(() => {
        root.render(
          <ExerciseImage
            variant="frame"
            src={src}
            alt="minh họa"
            className="w-[3.75rem] h-[3.75rem] sm:w-[4.5rem] sm:h-[4.5rem] shrink-0 rounded-xl"
          />,
        );
      });

      const img = container.querySelector("img");
      const frame = img?.parentElement;

      // Frame: keeps the designed size classes, hides the cropped overflow and
      // carries the rounding so the crop respects the corners.
      expect(frame?.tagName).toBe("SPAN");
      expect(frame?.classList.contains("overflow-hidden")).toBe(true);
      expect(frame?.classList.contains("block")).toBe(true);
      expect(frame?.classList.contains("w-[3.75rem]")).toBe(true);
      expect(frame?.classList.contains("h-[3.75rem]")).toBe(true);
      expect(frame?.classList.contains("rounded-xl")).toBe(true);
      expect(frame?.classList.contains("shrink-0")).toBe(true);

      // Image: fills the frame, center-cropped, never letterboxed.
      expect(img?.getAttribute("src")).toBe(src);
      expect(img?.getAttribute("alt")).toBe("minh họa");
      expect(img?.classList.contains("h-full")).toBe(true);
      expect(img?.classList.contains("w-full")).toBe(true);
      expect(img?.classList.contains("object-contain")).toBe(true);
      expect(img?.classList.contains("object-center")).toBe(true);
      expect(img?.classList.contains("object-cover")).toBe(false);
      // Rounding lives on the frame, not on the cropped img.
      expect(img?.classList.contains("rounded-xl")).toBe(false);
    },
  );

  it("lets call sites override the display mode for inline flows", () => {
    act(() => {
      root.render(
        <ExerciseImage
          variant="frame"
          src="/a.png"
          alt=""
          className="mr-2 inline-block h-10 w-10 align-middle"
        />,
      );
    });

    const frame = container.querySelector("img")?.parentElement;
    // twMerge resolves the display conflict in favour of the call site.
    expect(frame?.classList.contains("inline-block")).toBe(true);
    expect(frame?.classList.contains("block")).toBe(false);
    expect(frame?.classList.contains("mr-2")).toBe(true);
    expect(frame?.classList.contains("align-middle")).toBe(true);
    expect(frame?.classList.contains("overflow-hidden")).toBe(true);
  });

  it("forwards extra img props such as draggable", () => {
    act(() => {
      root.render(
        <ExerciseImage
          variant="frame"
          src="/card.png"
          alt="thẻ"
          className="h-full w-full rounded-xl"
          draggable={false}
        />,
      );
    });

    const img = container.querySelector("img");
    expect(img?.getAttribute("draggable")).toBe("false");
  });
});

describe("ExerciseImage intrinsic variant", () => {
  it.each(shapeCases)(
    "renders a %s source at its natural ratio without a forced frame",
    (_shape, src) => {
      act(() => {
        root.render(<ExerciseImage variant="intrinsic" src={src} alt="hình đề bài" />);
      });

      const img = container.querySelector("img");

      // No wrapper frame — the img itself is the root element.
      expect(img?.parentElement).toBe(container);

      // Natural ratio: auto dimensions with responsive max caps, no crop.
      expect(img?.getAttribute("src")).toBe(src);
      expect(img?.classList.contains("w-auto")).toBe(true);
      expect(img?.classList.contains("h-auto")).toBe(true);
      expect(img?.classList.contains("max-w-full")).toBe(true);
      expect(img?.classList.contains("max-h-48")).toBe(true);
      expect(img?.classList.contains("sm:max-h-64")).toBe(true);
      expect(img?.classList.contains("object-contain")).toBe(true);
      expect(img?.classList.contains("object-cover")).toBe(false);
    },
  );

  it("merges call-site classes onto the img (e.g. rounding, custom cap)", () => {
    act(() => {
      root.render(
        <ExerciseImage
          variant="intrinsic"
          src="/hero.png"
          alt=""
          className="rounded-2xl max-h-36"
        />,
      );
    });

    const img = container.querySelector("img");
    expect(img?.classList.contains("rounded-2xl")).toBe(true);
    // twMerge lets the call-site cap win over the default max-h-48.
    expect(img?.classList.contains("max-h-36")).toBe(true);
    expect(img?.classList.contains("max-h-48")).toBe(false);
  });
});

it('variant "cover" still crops with object-cover (deliberate-crop surfaces)', () => {
  act(() =>
    root.render(
      <ExerciseImage variant="cover" src="/uploads/bg.png" alt="nền" className="w-10 h-10" />,
    ),
  );
  const img = container.querySelector("img");
  expect(img?.classList.contains("object-cover")).toBe(true);
  expect(img?.classList.contains("object-contain")).toBe(false);
});
