import { describe, expect, it } from "vitest";
import {
  buildRegionCanvas,
  clampBox,
  estimatePaperColor,
  maskForRegion,
  outlineMask,
  type NormalizedBounds,
  type PixelBox,
} from "./region-ink-mask";

const W = 24;
const H = 24;

/** Ảnh trắng WxH; `strokes` là các pixel nét vẽ đen. */
function image(strokes: Array<[number, number]>, w = W, h = H): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x, y] of strokes) {
    const i = (y * w + x) * 4;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
  }
  return data;
}

/** Viền của một ô vuông rỗng ruột. */
function squareOutline(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let x = x0; x <= x1; x++) {
    pts.push([x, y0], [x, y1]);
  }
  for (let y = y0; y <= y1; y++) {
    pts.push([x0, y], [x1, y]);
  }
  return pts;
}

/** Cả ô vuông tô đặc một màu — tranh tô sẵn, không có nét viền đen. */
function filledSquare(
  data: Uint8ClampedArray,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: [number, number, number],
  w = W,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
    }
  }
}

/** Vùng tác giả khai báo, cho theo pixel để test đọc dễ. */
function region(x0: number, y0: number, x1: number, y1: number, w = W, h = H) {
  const bounds: NormalizedBounds = { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h };
  const inside = (px: number, py: number) => px >= x0 && px <= x1 && py >= y0 && py <= y1;
  return { bounds, inside };
}

const at = (mask: Uint8Array, box: PixelBox, x: number, y: number) =>
  mask[(y - box.y) * box.w + (x - box.x)];

function maskOf(
  data: Uint8ClampedArray,
  area: ReturnType<typeof region>,
  w = W,
  h = H,
): { box: PixelBox; mask: Uint8Array } | null {
  return maskForRegion(buildRegionCanvas(data, w, h), area.inside, area.bounds);
}

describe("maskForRegion", () => {
  it("fills what the artwork encloses and nothing outside it", () => {
    const data = image(squareOutline(8, 8, 15, 15));
    const found = maskOf(data, region(6, 6, 17, 17))!;

    expect(found).not.toBeNull();
    // Ruột hình: tô.
    expect(at(found.mask, found.box, 12, 12)).toBe(1);
    // Chính nét vẽ: tô (màu ôm sát mép hình).
    expect(at(found.mask, found.box, 8, 8)).toBe(1);
    // Nền trắng quanh hình, vẫn trong vùng khai báo: KHÔNG tô.
    expect(found.box.x).toBe(8);
    expect(found.box.w).toBe(8);
  });

  it("keeps every enclosed piece, not just the one under the seed point", () => {
    // Hai mảng khép kín rời nhau (thân + lá) trong cùng một vùng.
    const data = image([...squareOutline(5, 5, 9, 9), ...squareOutline(14, 14, 18, 18)]);
    const found = maskOf(data, region(4, 4, 19, 19))!;

    expect(at(found.mask, found.box, 7, 7)).toBe(1);
    expect(at(found.mask, found.box, 16, 16)).toBe(1);
    expect(at(found.mask, found.box, 11, 11)).toBe(0);
  });

  it("drops enclosed pieces the authored shape does not touch", () => {
    const data = image([...squareOutline(5, 5, 9, 9), ...squareOutline(14, 14, 18, 18)]);
    // Hình học tác giả chỉ trùm mảng trên-trái.
    const found = maskOf(data, region(4, 4, 10, 10))!;

    expect(at(found.mask, found.box, 7, 7)).toBe(1);
    expect(found.box.x + found.box.w).toBeLessThanOrEqual(11);
  });

  it("bám theo hình KỂ CẢ khi hình to hơn vùng tác giả khai báo", () => {
    // Vùng khai báo nằm gọn bên trong ô vuông: bản cũ loang trong hộp thì hộp
    // không chứa nét nào khép lại, mặt nạ trả null và cả hình rơi về khối.
    const data = image(squareOutline(6, 6, 17, 17));
    const found = maskOf(data, region(9, 9, 14, 14))!;

    expect(found).not.toBeNull();
    expect(found.box).toEqual({ x: 6, y: 6, w: 12, h: 12 });
    expect(at(found.mask, found.box, 7, 7)).toBe(1); // ruột, ngoài vùng khai báo
    expect(at(found.mask, found.box, 12, 12)).toBe(1);
  });

  it("bám theo tranh tô màu sẵn, không có nét viền đen nào", () => {
    // Con vật tô màu vàng trên nền trắng: rào-theo-độ-tối coi cả con là nền.
    const data = image([]);
    filledSquare(data, 8, 8, 15, 15, [250, 200, 40]);
    const found = maskOf(data, region(9, 9, 14, 14))!;

    expect(found).not.toBeNull();
    expect(found.box).toEqual({ x: 8, y: 8, w: 8, h: 8 });
    expect(at(found.mask, found.box, 8, 8)).toBe(1);
  });

  it("returns null when there is no artwork to hug", () => {
    expect(maskOf(image([]), region(4, 4, 15, 15))).toBeNull();
  });

  it("returns null when an open outline lets the fill escape the shape", () => {
    // Ô vuông hở một khe ở cạnh trên → nền loang vào tận ruột.
    const open = squareOutline(8, 8, 15, 15).filter(([x, y]) => !(y === 8 && x >= 11 && x <= 12));
    expect(maskOf(image(open), region(6, 6, 17, 17))).toBeNull();
  });

  it("returns null for a region too small to flood", () => {
    expect(maskOf(image(squareOutline(8, 8, 15, 15)), region(1, 1, 2, 2))).toBeNull();
  });

  it("bỏ mảng to gấp nhiều lần hình tác giả khai báo", () => {
    // Vùng bé xíu đặt trong lòng một hình lớn: tô cả hình lớn là tràn, thà rơi
    // về khối hình học.
    const data = image(squareOutline(2, 2, 21, 21));
    expect(maskOf(data, region(10, 10, 12, 12))).toBeNull();
  });

  it("treats fully transparent pixels as background, not ink", () => {
    const data = image(squareOutline(8, 8, 15, 15));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (data[i] === 255) data[i + 3] = 0; // nền trong suốt
      }
    }
    const found = maskOf(data, region(6, 6, 17, 17))!;
    expect(at(found.mask, found.box, 12, 12)).toBe(1);
    expect(found.box).toEqual({ x: 8, y: 8, w: 8, h: 8 });
  });
});

