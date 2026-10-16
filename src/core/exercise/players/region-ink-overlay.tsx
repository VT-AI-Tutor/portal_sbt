/**
 * Lớp tô "ôm sát nét vẽ" cho P62 (image_color).
 *
 * Hook đọc pixel bức tranh một lần rồi dựng mặt nạ cho từng vùng
 * (xem `region-ink-mask.ts`); component vẽ các mặt nạ đó lên một canvas phủ
 * đúng khung ảnh. Vùng nào không dựng được mặt nạ — ảnh hỏng, canvas bị taint
 * vì CORS, trình duyệt không có canvas 2d (jsdom), hay hình vẽ không khép kín
 * để bám theo — thì không có mặt nạ và người gọi giữ nguyên lối tô hình học cũ.
 */
import React, { useEffect, useRef, useState } from "react";
import { loadImageViaBlob } from "@/core/content/loadImage";
import { buildRegionCanvas, maskForRegion, outlineMask, type PixelBox } from "./region-ink-mask";
import type { Rgb } from "./cssColor";

/** Hình học vùng tô, chuẩn hoá 0–1 (khớp `ImageRegionItem` của P62). */
export interface InkRegionShape {
  id: string;
  shape: "circle" | "rect" | "polygon";
  x?: number;
  y?: number;
  radius?: number;
  width?: number;
  height?: number;
  points?: Array<[number, number]>;
}

export interface InkRegionMask {
  box: PixelBox;
  mask: Uint8Array;
  outline: Uint8Array;
}

export interface InkMaskSet {
  width: number;
  height: number;
  byId: Record<string, InkRegionMask>;
}

export interface InkPaintLayer {
  id: string;
  /** Màu tô, đã quy về [r, g, b] — canvas không nhận chuỗi CSS. */
  rgb: Rgb;
  /** Độ đậm phần tô, 0–255. */
  alpha: number;
  /** Màu viền phản hồi đúng/sai; bỏ trống thì không vẽ viền. */
  ringRgb?: Rgb;
}

/**
 * Trần SỐ PIXEL của canvas dựng mặt nạ — chặn chi phí loang trên ảnh in khổ lớn.
 *
 * Loang chạy ĐỒNG BỘ trên luồng chính và chi phí tỉ lệ với DIỆN TÍCH, nên trần
 * phải đặt theo diện tích. Trần theo cạnh dài nhất (800px) chặn đúng ảnh vuông
 * nhưng nghiền nát ảnh dài-mà-thấp: một dải sáu quả táo 1146×190 chỉ có 0,22 MP
 * — rẻ hơn hẳn mức trần — vậy mà vẫn bị thu về 800×133, đủ để nét viền 1px nhạt
 * quá ngưỡng nét vẽ và hở ra; nền loang thẳng vào ruột quả, mảng còn lại không
 * còn lõi, mặt nạ trả null và cả sáu vùng rơi về khối chữ nhật — đúng cái lỗi
 * tính năng này sinh ra để sửa.
 *
 * 800² giữ nguyên chi phí xấu nhất của mức trần cũ (ảnh vuông vẫn dừng ở
 * 800×800), nhưng ảnh thấp hơn trần thì đọc ở đúng khổ gốc, nét mảnh còn nguyên.
 */
const MAX_MASK_PIXELS = 800 * 800;

/**
 * Hệ số thu nhỏ khi dựng mặt nạ: giữ khổ gốc nếu ảnh dưới trần, ngược lại thu
 * đều hai chiều cho vừa `MAX_MASK_PIXELS`. Không bao giờ phóng to.
 */
export function maskScale(naturalWidth: number, naturalHeight: number): number {
  const pixels = naturalWidth * naturalHeight;
  if (!(pixels > 0)) return 1;
  return Math.min(1, Math.sqrt(MAX_MASK_PIXELS / pixels));
}

const DEFAULT_RADIUS = 0.06;
const DEFAULT_SIDE = 0.1;

// Mỗi ảnh chỉ kêu một lần: hook chạy lại mỗi khi hình học đổi, để nguyên thì
// một câu hỏng đẻ ra hàng chục dòng giống hệt nhau.
const warnedImages = new Set<string>();

function warnFallback(imageUrl: string, reason: string): void {
  if (warnedImages.has(imageUrl)) return;
  warnedImages.add(imageUrl);
  console.warn(
    `[ImageColorClassify] Tô theo nét vẽ không dùng được cho "${imageUrl}" — ${reason}. Vùng tô rơi về khối hình học như bản cũ.`,
  );
}

const validPolygon = (it: InkRegionShape): it is InkRegionShape & { points: Array<[number, number]> } =>
  Array.isArray(it.points) &&
  it.points.length >= 3 &&
  it.points.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));

