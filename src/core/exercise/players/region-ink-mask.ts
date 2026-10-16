/**
 * Ink-bounded region masks for P62 (image_color).
 *
 * Vùng tô của P62 khai báo bằng rect/circle/polygon, nên lớp màu trước đây là
 * một khối hình học phủ lên cả phần nền trắng quanh hình vẽ. Ở đây ta đọc pixel
 * của chính bức tranh để lấy phần THUỘC VỀ hình: tô kín hình, không tràn ra
 * ngoài.
 *
 * Thuật toán là "loang từ ngoài vào": loang nền qua các pixel không phải rào;
 * những gì loang KHÔNG tới được chính là phần bị rào bao kín (thân quả, chiếc
 * lá, cả con vật đã tô màu sẵn). Loang từ tâm ra sẽ chỉ tô được đúng một mảng
 * và chết ngay khi tâm rơi trúng nét vẽ.
 *
 * Bản đầu chỉ loang TRONG HỘP của vùng và chỉ coi nét ĐEN là rào. Đo lại trên
 * 96 ảnh P62 thật của NXBGD (517 vùng) thì 37% số vùng không dựng được mặt nạ,
 * vì ba chỗ bó tay:
 *
 * 1. **Hình to hơn hộp tác giả khai báo** — hộp cắt ngang nét vẽ, nền loang
 *    thẳng vào ruột nên chẳng còn gì khép kín (ngôi sao bị cắt cả năm cánh).
 * 2. **Mảng khép kín to hơn hộp** — hình tam giác trong bài hình học trùm ra
 *    ngoài hộp, loang trong hộp không bao giờ nhìn thấy nó.
 * 3. **Tranh tô màu sẵn** — con sư tử vàng trên nền trắng không có nét đen bao
 *    quanh, rào-theo-độ-tối coi cả con là nền rồi loang xuyên qua.
 *
 * Bản này dựng BẢN ĐỒ MẢNG cho cả bức ảnh một lần (`buildRegionCanvas`), trên
 * HAI kiểu rào — nét vẽ, và "khác màu giấy" — rồi mỗi vùng tự chọn phương án
 * khớp hình khai báo nhất (`maskForRegion`), kèm một bản đồ cục bộ quanh vùng
 * để cắt liên thông đường dài. Còn khoảng 5% số vùng không có phương án nào đủ
 * tốt: trả null và người gọi giữ nguyên lối tô hình học cũ.
 */

export interface PixelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pixel (toạ độ ảnh) nằm trong hình học tác giả khai báo hay không. */
export type ShapeTest = (px: number, py: number) => boolean;

/** Khung bao chuẩn hoá 0–1 của hình tác giả khai báo. */
export interface NormalizedBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Luminance dưới ngưỡng này coi là nét vẽ (rào chặn loang). */
export const INK_THRESHOLD = 140;

/** Alpha dưới ngưỡng này coi là nền, không phải hình. */
const TRANSPARENT_ALPHA = 16;

/** Khoảng cách RGB tối đa còn coi là cùng màu với giấy. */
const PAPER_TOLERANCE = 48;

/**
 * Viền ảnh phải đồng màu tới mức này mới dám coi đó là màu giấy. Ảnh nào viền
 * loang lổ (tranh tràn khung) thì bỏ hẳn lớp rào "khác màu giấy", thay vì đoán
 * bừa một màu rồi rào nhầm cả bức.
 */
const PAPER_BORDER_SHARE = 0.55;

/**
 * Nới hộp khi dựng bản đồ mảng CỤC BỘ quanh một vùng. Cửa sổ cục bộ cắt đứt
 * liên thông đường dài, nên tách được hình mà bản đồ toàn ảnh gộp chung với cả
 * bức tranh (quả cầu đứng giữa bức phòng đồ chơi chẳng hạn).
 */
const WINDOW_PAD = 0.35;

/**
 * Cửa sổ cục bộ loang được ít nền hơn ngần này thì vứt: nó nằm lọt thỏm giữa
 * một mảng màu lớn (thẻ số treo giữa tán lá), mọi "mảng khép kín" đo trong đó
 * chỉ là do cửa sổ cắt ra chứ không phải do nét vẽ khép lại.
 */
const MIN_WINDOW_BACKGROUND = 0.05;

/** Mảng to hơn ngần này lần hình khai báo thì không phải hình đang xét. */
const MAX_COMPONENT_RATIO = 4;

