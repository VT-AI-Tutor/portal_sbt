/**
 * Khối "Đáp án đúng" của nhóm phân loại GỘP THEO NHÓM — mỗi nhóm một dòng
 * `- <nhãn nhóm>: <thẻ>, <thẻ>.` — thay vì mỗi thẻ một dòng "thẻ → nhóm".
 *
 * Thứ tự nhóm lấy từ `categories`/`buckets`/`dropZones`, thứ tự thẻ lấy từ
 * `items`/`cards`/`draggables`. `correctMappings` CHỈ để tra cứu: bảng đó ghi
 * theo thứ tự người nhập liệu gõ, nên mọi ca dưới đây cố tình xáo nó.
 *
 * web-own: chưa upstream lên studio (xem checklist trong
 * apps/learner/scripts/detokenize-players.mjs). File này không tồn tại bên
 * studio nên sync-bằng-copy không đè, và nó đỏ ngay nếu một đợt sync nuốt mất
 * luật gộp — hệt cách diagram-fill-answer-reveal.test.tsx giữ luật dấu "=".
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CategorizePlayer } from "./CategorizePlayer";
import { CardSortPlayer } from "./CardSortPlayer";
import { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";
import { DragToZonesPlayer } from "./DragToZonesPlayer";
import { DragToGridPlayer } from "./DragToGridPlayer";

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

/** Khối "Đáp án đúng" của PlayerShell. */
function revealText(): string {
  const heading = Array.from(container.querySelectorAll("p")).find(
    (p) => p.textContent?.trim() === "Đáp án đúng",
  );
  expect(heading).toBeTruthy();
  return (heading!.parentElement as HTMLElement).textContent ?? "";
}

// Ca thật trong bảng ghi nhận lỗi Tiếng Việt (TV3 bài 4 LUYỆN TẬP câu 1).
const categories = [
  { id: "c1", label: "Từ ngữ chỉ màu sắc" },
  { id: "c2", label: "Từ ngữ chỉ hình dáng, kích thước" },
  { id: "c3", label: "Từ ngữ chỉ hương vị" },
];
const items = [
  { id: "i1", text: "vàng" },
  { id: "i2", text: "trắng" },
  { id: "i3", text: "nâu nhạt" },
  { id: "i4", text: "nhỏ xíu" },
  { id: "i5", text: "cao nghếu" },
  { id: "i6", text: "dài" },
  { id: "i7", text: "nhỏ xinh" },
  { id: "i8", text: "thơm ngát" },
];
// Cố tình gõ lộn xộn — đúng như dữ liệu thật nhập từ LCMS.
const correctMappings = {
  i1: "c1",
  i4: "c2",
  i8: "c3",
  i2: "c1",
  i5: "c2",
  i7: "c2",
  i3: "c1",
  i6: "c2",
};