/** Khung bao chuẩn hoá của vùng; null nếu hình học không dựng được. */
export function normalizedBounds(it: InkRegionShape): { x0: number; y0: number; x1: number; y1: number } | null {
  if (it.shape === "polygon") {
    if (!validPolygon(it)) return null;
    const xs = it.points.map(([x]) => x);
    const ys = it.points.map(([, y]) => y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }
  const x = it.x ?? 0;
  const y = it.y ?? 0;
  if (it.shape === "circle") {
    const r = it.radius ?? DEFAULT_RADIUS;
    return { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
  }
  return { x0: x, y0: y, x1: x + (it.width ?? DEFAULT_SIDE), y1: y + (it.height ?? DEFAULT_SIDE) };
}

/**
 * Điểm chuẩn hoá có nằm trong hình học tác giả khai báo không.
 *
 * Nhánh circle dùng CHUNG `radius` cho cả hai trục trong không gian chuẩn hoá,
 * khớp với `regionStyle` bên player (width = r*200% bề ngang, height = r*200%
 * bề dọc → thành ellipse theo pixel nhưng là hình tròn theo toạ độ chuẩn hoá).
 * Đổi một bên mà quên bên kia là mặt nạ lệch khỏi vùng bắt click.
 */
export function normalizedHitTest(it: InkRegionShape): (nx: number, ny: number) => boolean {
  if (it.shape === "polygon") {
    if (!validPolygon(it)) return () => false;
    const pts = it.points;
    return (nx, ny) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        const crosses = (yi > ny) !== (yj > ny) && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi;
        if (crosses) inside = !inside;
      }
      return inside;
    };
  }
  const x = it.x ?? 0;
  const y = it.y ?? 0;
  if (it.shape === "circle") {
    const r = it.radius ?? DEFAULT_RADIUS;
    if (r <= 0) return () => false;
    return (nx, ny) => ((nx - x) / r) ** 2 + ((ny - y) / r) ** 2 <= 1;
  }
  const w = it.width ?? DEFAULT_SIDE;
  const h = it.height ?? DEFAULT_SIDE;
  return (nx, ny) => nx >= x && nx <= x + w && ny >= y && ny <= y + h;
}

/**
 * Mặt nạ tô theo nét vẽ cho từng vùng. Trả null khi chưa dựng được vùng nào —
 * người gọi giữ lối tô hình học cũ.
 *
 * `enabled` tắt hẳn ở chế độ sửa hình học của studio: ở đó tác giả cần THẤY
 * đúng cái rect/circle mình đang kéo, chứ không phải mặt nạ.
 */
export function useInkRegionMasks(
  imageUrl: string,
  items: InkRegionShape[],
  enabled: boolean,
): InkMaskSet | null {
  const [masks, setMasks] = useState<InkMaskSet | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Khoá theo NỘI DUNG hình học: `items` là mảng mới mỗi lần render nên dùng nó
  // làm dep sẽ dựng lại mặt nạ liên tục. (Không bọc useMemo — mảng mới mỗi lần
  // render thì memo cũng chạy lại y hệt, chỉ thêm chữ.)
  const geometryKey = JSON.stringify(
    items.map((it) => [it.id, it.shape, it.x, it.y, it.radius, it.width, it.height, it.points]),
  );

  useEffect(() => {
    setMasks(null);
    if (!enabled || !imageUrl) return;
    let cancelled = false;

    (async () => {
      let img: HTMLImageElement;
      try {
        img = await loadImageViaBlob(imageUrl);
      } catch {
        // Fail loud như FreeDrawPlayer (issue #822): rơi về lối tô hình học thì
        // QA nhìn thấy đúng giao diện CŨ, không cách nào phân biệt "ảnh hỏng"
        // với "chưa deploy bản mới". Không chặn hiển thị — <img> vẫn tự vẽ.
        warnFallback(imageUrl, "không tải được ảnh để đọc pixel (CORS hoặc ảnh hỏng)");
        return;
      }
      if (cancelled) return;

      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      if (!nw || !nh) return;

      const scale = maskScale(nw, nh);
      const w = Math.max(1, Math.round(nw * scale));
      const h = Math.max(1, Math.round(nh * scale));

      let data: Uint8ClampedArray;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return; // môi trường không có canvas 2d (jsdom) — im lặng là đúng
        ctx.drawImage(img, 0, 0, w, h);
        data = ctx.getImageData(0, 0, w, h).data;
      } catch {
        warnFallback(imageUrl, "canvas bị taint — ảnh khác origin và thiếu CORS header");
        return;
      }
      if (cancelled) return;

      // Viền mảnh: `outlineMask` đóng dấu ô (2r+1) quanh mỗi pixel mép, nên r=1
      // ra dải ~3px — bằng đúng `border: 3px` của lối tô hình học cũ. Bám theo
      // hình vẽ thì viền dày đọc nặng hơn nhiều so với khi bám hình chữ nhật.
      const ring = Math.max(1, Math.round(Math.max(w, h) / 800));
      const byId: Record<string, InkRegionMask> = {};

      // Nhường luồng chính TRƯỚC khi dựng bản đồ. Dựng mặt nạ là việc đồng bộ:
      // riêng `buildRegionCanvas` là hai lượt gán nhãn trên cả bức ảnh, cỡ vài
      // chục ms, rồi mỗi vùng thêm vài ms nữa — chạy liền một mạch thì màn hình
      // đơ đúng lúc học sinh vừa mở câu hỏi. Cắt ra từng lát (bản đồ, rồi từng
      // vùng) giữ mỗi lát đủ ngắn, và phần tô vẫn hiện cùng một lúc vì
      // `setMasks` chỉ gọi một lần ở cuối.
      //
      // Lưu ý: `setTimeout` lồng nhau quá 5 tầng bị trình duyệt kẹp về ~4 ms,
      // nên cái giá phải trả là ~4 ms × số vùng — đổi lấy việc không có lát nào
      // chiếm luồng chính quá lâu.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (cancelled) return;

      // Bản đồ mảng dựng MỘT lần cho cả ảnh rồi dùng lại cho mọi vùng.
      const regionCanvas = buildRegionCanvas(data, w, h);

      for (const item of itemsRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelled) return;

        const bounds = normalizedBounds(item);
        if (!bounds) continue;

        const hit = normalizedHitTest(item);
        const found = maskForRegion(regionCanvas, (px, py) => hit((px + 0.5) / w, (py + 0.5) / h), bounds);
        if (!found) continue;
        const { box, mask } = found;
        byId[item.id] = { box, mask, outline: outlineMask(mask, box.w, box.h, ring) };
      }

      if (cancelled) return;
      if (Object.keys(byId).length === 0) {
        warnFallback(imageUrl, "không vùng nào bám được theo hình vẽ");
        return;
      }
      setMasks({ width: w, height: h, byId });
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, geometryKey, enabled]);

  return masks;
}