/**
 * Mảng phải nằm trong hình khai báo ít nhất ngần này phần diện tích của chính
 * nó — hình bên cạnh chỉ chạm mép vùng thì không bị tô lây.
 */
const MIN_COMPONENT_OVERLAP = 0.08;

/**
 * Mảng phải còn LÕI: bào mòn một pixel quanh mép mà tan hết thì nó là nét vẽ
 * mảnh, không phải một hình được tô.
 *
 * Nét vẽ hở làm nền loang thẳng vào ruột hình, phần "không loang tới" còn lại
 * chỉ là mấy nét vẽ; tô vào đó ra một cái viền màu lạ mắt chứ không phải hình
 * được tô. Chốt này bắt cả hai lớp rào cùng một lúc — ở lớp nét vẽ mảng là
 * "nét + ruột được bao kín", ở lớp khác-màu-giấy mảng chính là hình vẽ, nhưng
 * cả hai đều phải dày hơn một nét bút mới đáng tô.
 */
const MIN_CORE_RATIO = 0.15;

/**
 * Mảng chiếm gần hết cửa sổ nghĩa là ranh giới của nó chính là MÉP CỬA SỔ, không
 * phải nét vẽ — vùng nằm giữa một mảng màu phẳng lớn (bầu trời, bức tường, vạt
 * áo) là ca điển hình: mép màu cắt ngang cửa sổ nên vẫn loang được chút nền,
 * `MIN_WINDOW_BACKGROUND` không bắt được, và mặt nạ ra đúng cái khối chữ nhật
 * bằng cửa sổ. Đây là bản thay cho chốt `DEGENERATE_COVERAGE` của bản cũ.
 *
 * Ngưỡng 0,9 là điểm cắt sạch trên bộ 96 ảnh thật: nó bỏ đúng 4 vùng có mặt nạ
 * là khối đặc bằng cửa sổ, không giết thêm vùng bám-hình nào. Siết xuống 0,8
 * bắt đầu ăn vào các ca tốt (thêm 7 vùng rơi về khối hình học mà không bỏ thêm
 * được khối chữ nhật nào).
 */
const MAX_WINDOW_COVERAGE = 0.9;

/** Phương án khớp hình khai báo kém hơn ngần này thì thà rơi về khối hình học. */
const MIN_IOU = 0.12;

function luminance(data: Uint8ClampedArray, i: number): number {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

/** Cắt hộp về trong khung ảnh; trả null nếu phần còn lại quá nhỏ để loang. */
export function clampBox(box: PixelBox, imgW: number, imgH: number): PixelBox | null {
  const x0 = Math.max(0, Math.min(imgW, Math.round(box.x)));
  const y0 = Math.max(0, Math.min(imgH, Math.round(box.y)));
  const x1 = Math.max(0, Math.min(imgW, Math.round(box.x + box.w)));
  const y1 = Math.max(0, Math.min(imgH, Math.round(box.y + box.h)));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 3 || h < 3) return null;
  return { x: x0, y: y0, w, h };
}

/**
 * Màu giấy, đoán từ viền ảnh; null khi viền không đủ đồng màu — lúc đó bỏ hẳn
 * lớp rào "khác màu giấy".
 */
export function estimatePaperColor(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
): [number, number, number] | null {
  const step = Math.max(1, Math.round(Math.min(imgW, imgH) / 200));
  const samples: number[] = [];
  for (let x = 0; x < imgW; x += step) {
    samples.push(x * 4, ((imgH - 1) * imgW + x) * 4);
  }
  for (let y = 0; y < imgH; y += step) {
    samples.push(y * imgW * 4, (y * imgW + imgW - 1) * 4);
  }

  // Gom về ô màu 32 mức cho khỏi vỡ vụn vì nhiễu nén ảnh.
  const bins = new Map<number, number>();
  let counted = 0;
  for (const i of samples) {
    if (data[i + 3] < TRANSPARENT_ALPHA) continue;
    const key = ((data[i] >> 5) << 10) | ((data[i + 1] >> 5) << 5) | (data[i + 2] >> 5);
    bins.set(key, (bins.get(key) ?? 0) + 1);
    counted++;
  }
  let topKey = -1;
  let topCount = 0;
  for (const [key, n] of bins) {
    if (n > topCount) {
      topCount = n;
      topKey = key;
    }
  }
  if (topKey < 0 || topCount < counted * PAPER_BORDER_SHARE) return null;

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const i of samples) {
    if (data[i + 3] < TRANSPARENT_ALPHA) continue; // cùng chốt với lượt đếm ở trên
    const key = ((data[i] >> 5) << 10) | ((data[i + 1] >> 5) << 5) | (data[i + 2] >> 5);
    if (key !== topKey) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  return n ? [r / n, g / n, b / n] : null;
}