/**
 * Lợi ích của bản đồ CỤC BỘ (tách được hình mà bản đồ toàn ảnh gộp chung với cả
 * bức tranh) chỉ hiện ra trên tranh thật, nơi mép cửa sổ rơi trúng nét vẽ của
 * các hình bên cạnh — dựng lại bằng ảnh test 24x24 thì không trung thực. Nó
 * được đo trên bộ 96 ảnh thật (120/488 vùng thắng nhờ bản đồ cục bộ), ghi trong
 * mô tả PR. Ở đây chỉ khoá các CHỐT CHẶN của nó.
 */
describe("maskForRegion — chốt chặn của bản đồ cục bộ và việc chọn phương án", () => {
  it("bỏ cửa sổ cục bộ bị rào kín — mọi 'mảng' trong đó chỉ do cửa sổ cắt ra", () => {
    // Vùng khai báo nằm lọt giữa một mảng màu đặc: cửa sổ cục bộ không loang
    // được nền nào, nên phải rơi về khối hình học thay vì tô bừa cả cửa sổ.
    const data = image([]);
    filledSquare(data, 2, 2, 21, 21, [40, 120, 60]);
    expect(maskOf(data, region(9, 9, 14, 14))).toBeNull();
  });

  it("không tô cả cửa sổ khi vùng nằm giữa một mảng màu phẳng lớn", () => {
    // Bầu trời / bức tường: mép mảng màu cắt ngang cửa sổ cục bộ nên vẫn loang
    // được chút nền (`MIN_WINDOW_BACKGROUND` không bắt), và "mảng khép kín" duy
    // nhất chính là phần cửa sổ còn lại — tô vào đó ra đúng một khối chữ nhật
    // bằng cửa sổ, tràn ra ngoài vùng tác giả khai báo.
    const w = 60;
    const h = 60;
    const data = image([], w, h);
    filledSquare(data, 6, 6, 53, 30, [120, 170, 240], w);
    expect(maskOf(data, region(20, 18, 29, 27, w, h), w, h)).toBeNull();
  });

  it("chọn phương án khớp hình khai báo hơn giữa hai lớp rào", () => {
    // Hình tô đặc màu sáng, viền đen: lớp nét vẽ chỉ thấy cái viền + ruột của
    // nó, lớp khác-màu-giấy thấy cả hình. Cả hai đều hợp lệ; phải lấy phương án
    // IoU cao hơn, tức bám đúng hình.
    const data = image(squareOutline(8, 8, 15, 15));
    filledSquare(data, 9, 9, 14, 14, [250, 220, 60]);
    const found = maskOf(data, region(9, 9, 14, 14))!;

    expect(found).not.toBeNull();
    expect(found.box).toEqual({ x: 8, y: 8, w: 8, h: 8 });
    expect(at(found.mask, found.box, 12, 12)).toBe(1);
  });
});

describe("estimatePaperColor", () => {
  it("đọc ra màu giấy khi viền ảnh đồng màu", () => {
    expect(estimatePaperColor(image([]), W, H)).toEqual([255, 255, 255]);
  });

  it("trả null khi viền ảnh loang lổ — không đoán bừa rồi rào nhầm cả bức", () => {
    const data = image([]);
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        if (x !== 0 && y !== 0 && x !== W - 1 && y !== H - 1) continue;
        const i = (y * W + x) * 4;
        const shade = (x * 37 + y * 53) % 256;
        data[i] = shade;
        data[i + 1] = (shade * 3) % 256;
        data[i + 2] = (shade * 7) % 256;
      }
    }
    expect(estimatePaperColor(data, W, H)).toBeNull();
  });
});

describe("clampBox", () => {
  it("clips to the image and rejects slivers", () => {
    expect(clampBox({ x: -5, y: -5, w: 12, h: 12 }, W, H)).toEqual({ x: 0, y: 0, w: 7, h: 7 });
    expect(clampBox({ x: 23, y: 23, w: 10, h: 10 }, W, H)).toBeNull();
  });
});

describe("outlineMask", () => {
  it("rings the mask without leaving its interior hollow", () => {
    const w = 9;
    const h = 9;
    const mask = new Uint8Array(w * h);
    for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) mask[y * w + x] = 1;

    const ring = outlineMask(mask, w, h, 1);
    expect(ring[4 * w + 2]).toBe(1); // ngay ngoài mép
    expect(ring[4 * w + 0]).toBe(0); // xa hơn bán kính
    expect(outlineMask(mask, w, h, 0).some((v) => v === 1)).toBe(false);
  });
});
