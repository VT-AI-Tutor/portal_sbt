import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ColoringPlayer } from "./ColoringPlayer";

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

describe("ColoringPlayer", () => {
  it("removes a fill when the region is clicked again with the same brush", () => {
    const onAnswerChange = vi.fn();

    act(() => {
      root.render(
        <ColoringPlayer
          title="Tô màu"
          regions={[{ id: "r1", label: "Ô số 1" }]}
          colors={["#ef4444", "#3b82f6"]}
          onAnswerChange={onAnswerChange}
        />,
      );
    });

    const region = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Ô số 1",
    );
    expect(region).toBeTruthy();

    act(() => region!.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith([
      { regionId: "r1", color: "#ef4444" },
    ]);
    expect(region!.getAttribute("aria-pressed")).toBe("true");
    expect(region!.style.backgroundColor).toBe("rgb(239, 68, 68)");

    act(() => region!.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith([]);
    expect(region!.getAttribute("aria-pressed")).toBe("false");
    expect(region!.style.backgroundColor).toBe("");
  });

  it("recolors a filled region directly when a different brush is selected", () => {
    const onAnswerChange = vi.fn();

    act(() => {
      root.render(
        <ColoringPlayer
          title="Tô màu"
          regions={[{ id: "r1", label: "Ô số 1" }]}
          colors={["#ef4444", "#3b82f6"]}
          onAnswerChange={onAnswerChange}
        />,
      );
    });

    const region = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Ô số 1",
    )!;
    const blueBrush = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Màu #3b82f6"]',
    )!;

    act(() => region.click());
    act(() => blueBrush.click());
    act(() => region.click());

    expect(onAnswerChange).toHaveBeenLastCalledWith([
      { regionId: "r1", color: "#3b82f6" },
    ]);
    expect(region.style.backgroundColor).toBe("rgb(59, 130, 246)");
  });
});
