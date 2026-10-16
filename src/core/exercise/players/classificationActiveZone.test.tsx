/**
 * Rổ CÓ MÀU vẫn phải báo "thả được vào đây".
 *
 * Bẫy: skin phân biệt drop-target CHỈ bằng màu — `dropZone("active")` khác
 * `dropZone("idle")` ở đúng hai class `border-blue-400` / `bg-blue-50`, còn
 * `border-dashed` thì cả hai đều có. Khi màu tác giả khai đè lên viền + nền
 * bằng inline style, tín hiệu đó biến mất sạch: TwoBucket còn mỗi
 * `scale-[1.02]`, Categorize không còn gì. Học sinh kéo thẻ tới rổ mà rổ
 * không sáng lên — hỏng đúng thao tác chính, và CHỈ hỏng ở câu có màu nên
 * unit test cũ (chỉ đo trạng thái tĩnh) không thấy.
 *
 * Nên ở đây phải kéo THẬT rồi đo, không đo state.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";
import { CategorizePlayer } from "./CategorizePlayer";

const GREEN = "#3AAA35";
const RED = "#ED1C24";

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

/** Khung rổ của một nhóm — cha của vùng chứa thẻ. */
function zoneOf(label: string): HTMLElement {
  const group = container.querySelector(`[aria-label="Các thẻ trong nhóm ${label}"]`);
  if (!group?.parentElement) throw new Error(`không thấy rổ "${label}"`);
  return group.parentElement as HTMLElement;
}

function fire(el: Element, type: string): void {
  act(() => {
    el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
  });
}

/**
 * Thẻ kéo được. Hai player gắn nhãn khác nhau — TwoBucket truyền `ariaLabel`
 * cho DraggableChip, Categorize thì không — nên dò cả hai đường.
 */
function chipOf(text: string): Element {
  // Ưu tiên aria-label (TwoBucket truyền `ariaLabel` cho DraggableChip).
  const labelled = Array.from(container.querySelectorAll("[aria-label]")).find(
    (e) => e.getAttribute("aria-label") === text,
  );
  if (labelled) return labelled;
  // Categorize không gắn nhãn cho thẻ → dò theo chữ, nhưng CHỈ trong <button>:
  // khay chứa thẻ cũng có textContent y hệt và đứng TRƯỚC thẻ trong DOM, dò
  // rộng hơn là bấm nhầm vào khay và không chọn được thẻ nào.
  const btn = Array.from(container.querySelectorAll("button")).find(
    (e) => e.textContent?.trim() === text,
  );
  if (!btn) throw new Error(`không thấy thẻ "${text}"`);
  return btn;
}