/** Một kiểu rào: 1 = pixel chặn loang. */
interface BarrierLayer {
  barrier: Uint8Array;
}

/** Bản đồ mảng khép kín trong một cửa sổ: -1 = nền ngoài, >= 0 = id mảng. */
interface LabelMap {
  labels: Int32Array;
  sizes: number[];
  /** Số pixel còn lại sau khi bào mòn một pixel quanh mép — xem `MIN_CORE_RATIO`. */
  cores: number[];
  /**
   * Khung bao từng mảng, toạ độ trong cửa sổ, ghi ngay lúc gán nhãn. Không có
   * nó thì dựng mặt nạ phải quét lại CẢ cửa sổ — mà cửa sổ toàn ảnh nghĩa là
   * quét cả bức tranh, cho mỗi vùng một lần.
   */
  bounds: Int32Array;
  win: PixelBox;
  backgroundRatio: number;
}

/** Bốn số mỗi mảng trong `LabelMap.bounds`: x0, y0, x1, y1. */
const BOUNDS_STRIDE = 4;

/** Bản đồ mảng của cả bức ảnh, dựng một lần rồi dùng cho mọi vùng. */
export interface RegionCanvas {
  width: number;
  height: number;
  layers: BarrierLayer[];
  globals: LabelMap[];
}

function inkBarrier(data: Uint8ClampedArray, size: number): Uint8Array {
  const barrier = new Uint8Array(size);
  for (let p = 0; p < size; p++) {
    const i = p * 4;
    if (data[i + 3] < TRANSPARENT_ALPHA) continue;
    if (luminance(data, i) < INK_THRESHOLD) barrier[p] = 1;
  }
  return barrier;
}

function paperBarrier(
  data: Uint8ClampedArray,
  size: number,
  paper: [number, number, number],
): Uint8Array {
  const barrier = new Uint8Array(size);
  const [pr, pg, pb] = paper;
  const tolerance = PAPER_TOLERANCE * PAPER_TOLERANCE;
  for (let p = 0; p < size; p++) {
    const i = p * 4;
    if (data[i + 3] < TRANSPARENT_ALPHA) continue;
    const dr = data[i] - pr;
    const dg = data[i + 1] - pg;
    const db = data[i + 2] - pb;
    if (dr * dr + dg * dg + db * db > tolerance) barrier[p] = 1;
  }
  return barrier;
}

/**
 * Gán nhãn các mảng khép kín trong cửa sổ `win`: loang nền từ viền cửa sổ qua
 * các pixel không phải rào, phần còn lại gom thành mảng theo 8 hướng (để nét
 * chéo không cắt rời mảng).
 */
function labelEnclosed(layer: BarrierLayer, imgW: number, win: PixelBox): LabelMap {
  const { barrier } = layer;
  const size = win.w * win.h;
  const labels = new Int32Array(size).fill(-2); // -2 = chưa xét, -1 = nền ngoài
  const queue = new Int32Array(size);
  const imageIndex = (lx: number, ly: number) => (win.y + ly) * imgW + win.x + lx;

  let head = 0;
  let tail = 0;
  let background = 0;
  const pushBackground = (lx: number, ly: number) => {
    const p = ly * win.w + lx;
    if (labels[p] !== -2 || barrier[imageIndex(lx, ly)]) return;
    labels[p] = -1;
    queue[tail++] = p;
  };

  for (let x = 0; x < win.w; x++) {
    pushBackground(x, 0);
    pushBackground(x, win.h - 1);
  }
  for (let y = 0; y < win.h; y++) {
    pushBackground(0, y);
    pushBackground(win.w - 1, y);
  }
  while (head < tail) {
    const p = queue[head++];
    background++;
    const x = p % win.w;
    const y = (p - x) / win.w;
    if (x > 0) pushBackground(x - 1, y);
    if (x < win.w - 1) pushBackground(x + 1, y);
    if (y > 0) pushBackground(x, y - 1);
    if (y < win.h - 1) pushBackground(x, y + 1);
  }

  const sizes: number[] = [];
  const boxes: number[] = [];
  let next = 0;
  for (let start = 0; start < size; start++) {
    if (labels[start] !== -2) continue;
    const id = next++;
    head = 0;
    tail = 0;
    labels[start] = id;
    queue[tail++] = start;
    let n = 0;
    let x0 = win.w;
    let y0 = win.h;
    let x1 = -1;
    let y1 = -1;
    while (head < tail) {
      const p = queue[head++];
      n++;
      const x = p % win.w;
      const y = (p - x) / win.w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= win.w || ny >= win.h) continue;
          const q = ny * win.w + nx;
          if (labels[q] !== -2) continue;
          labels[q] = id;
          queue[tail++] = q;
        }
      }
    }
    sizes.push(n);
    boxes.push(x0, y0, x1, y1);
  }

  // Lõi: pixel mà cả bốn hàng xóm đều cùng mảng. Mảng nào lõi rỗng thì chỉ là
  // một nét bút, bào mòn một pixel là tan.
  const cores = new Array<number>(sizes.length).fill(0);
  for (let y = 1; y < win.h - 1; y++) {
    for (let x = 1; x < win.w - 1; x++) {
      const p = y * win.w + x;
      const id = labels[p];
      if (id < 0) continue;
      if (
        labels[p - 1] === id &&
        labels[p + 1] === id &&
        labels[p - win.w] === id &&
        labels[p + win.w] === id
      ) {
        cores[id]++;
      }
    }
  }

  return {
    labels,
    sizes,
    cores,
    bounds: Int32Array.from(boxes),
    win,
    backgroundRatio: background / size,
  };
}