describe("bảng đáp án phân loại gộp theo nhóm", () => {
  it("CategorizePlayer gộp mỗi nhóm một dòng, không còn dạng 'thẻ → nhóm'", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={categories}
          items={items}
          correctMappings={correctMappings}
        />,
      );
    });

    const text = revealText();
    expect(text).toContain("- Từ ngữ chỉ màu sắc: vàng, trắng, nâu nhạt.");
    expect(text).toContain("- Từ ngữ chỉ hình dáng, kích thước: nhỏ xíu, cao nghếu, dài, nhỏ xinh.");
    expect(text).toContain("- Từ ngữ chỉ hương vị: thơm ngát.");
    expect(text).not.toContain("→");
  });

  it("thứ tự nhóm theo `categories`, KHÔNG theo thứ tự key của correctMappings", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={categories}
          items={items}
          correctMappings={correctMappings}
        />,
      );
    });

    const text = revealText();
    // Key đầu bảng là i1→c1 nhưng nhóm c3 đứng trước c2 trong mapping (i8 ở dòng
    // thứ 3). Duyệt xuôi mapping sẽ đẩy "hương vị" lên trên "hình dáng".
    expect(text.indexOf("màu sắc")).toBeLessThan(text.indexOf("hình dáng"));
    expect(text.indexOf("hình dáng")).toBeLessThan(text.indexOf("hương vị"));
  });

  it("thứ tự thẻ trong nhóm theo `items`, không theo mapping", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={categories}
          items={items}
          correctMappings={correctMappings}
        />,
      );
    });

    // Mapping gõ i4, i5, i7 rồi mới i6 — dòng in ra phải theo items: …, dài, nhỏ xinh.
    expect(revealText()).toContain("nhỏ xíu, cao nghếu, dài, nhỏ xinh.");
  });

  it("nhóm không có thẻ nào thì bỏ hẳn dòng", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={categories}
          items={items}
          correctMappings={{ i1: "c1", i2: "c1" }}
        />,
      );
    });

    const text = revealText();
    expect(text).toContain("- Từ ngữ chỉ màu sắc: vàng, trắng.");
    expect(text).not.toContain("hình dáng");
    expect(text).not.toContain("hương vị");
  });

  it("mapping trỏ nhóm/thẻ chưa khai vẫn hiện — không bị nuốt khi đảo vòng lặp", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={categories}
          items={items}
          correctMappings={{ i1: "c1", "thẻ-lạ": "c1", i4: "nhóm-lạ" }}
        />,
      );
    });

    const text = revealText();
    expect(text).toContain("- Từ ngữ chỉ màu sắc: vàng, thẻ-lạ.");
    expect(text).toContain("- nhóm-lạ: nhỏ xíu.");
  });

  // Hai ca dưới đây tìm ra bằng cách quét nội dung thật qua API danh mục, không
  // phải nghĩ ra — unit test ban đầu không thấy vì fixture toàn từ đơn.
  it("thẻ là CÂU trọn vẹn: ngăn bằng dấu cách, không thêm dấu chấm thừa", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={[{ id: "k", label: "Câu kể" }]}
          items={[
            { id: "a", text: "a. Sân trường hôm nay vắng vẻ." },
            { id: "b", text: "b. Lan viết chữ đẹp." },
          ]}
          correctMappings={{ a: "k", b: "k" }}
        />,
      );
    });

    const text = revealText();
    expect(text).toContain("- Câu kể: a. Sân trường hôm nay vắng vẻ. b. Lan viết chữ đẹp.");
    expect(text).not.toContain("..");
    expect(text).not.toContain("vẻ.,");
  });

  it("thẻ là TỪ: vẫn ngăn bằng dấu phẩy và đóng bằng dấu chấm", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={categories}
          items={items}
          correctMappings={{ i1: "c1", i2: "c1" }}
        />,
      );
    });

    expect(revealText()).toContain("- Từ ngữ chỉ màu sắc: vàng, trắng.");
  });

  it("chỉ thẻ CUỐI có dấu chấm sẵn: không cộng thêm dấu chấm nữa", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={[{ id: "c", label: "Nhóm" }]}
          items={[
            { id: "a", text: "vàng" },
            { id: "b", text: "trắng." },
          ]}
          correctMappings={{ a: "c", b: "c" }}
        />,
      );
    });

    const text = revealText();
    expect(text).toContain("- Nhóm: vàng, trắng.");
    expect(text).not.toContain("trắng..");
  });

  it("nhóm TRỘN câu với từ: ngăn theo từng thẻ, không đẻ ra dấu '.,'", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={[{ id: "c", label: "Nhóm" }]}
          items={[
            { id: "a", text: "Sân trường hôm nay vắng vẻ." },
            { id: "b", text: "chó" },
          ]}
          correctMappings={{ a: "c", b: "c" }}
        />,
      );
    });

    const text = revealText();
    expect(text).toContain("- Nhóm: Sân trường hôm nay vắng vẻ. chó.");
    expect(text).not.toContain(".,");
  });

  it("thẻ khai thật mà id trùng id một nhóm: vẫn hiện, không bị coi là rác chiều ngược", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={[
            { id: "x", label: "Nhóm X" },
            { id: "y", label: "Nhóm Y" },
          ]}
          items={[
            { id: "x", text: "thẻ tên x" },
            { id: "b", text: "thẻ b" },
          ]}
          correctMappings={{ x: "y", b: "y" }}
        />,
      );
    });

    expect(revealText()).toContain("- Nhóm Y: thẻ tên x, thẻ b.");
  });

  it("thẻ có text toàn khoảng trắng: tính là thẻ không chữ, lùi về khuôn mũi tên", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={categories}
          items={[
            { id: "i1", text: "vàng" },
            { id: "i9", text: "   " },
          ]}
          correctMappings={{ i1: "c1", i9: "c1" }}
        />,
      );
    });

    const text = revealText();
    expect(text).toContain("→");
    expect(text).not.toContain("- Từ ngữ chỉ màu sắc: vàng,");
  });

  it("mapping khai CẢ HAI CHIỀU: bỏ rác chiều ngược, không đẻ nhóm ma", () => {
    act(() => {
      root.render(
        <CategorizePlayer
          title="Q"
          submitted
          categories={[
            { id: "c_gt", label: "Câu giới thiệu" },
            { id: "c_hd", label: "Câu nêu hoạt động" },
          ]}
          items={[
            { id: "s_a", text: "a. Mứt gừng là món truyền thống của Huế." },
            { id: "s_c", text: "c. Chị nhận nhiệm vụ đong đường." },
          ]}
          // Dạng thật của TV3/1 "Để cháu nắm tay ông": chiều đúng nằm lẫn với
          // chiều ngược, có cả key gộp nhiều id.
          correctMappings={{
            c_gt: "s_a",
            c_hd: "s_c,s_d,s_e",
            s_a: "c_gt",
            s_c: "c_hd",
          }}
        />,
      );
    });

    const text = revealText();
    expect(text).toContain("- Câu giới thiệu: a. Mứt gừng là món truyền thống của Huế.");
    expect(text).toContain("- Câu nêu hoạt động: c. Chị nhận nhiệm vụ đong đường.");
    expect(text).not.toContain("s_c,s_d,s_e");
    expect(text).not.toContain("- c_gt");
  });

  it("CardSortPlayer gộp như nhau", () => {
    act(() => {
      root.render(
        <CardSortPlayer
          title="Q"
          submitted
          categories={categories}
          cards={items}
          correctMappings={correctMappings}
        />,
      );
    });

    expect(revealText()).toContain("- Từ ngữ chỉ màu sắc: vàng, trắng, nâu nhạt.");
  });

  it("thẻ chỉ có ảnh: lùi về khuôn mũi tên, KHÔNG nhét URL vào dòng gộp", () => {
    act(() => {
      root.render(
        <CardSortPlayer
          title="Q"
          submitted
          categories={categories}
          cards={[{ id: "i1", text: "vàng" }, { id: "i9", imageUrl: "https://x/anh.png" }]}
          correctMappings={{ i1: "c1", i9: "c1" }}
        />,
      );
    });

    const text = revealText();
    expect(text).toContain("→");
    expect(text).not.toContain("- Từ ngữ chỉ màu sắc: vàng,");
  });

  it("TwoBucketSortPlayer gộp theo thứ tự hai rổ tác giả khai", () => {
    act(() => {
      root.render(
        <TwoBucketSortPlayer
          title="Q"
          submitted
          buckets={[
            { id: "b1", label: "Sống trên cạn" },
            { id: "b2", label: "Sống dưới nước" },
          ]}
          items={[
            { id: "i1", text: "chó" },
            { id: "i2", text: "cá" },
            { id: "i3", text: "mèo" },
          ]}
          correctMappings={{ i2: "b2", i1: "b1", i3: "b1" }}
        />,
      );
    });

    const text = revealText();
    expect(text).toContain("- Sống trên cạn: chó, mèo.");
    expect(text).toContain("- Sống dưới nước: cá.");
    expect(text.indexOf("trên cạn")).toBeLessThan(text.indexOf("dưới nước"));
  });

  it("DragToZonesPlayer gộp kể cả mode one_to_one", () => {
    act(() => {
      root.render(
        <DragToZonesPlayer
          title="Q"
          submitted
          mode="one_to_one"
          dropZones={[
            { id: "z1", label: "Chủ ngữ" },
            { id: "z2", label: "Vị ngữ" },
          ]}
          draggables={[
            { id: "d1", text: "Con mèo" },
            { id: "d2", text: "đang ngủ" },
          ]}
          correctMappings={{ d2: "z2", d1: "z1" }}
        />,
      );
    });

    const text = revealText();
    expect(text).toContain("- Chủ ngữ: Con mèo.");
    expect(text).toContain("- Vị ngữ: đang ngủ.");
    expect(text).not.toContain("→");
  });

  it("DragToGridPlayer KHÔNG gộp — đích là ô lưới, không phải nhóm", () => {
    act(() => {
      root.render(
        <DragToGridPlayer
          title="Q"
          submitted
          rows={1}
          cols={2}
          tokens={[
            { id: "t1", text: "A" },
            { id: "t2", text: "B" },
          ]}
          correctCells={{ "0-0": "t1", "0-1": "t2" }}
        />,
      );
    });

    expect(revealText()).toContain("→");
  });
});