describe("TwoBucketSort — rổ có màu lúc đang được nhắm tới", () => {
  function render() {
    act(() =>
      root.render(
        <TwoBucketSortPlayer
          title="Q"
          buckets={[
            { id: "b1", label: "Thân thiện", color: GREEN },
            { id: "b2", label: "Không thân thiện", color: RED },
          ]}
          items={[{ id: "i1", text: "Chào hỏi" }]}
          correctMappings={{ i1: "b1" }}
        />,
      ),
    );
  }

  it("kéo thẻ tới rổ → rổ ĐÓ đổi hẳn: có quầng sáng + nền đậm hơn", () => {
    render();
    const before = zoneOf("Thân thiện").style.cssText;

    fire(chipOf("Chào hỏi"), "dragstart");
    fire(zoneOf("Thân thiện"), "dragover");

    const zone = zoneOf("Thân thiện");
    expect(zone.style.boxShadow, "phải có quầng sáng lúc nhắm tới").toBeTruthy();
    expect(zone.style.boxShadow).toContain("rgba(58, 170, 53");
    expect(zone.style.backgroundColor).toBe("rgba(58, 170, 53, 0.3)");
    expect(zone.style.cssText, "phải khác hẳn lúc thường").not.toBe(before);
  });

  it("rổ KHÔNG được nhắm tới thì đứng yên — quầng chỉ ở một rổ", () => {
    render();
    fire(chipOf("Chào hỏi"), "dragstart");
    fire(zoneOf("Thân thiện"), "dragover");

    const other = zoneOf("Không thân thiện");
    expect(other.style.boxShadow).toBe("");
    expect(other.style.backgroundColor).toBe("rgba(237, 28, 36, 0.12)");
  });

  it("viền giữ ĐÚNG mã tác giả khai ở cả hai trạng thái", () => {
    render();
    expect(zoneOf("Thân thiện").style.borderColor).toBe("rgb(58, 170, 53)");
    fire(chipOf("Chào hỏi"), "dragstart");
    fire(zoneOf("Thân thiện"), "dragover");
    expect(zoneOf("Thân thiện").style.borderColor).toBe("rgb(58, 170, 53)");
  });

  it("rời chuột khỏi rổ → quầng tắt, về lại nền nhạt", () => {
    render();
    fire(chipOf("Chào hỏi"), "dragstart");
    fire(zoneOf("Thân thiện"), "dragover");
    fire(zoneOf("Thân thiện"), "dragleave");

    const zone = zoneOf("Thân thiện");
    expect(zone.style.boxShadow).toBe("");
    expect(zone.style.backgroundColor).toBe("rgba(58, 170, 53, 0.12)");
  });

  it("chạm-để-chọn KHÔNG đặt boxShadow — nếu đặt sẽ nuốt mất vòng amber của skin", () => {
    // Tailwind `ring-2 ring-amber-300` cũng là box-shadow, nên inline boxShadow
    // sẽ đè nó. Đường chạm không có dragId nên không được rơi vào activeZone.
    render();
    act(() => {
      (chipOf("Chào hỏi") as HTMLElement).click();
    });
    expect(zoneOf("Thân thiện").style.boxShadow).toBe("");
  });

  it("câu KHÔNG khai màu vẫn đi nguyên đường skin — không style inline nào", () => {
    act(() =>
      root.render(
        <TwoBucketSortPlayer
          title="Q"
          buckets={[{ id: "b1", label: "A" }, { id: "b2", label: "B" }]}
          items={[{ id: "i1", text: "x" }]}
          correctMappings={{ i1: "b1" }}
        />,
      ),
    );
    fire(chipOf("x"), "dragstart");
    fire(zoneOf("A"), "dragover");

    const zone = zoneOf("A");
    expect(zone.style.boxShadow).toBe("");
    expect(zone.style.backgroundColor).toBe("");
    expect(zone.style.borderColor).toBe("");
  });
});

describe("Categorize — nhóm có màu lúc học sinh đang cầm thẻ", () => {
  function render() {
    act(() =>
      root.render(
        <CategorizePlayer
          title="Q"
          categories={[
            { id: "c1", label: "An toàn", color: "#22c55e" },
            { id: "c2", label: "Không an toàn", color: "#ef4444" },
          ]}
          items={[{ id: "i1", text: "Đội mũ bảo hiểm" }]}
          correctMappings={{ i1: "c1" }}
        />,
      ),
    );
  }

  it("nhấc thẻ lên → MỌI nhóm sáng lên (đều là đích hợp lệ), đúng ngữ pháp skin", () => {
    render();
    expect(zoneOf("An toàn").style.boxShadow).toBe("");

    act(() => {
      (chipOf("Đội mũ bảo hiểm") as HTMLElement).click();
    });

    for (const label of ["An toàn", "Không an toàn"]) {
      expect(zoneOf(label).style.boxShadow, `${label} phải sáng lên`).toBeTruthy();
    }
    expect(zoneOf("An toàn").style.backgroundColor).toBe("rgba(34, 197, 94, 0.3)");
    expect(zoneOf("Không an toàn").style.backgroundColor).toBe("rgba(239, 68, 68, 0.3)");
  });

  it("thả thẻ vào nhóm xong → tắt sáng, về nền nhạt", () => {
    render();
    act(() => {
      (chipOf("Đội mũ bảo hiểm") as HTMLElement).click();
    });
    act(() => {
      zoneOf("An toàn").click();
    });
    expect(zoneOf("An toàn").style.boxShadow).toBe("");
    expect(zoneOf("An toàn").style.backgroundColor).toBe("rgba(34, 197, 94, 0.12)");
  });
});