/**
 * Bản đồ mảng của cả bức ảnh — dựng MỘT lần cho mỗi ảnh rồi dùng lại cho mọi
 * vùng, vì chi phí loang tỉ lệ với diện tích.
 */
export function buildRegionCanvas(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
): RegionCanvas {
  const size = imgW * imgH;
  const layers: BarrierLayer[] = [{ barrier: inkBarrier(data, size) }];
  const paper = estimatePaperColor(data, imgW, imgH);
  if (paper) layers.push({ barrier: paperBarrier(data, size, paper) });
  const whole: PixelBox = { x: 0, y: 0, w: imgW, h: imgH };
  return {
    width: imgW,
    height: imgH,
    layers,
    globals: layers.map((layer) => labelEnclosed(layer, imgW, whole)),
  };
}

/**
 * Hình tác giả khai báo, rasterise MỘT lần rồi tra bảng.
 *
 * `insideShape` là hàm thuần nhưng với polygon nó chạy O(số đỉnh) mỗi lần gọi,
 * mà mỗi vùng phải soi lại cùng một hộp cho từng phương án — gọi thẳng là 5 lượt
 * quét hình cho mỗi vùng.
 */
interface ShapeRaster {
  /** Hộp bao hình, toạ độ ảnh. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 1 = pixel nằm trong hình; chỉ số theo hộp bao. */
  mask: Uint8Array;
  area: number;
}

function rasterizeShape(
  insideShape: ShapeTest,
  bounds: NormalizedBounds,
  imgW: number,
  imgH: number,
): ShapeRaster | null {
  const x0 = Math.max(0, Math.floor(bounds.x0 * imgW));
  const x1 = Math.min(imgW, Math.ceil(bounds.x1 * imgW));
  const y0 = Math.max(0, Math.floor(bounds.y0 * imgH));
  const y1 = Math.min(imgH, Math.ceil(bounds.y1 * imgH));
  if (x1 - x0 < 3 || y1 - y0 < 3) return null;

  const w = x1 - x0;
  const mask = new Uint8Array(w * (y1 - y0));
  let area = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!insideShape(x, y)) continue;
      mask[(y - y0) * w + (x - x0)] = 1;
      area++;
    }
  }
  return area ? { x0, y0, x1, y1, mask, area } : null;
}

interface Candidate {
  map: LabelMap;
  keep: Set<number>;
  iou: number;
}