/** Canvas phủ khung ảnh, vẽ phần tô của từng vùng theo mặt nạ nét vẽ. */
export const InkRegionOverlay: React.FC<{ masks: InkMaskSet; layers: InkPaintLayer[] }> = ({
  masks,
  layers,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Một khung ImageData dùng lại cho mọi lượt vẽ. Cấp mới mỗi lần vẽ là ~2.6 MB
  // rác cho MỖI cú bấm; `fill(0)` rẻ hơn hẳn và giữ nguyên kết quả.
  const frameRef = useRef<ImageData | null>(null);

  // `layers` là mảng mới mỗi lần render; vẽ lại theo NỘI DUNG của nó, nếu không
  // mỗi nhịp render của player lại nuốt một lượt tô toàn khung ảnh.
  const layersKey = layers
    .map((l) => `${l.id}:${l.rgb.join(",")}:${l.alpha}:${l.ringRgb?.join(",") ?? ""}`)
    .join("|");
  const layersRef = useRef(layers);
  layersRef.current = layers;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, masks.width, masks.height);
    const current = layersRef.current;
    if (current.length === 0) return;

    let frame = frameRef.current;
    if (!frame || frame.width !== masks.width || frame.height !== masks.height) {
      frame = ctx.createImageData(masks.width, masks.height);
      frameRef.current = frame;
    } else {
      frame.data.fill(0);
    }
    const out = frame.data;

    for (const layer of current) {
      const entry = masks.byId[layer.id];
      if (!entry) continue;
      const { box, mask, outline } = entry;
      const [r, g, b] = layer.rgb;

      for (let y = 0; y < box.h; y++) {
        const maskRow = y * box.w;
        const frameRow = ((box.y + y) * masks.width + box.x) * 4;
        for (let x = 0; x < box.w; x++) {
          if (!mask[maskRow + x]) continue;
          const i = frameRow + x * 4;
          out[i] = r;
          out[i + 1] = g;
          out[i + 2] = b;
          out[i + 3] = layer.alpha;
        }
      }

      if (!layer.ringRgb) continue;
      const [rr, rg, rb] = layer.ringRgb;
      for (let y = 0; y < box.h; y++) {
        const maskRow = y * box.w;
        const frameRow = ((box.y + y) * masks.width + box.x) * 4;
        for (let x = 0; x < box.w; x++) {
          if (!outline[maskRow + x]) continue;
          const i = frameRow + x * 4;
          out[i] = rr;
          out[i + 1] = rg;
          out[i + 2] = rb;
          out[i + 3] = 255;
        }
      }
    }

    ctx.putImageData(frame, 0, 0);
  }, [masks, layersKey]);

  return (
    <canvas
      ref={canvasRef}
      width={masks.width}
      height={masks.height}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
};