/** Chọn mảng của một bản đồ cho một vùng; null nếu không mảng nào dùng được. */
function pickComponents(map: LabelMap, shape: ShapeRaster): Candidate | null {
  if (map.backgroundRatio < MIN_WINDOW_BACKGROUND) return null;

  const { labels, sizes, cores, win } = map;
  const shapeW = shape.x1 - shape.x0;
  const x0 = Math.max(win.x, shape.x0);
  const x1 = Math.min(win.x + win.w, shape.x1);
  const y0 = Math.max(win.y, shape.y0);
  const y1 = Math.min(win.y + win.h, shape.y1);

  const overlap = new Map<number, number>();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!shape.mask[(y - shape.y0) * shapeW + (x - shape.x0)]) continue;
      const id = labels[(y - win.y) * win.w + (x - win.x)];
      if (id < 0) continue;
      overlap.set(id, (overlap.get(id) ?? 0) + 1);
    }
  }

  const keep = new Set<number>();
  let inter = 0;
  let area = 0;
  let core = 0;
  for (const [id, n] of overlap) {
    const a = sizes[id];
    if (a > shape.area * MAX_COMPONENT_RATIO) continue;
    if (n < a * MIN_COMPONENT_OVERLAP) continue;
    keep.add(id);
    inter += n;
    area += a;
    core += cores[id];
  }
  if (!keep.size) return null;
  if (area > win.w * win.h * MAX_WINDOW_COVERAGE) return null;
  if (core < area * MIN_CORE_RATIO) return null;

  const iou = inter / (area + shape.area - inter);
  if (iou < MIN_IOU) return null;
  return { map, keep, iou };
}

/**
 * Mặt nạ của một vùng: thử phương án trên bản đồ toàn ảnh và trên bản đồ cục bộ
 * quanh vùng, lấy phương án khớp hình khai báo nhất (IoU). null khi không
 * phương án nào đủ tốt — người gọi giữ lối tô hình học cũ.
 */
export function maskForRegion(
  canvas: RegionCanvas,
  insideShape: ShapeTest,
  bounds: NormalizedBounds,
): { box: PixelBox; mask: Uint8Array } | null {
  const { width, height } = canvas;
  const shape = rasterizeShape(insideShape, bounds, width, height);
  if (!shape) return null;

  const candidates: Candidate[] = [];
  for (const map of canvas.globals) {
    const found = pickComponents(map, shape);
    if (found) candidates.push(found);
  }

  const padX = (shape.x1 - shape.x0) * WINDOW_PAD;
  const padY = (shape.y1 - shape.y0) * WINDOW_PAD;
  const local = clampBox(
    {
      x: shape.x0 - padX,
      y: shape.y0 - padY,
      w: shape.x1 - shape.x0 + padX * 2,
      h: shape.y1 - shape.y0 + padY * 2,
    },
    width,
    height,
  );
  if (local) {
    for (const layer of canvas.layers) {
      const found = pickComponents(labelEnclosed(layer, width, local), shape);
      if (found) candidates.push(found);
    }
  }
  if (!candidates.length) return null;

  const best = candidates.reduce((a, b) => (b.iou > a.iou ? b : a));
  const { labels, win } = best.map;

  // Khung bao = hợp khung của các mảng được giữ (ghi sẵn lúc gán nhãn), nên
  // không phải quét lại cửa sổ.
  let bx0 = win.w;
  let by0 = win.h;
  let bx1 = -1;
  let by1 = -1;
  for (const id of best.keep) {
    const at = id * BOUNDS_STRIDE;
    if (best.map.bounds[at] < bx0) bx0 = best.map.bounds[at];
    if (best.map.bounds[at + 1] < by0) by0 = best.map.bounds[at + 1];
    if (best.map.bounds[at + 2] > bx1) bx1 = best.map.bounds[at + 2];
    if (best.map.bounds[at + 3] > by1) by1 = best.map.bounds[at + 3];
  }
  if (bx1 < bx0 || by1 < by0) return null;

  const box: PixelBox = {
    x: win.x + bx0,
    y: win.y + by0,
    w: bx1 - bx0 + 1,
    h: by1 - by0 + 1,
  };
  const mask = new Uint8Array(box.w * box.h);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const id = labels[(by0 + y) * win.w + (bx0 + x)];
      if (id >= 0 && best.keep.has(id)) mask[y * box.w + x] = 1;
    }
  }
  return { box, mask };
}

/**
 * Viền bao quanh mặt nạ, dày `radius` pixel, dùng vẽ ring chấm đúng/sai mà
 * không phải dựng lại cái hộp chữ nhật cũ.
 */
export function outlineMask(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(w * h);
  if (radius <= 0) return out;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const mi = y * w + x;
      if (!mask[mi]) continue;
      const edge =
        x === 0 ||
        y === 0 ||
        x === w - 1 ||
        y === h - 1 ||
        !mask[mi - 1] ||
        !mask[mi + 1] ||
        !mask[mi - w] ||
        !mask[mi + w];
      if (!edge) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          out[ny * w + nx] = 1;
        }
      }
    }
  }
  return out;
}
