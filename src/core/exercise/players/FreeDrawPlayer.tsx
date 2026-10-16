/**
 * P37 — Free draw / "draw" (annotate, record-only).
 * schema: drawing · interactionType: "draw"
 *
 * A dependency-free Canvas 2D sketchpad: mouse + touch drawing with one fixed
 * pen (single color, single width), an eraser, and a clear button.
 * Optional background image is drawn underneath. There is no grading — the
 * canvas is recorded as a dataURL through report(dataUrl, "incomplete") at the
 * end of EVERY stroke (chống mất bài khi chuyển câu), nhưng nhãn "Đã ghi nhận"
 * chỉ hiện khi học sinh bấm nút xác nhận.
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Eraser, Pencil, Trash2 } from "lucide-react";
import { PlayerShell, PlayerTextValue, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";
import { loadImageViaBlob } from "@/core/content/loadImage";
import { HideResultBanner, RECORDED_TEXT, SUBMIT_TEXT } from "./recorded-receipt";

/**
 * web-own: SBT khoá đúng MỘT cây bút — bỏ bảng chọn màu và bảng chọn cỡ nét.
 *
 * Cỡ nét giữ nguyên mặc định cũ (8) nên bề dày nét không đổi; màu chuyển sang
 * xanh lá. Toolbar chỉ còn ba nút (bút · tẩy · xoá) nên bỏ luôn biến thể 4 cột
 * cho màn thấp — ba nút xếp một cột đã thấp hơn khung vẽ.
 */
const PEN_COLOR = "#22c55e";
const PEN_SIZE = 8;

function fitRect(canvas: HTMLCanvasElement, img: HTMLImageElement) {
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  return { x: (canvas.width - width) / 2, y: (canvas.height - height) / 2, width, height };
}

type DrawingTool = "pen" | "eraser";

const TOOL_OPTIONS = [
  { value: "pen", label: "Bút", Icon: Pencil },
  { value: "eraser", label: "Tẩy", Icon: Eraser },
] as const satisfies ReadonlyArray<{ value: DrawingTool; label: string; Icon: typeof Pencil }>;

/** A labeled writing frame drawn above the canvas (worksheet-style ruled lines). */
export interface FreeDrawTextField {
  /** Inline rich-text label shown above the ruled lines. */
  label: string;
  /** Number of ruled writing lines (defaults to 2). */
  lines?: number;
}

export interface FreeDrawPlayerProps extends PlayerProps {
  backgroundImage?: string;
  /** Bảng màu tác giả khai — không còn dùng: SBT khoá một màu bút duy nhất. */
  colors?: string[];
  /** Source drawing ratio. Legacy payloads omit it and keep the 800×560 canvas. */
  aspectRatio?: number | string;
  /**
   * Explicit canvas height (px) for blank mode. Only applied when no valid
   * `aspectRatio` drives the height, so image/outline questions are unaffected.
   */
  canvasHeight?: number | string;
  /** Inline rich-text caption rendered above the drawing stage. */
  canvasLabel?: string;
  /** Labeled ruled writing frames rendered above the canvas. */
  textFields?: FreeDrawTextField[];
  prompt?: string;
}

export const FreeDrawPlayer: React.FC<FreeDrawPlayerProps> = ({
  backgroundImage,
  colors: _ignoredColors,
  aspectRatio,
  canvasHeight: canvasHeightProp,
  canvasLabel,
  textFields,
  prompt,
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  instantFeedback = true,
  ...shell
}) => {
  const skin = useSkin();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<DrawingTool>("pen");
  // Khôi phục: `answer` là dataURL PNG do chính player ghi (toDataURL cả canvas
  // — nền trắng + backgroundImage đã "nướng" sẵn trong ảnh). Chỉ giữ ảnh chụp
  // tại thời điểm MOUNT: cha echo answer lại sau mỗi nét vẽ, mà vẽ đè bản chụp
  // async lên canvas đang vẽ dở sẽ phá nét.
  // `answerDataUrl` tính lại MỖI render; bản chụp tại mount là `restoredAnswerRef`.
  const answerDataUrl =
    typeof answer === "string" && answer.startsWith("data:image") ? answer : null;
  const restoredAnswerRef = useRef<string | null>(answerDataUrl);
  /**
   * web-own: "Đã ghi nhận ✓" là lời của HỌC SINH ("em vẽ xong"), không phải của
   * máy ("đã lưu"). Trước đây một biến gánh cả hai: `recordCanvas` chạy cuối MỖI
   * nét nên nhãn bật ngay từ nét đầu tiên — lớp 3 tưởng xong bài và bỏ dở hình
   * (bảng ghi nhận lỗi NXB, Toán 3 tập 1: bài 17 "bánh xe", 18, 20, 22).
   *
   * Giờ auto-record chạy LẶNG LẼ, chỉ nút xác nhận mới bật nhãn.
   *
   * Khôi phục (mount đã có ảnh cũ): KHÔNG bật nhãn. Cờ này không có chỗ sống
   * trong đáp án — đáp án chỉ là chuỗi dataURL — nên không phân biệt được "lần
   * trước vẽ dở" với "lần trước đã bấm xong". Bật theo ảnh cũ là dựng lại đúng
   * lỗi NXB báo: vẽ nửa bánh xe, sang câu 2 rồi quay lại là thấy "Đã ghi nhận".
   * Đổi lại, học sinh đã bấm xong mà quay lại thì mất nhãn — chấp nhận được:
   * chấm điều hướng phía trên vẫn tô "đã làm", và bấm lại nút là có nhãn.
   */
  const [confirmed, setConfirmed] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const activeTool = useRef<DrawingTool>("pen");
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const [backgroundError, setBackgroundError] = useState(false);
  const { report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const locked = submitted;
  const isEraser = tool === "eraser";
  const parsedRatio = Number(aspectRatio);
  const explicitHeight = Number(canvasHeightProp);
  const canvasWidth = 800;
  const canvasHeight = Number.isFinite(parsedRatio) && parsedRatio > 0
    ? Math.max(1, Math.round(canvasWidth / parsedRatio))
    : Number.isFinite(explicitHeight) && explicitHeight > 0
      ? Math.max(1, Math.round(explicitHeight))
      : 560;
  const writingFrames = (textFields ?? []).filter((tf) => tf && (tf.label || tf.lines));

  const drawBackgroundImage = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const img = bgImageRef.current;
    if (!img) return;
    const { x, y, width, height } = fitRect(canvas, img);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img, x, y, width, height);
  }, []);

  const paintBackground = useCallback(
    (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawBackgroundImage(ctx, canvas);
    },
    [drawBackgroundImage],
  );

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const restored = restoredAnswerRef.current;
    if (restored) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      };
      img.src = restored;
      return;
    }
    paintBackground(ctx, canvas);
  }, [paintBackground]);

  useEffect(() => {
    bgImageRef.current = null;
    setBackgroundError(false);
    repaint();
    if (!backgroundImage) return;
    let cancelled = false;
    (async () => {
      let img: HTMLImageElement;
      try {
        img = await loadImageViaBlob(backgroundImage);
      } catch {
        // Fail loud: a canvas that should carry an outline but silently renders
        // white is indistinguishable from a question with no background at all,
        // so QA cannot tell a broken asset from authored intent (issue #822).
        if (!cancelled) setBackgroundError(true);
        return;
      }
      if (cancelled) return;
      bgImageRef.current = img;
      if (restoredAnswerRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) drawBackgroundImage(ctx, canvas);
    })();
    return () => {
      cancelled = true;
    };
  }, [backgroundImage, repaint, drawBackgroundImage]);

  // Chỉ repaint khi canvasHeight THẬT SỰ đổi (đúng ý định 0aff8694). Bản cũ
  // deps [repaint, canvasHeight] còn chạy cả lúc mount và khi repaint đổi
  // identity — chồng lên effect nền (cũng gọi repaint lúc mount) làm ảnh
  // restore bị drawImage ĐÚP. repaint đọc qua ref để không vào deps.
  const repaintRef = useRef(repaint);
  repaintRef.current = repaint;
  const prevCanvasHeightRef = useRef(canvasHeight);
  useEffect(() => {
    if (prevCanvasHeightRef.current === canvasHeight) return;
    prevCanvasHeightRef.current = canvasHeight;
    repaintRef.current();
  }, [canvasHeight]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const applyStrokeStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = PEN_COLOR;
    ctx.lineWidth = PEN_SIZE;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const eraseStroke = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = PEN_SIZE * 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.globalCompositeOperation = "destination-over";
    const img = bgImageRef.current;
    if (img) {
      const { x, y, width, height } = fitRect(canvas, img);
      ctx.drawImage(img, x, y, width, height);
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
  };

  /** Lưu canvas lên cha. `false` = không chụp được (canvas nhiễm / chưa mount). */
  const recordCanvas = useCallback((): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    try {
      report(canvas.toDataURL("image/png"), "incomplete");
      return true;
    } catch {
      return false;
    }
  }, [report]);

  /**
   * Học sinh báo đã vẽ xong: chụp lần cuối RỒI mới bật nhãn — chụp hỏng
   * (toDataURL ném vì canvas nhiễm) thì đừng hứa "đã ghi nhận" cho một bài
   * không có gì lưu được.
   */
  const confirmDone = useCallback(() => {
    if (recordCanvas()) setConfirmed(true);
  }, [recordCanvas]);

  /**
   * ĐÃ NỘP (`submitted`) thì ảnh cũ chắc chắn là bài đã nộp, không còn cửa hiểu
   * nhầm "đang vẽ dở" — canvas khoá rồi. Màn xem lại bài và màn kết quả (runner
   * truyền `submitted={graded}`) sống bằng nhánh này: không có nó thì câu vẽ
   * hiện trống trơn, mất luôn dòng xác nhận mà bản trước vẫn in.
   */
  const showRecorded = confirmed || (locked && answerDataUrl !== null);

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    // Chặn ngay khi canvas không cấp được context 2D: vào trạng thái đang vẽ mà
    // không nét nào ra được thì chỉ tổ nuốt pointer capture.
    if (!canvas.getContext("2d")) return;

    const pos = getPos(e, canvas);
    activeTool.current = tool;
    lastPos.current = pos;
    setIsDrawing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || locked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getPos(e, canvas);
    const drawingTool = activeTool.current;
    const prev = lastPos.current ?? pos;

    if (drawingTool === "eraser") {
      eraseStroke(ctx, canvas, prev, pos);
    } else {
      applyStrokeStyle(ctx);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    lastPos.current = pos;
  };

  const resetDrawingRefs = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    resetDrawingRefs();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    // Record on first stroke completion (and keep it fresh on later strokes).
    // Vẽ thêm sau khi đã xác nhận thì GIỮ nhãn (khác đường xoá ở clearCanvas):
    // đáp án lưu luôn là ảnh mới nhất nên "đã ghi nhận" vẫn đúng.
    recordCanvas();
  };

  const cancelDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    resetDrawingRefs();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const clearCanvas = () => {
    if (locked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintBackground(ctx, canvas);
    // Xoá sạch khung vẽ thì lời "em vẽ xong" cũ không còn đúng với thứ đang
    // nằm trên màn hình nữa.
    setConfirmed(false);
    // …và đáp án đang giữ ở cha cũng vậy. Không chụp lại thì cái được nộp vẫn
    // là ảnh TRƯỚC khi xoá: bấm 🗑 để vẽ lại rồi bị gọi sang câu khác là nộp
    // đúng hình vừa bỏ đi, mà giờ không còn nhãn nào gợn lên rằng có gì đã lưu.
    //
    // Trừ canvas nhiễm (issue #695): chụp hỏng thì cha VẪN giữ ảnh trước khi
    // xoá, ở đây không có gì thay được nó nên `recordCanvas` trả false và ta
    // bỏ qua — nhãn đã gỡ rồi, đó là tất cả những gì làm được trên nhánh đó.
    recordCanvas();
  };

  const cursorD = Math.max(8, isEraser ? PEN_SIZE * 3 : PEN_SIZE * 2);
  const cursorR = cursorD / 2;
  const cursorC = isEraser ? "#d946ef" : PEN_COLOR;
  const cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cursorD}" height="${cursorD}" viewBox="0 0 ${cursorD} ${cursorD}"><circle cx="${cursorR}" cy="${cursorR}" r="${cursorR - 1.5}" fill="${cursorC}" fill-opacity="0.25" stroke="${cursorC}" stroke-width="1.5"/></svg>`;
  const canvasCursor = `url("data:image/svg+xml,${encodeURIComponent(cursorSvg)}") ${cursorR} ${cursorR}, crosshair`;
  const canvasCursorStyle = locked ? "default" : canvasCursor;

  return (
    <HideResultBanner>
    <PlayerShell {...shell} submitted={submitted}>
      {prompt && (
        <div className={`p-3 md:p-4 mb-4 text-base md:text-lg italic ${skin.panel?.("card") ?? "bg-white/70 rounded-2xl border-4 border-white"} ${skin.emphasis?.("neutral", "medium") ?? "text-slate-800 font-bold"}`}>
          {prompt}
        </div>
      )}

      {writingFrames.length > 0 && (
        <div className={`p-3 md:p-4 mb-4 flex flex-col gap-4 ${skin.panel?.("card") ?? "bg-white/70 rounded-2xl border-4 border-white"}`}>
          {writingFrames.map((tf, i) => {
            const lineCount = Number.isFinite(Number(tf.lines)) && Number(tf.lines) > 0 ? Math.round(Number(tf.lines)) : 2;
            return (
              <div key={i} className="flex flex-col gap-2">
                {tf.label && (
                  <PlayerTextValue
                    value={tf.label}
                    className={`text-base md:text-lg ${skin.emphasis?.("neutral", "medium") ?? "text-slate-800 font-bold"}`}
                  />
                )}
                <div className="flex flex-col gap-3">
                  {Array.from({ length: lineCount }).map((_, li) => (
                    <div
                      key={li}
                      className={`h-7 border-b-2 border-dashed ${skin.accent?.("neutral", "softFill") ?? "border-muted-foreground/40"}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-2 md:gap-4">
        {/* Toolbar — horizontal on mobile, vertical on desktop */}
        <div className={`flex flex-row md:flex-col gap-2 md:gap-3 items-center p-2 md:p-3 shrink-0 overflow-x-auto md:overflow-x-visible ${skin.panel?.("tray") ?? "bg-white/70 backdrop-blur rounded-[16px] md:rounded-[24px] border-4 border-white shadow-xl"}`}>
          {/* Chỉ còn bút · tẩy · xoá: hàng ngang trên mobile, cột dọc trên desktop. */}
          <div data-testid="freedraw-tools" className="flex flex-row md:flex-col gap-1 md:gap-1.5 shrink-0">
            {TOOL_OPTIONS.map(({ value, label, Icon }) => {
              const selected = tool === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={selected}
                  title={label}
                  onClick={() => setTool(value)}
                  className={`${
                    skin.chip?.(selected ? "selected" : "idle", "primary") ??
                    `w-8 h-8 md:w-9 md:h-9 rounded-xl border-4 ${
                      selected ? "border-fuchsia-400 bg-fuchsia-50 " : "border-white bg-white hover:bg-slate-100"
                    }`
                  } flex items-center justify-center transition-all`}
                >
                  <Icon size={14} className={selected ? (skin.emphasis?.("primary", "strong") ?? "text-fuchsia-500") : (skin.emphasis?.("neutral", "soft") ?? "text-slate-500")} />
                </button>
              );
            })}
            <button
              type="button"
              aria-label="Xóa bản vẽ"
              title="Xóa bản vẽ"
              onClick={clearCanvas}
              // Cỡ nút chỉ nằm trong nhánh KHÔNG có skin, hệt hai nút bút/tẩy ở
              // trên: có skin thì `chip` quyết cả hộp lẫn padding. Nối cứng
              // `w-9` vào trước class của skin là padding của skin ăn hết bề
              // ngang và icon thùng rác bị bóp về 0 — nút hiện ra rỗng trơn.
              className={`${
                skin.chip?.("idle", "danger") ??
                "w-8 h-8 md:w-9 md:h-9 rounded-xl border-4 border-white bg-white hover:bg-red-50"
              } flex items-center justify-center transition-all`}
            >
              <Trash2 size={14} className={skin.emphasis?.("danger", "strong") ?? "text-red-400"} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        {/* KHÔNG `md:self-start` (Owner 8/8): self-start làm cột vẽ co đúng
            chiều cao canvas, nên khung vẽ tỉ lệ ngang (canvas thấp) đứng cạnh
            toolbar dọc để hở một mảng trống to. Bỏ đi là cột nhận `stretch`
            mặc định của hàng flex → chiều cao khu vẽ TỐI THIỂU bằng toolbar,
            canvas cao hơn thì hàng cao theo canvas như cũ. */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {canvasLabel && (
            <PlayerTextValue
              value={canvasLabel}
              className={`text-sm md:text-base text-center ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-semibold"}`}
            />
          )}
          {/* `flex-1` để tấm giấy trắng ăn hết chiều cao cột (phần dư sau nhãn);
              canvas giữ nguyên tỉ lệ tác giả khai, căn giữa trong tấm giấy. */}
          <div className={`shadow-2xl overflow-hidden flex flex-1 items-center justify-center min-h-0 ${skin.panel?.("media") ?? "bg-white rounded-[16px] md:rounded-[24px] border-4 border-white"}`}>
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerCancel={cancelDraw}
              // TRẦN CAO theo màn hình (Owner 8/8): canvas là phần tử replaced
              // có tỉ lệ nội tại nên `max-h` cùng `max-w-full` vẫn co ĐÚNG TỈ
              // LỆ (CSS 2.1 §10.4) — không méo. Không có trần thì câu vẽ khổ
              // dọc/vuông phóng theo bề rộng cột (cột rộng ~1500px là canvas
              // cao hơn cả màn) và đẩy nút xác nhận ra ngoài tầm nhìn.
              // 24rem = ngân sách chrome quanh khung vẽ, ĐO trên bài thật
              // (runner 544px ở màn 720): điều hướng bài + thanh dưới (~176) +
              // padding shell (~40) + đề bài (~96) + hàng nút xác nhận (~80).
              // Sàn 12rem để màn rất thấp vẫn còn chỗ vẽ.
              className="block h-auto max-w-full max-h-[max(12rem,calc(100svh-24rem))] touch-none"
              style={{ cursor: canvasCursorStyle }}
            />
            {backgroundError && (
              <div
                data-testid="freedraw-background-error"
                role="status"
                className="absolute inset-x-0 top-0 m-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs md:text-sm text-red-700"
              >
                Không tải được ảnh nền của khung vẽ. Canvas đang trống — hãy kiểm tra lại
                đường dẫn ảnh trong câu hỏi.
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {!locked || showRecorded ? (
      <div className="flex items-center justify-center gap-4 mt-4">
        {/* web-own: nút "Nộp câu trả lời" là cách duy nhất để học sinh nói "vẽ xong" —
            auto-record mà tự bật nhãn thì lớp 3 bỏ dở hình (NXB, Toán 3/1 bài 17).
            Bấm xong dòng ghi nhận thay chỗ nút (SBT-61); 🗑 gỡ dòng, trả nút về.
            Hàng nút đã có chỗ trong ngân sách 24rem của canvas. */}
        {!locked && !confirmed && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={confirmDone}
            className={
              skin.actionButton?.(true, "primary") ??
              "px-8 py-3 rounded-full border-4 border-fuchsia-500 bg-fuchsia-400 text-white font-black text-lg shadow-lg"
            }
          >
            {SUBMIT_TEXT}
          </motion.button>
        )}
        {showRecorded && (
          <span role="status" className={`text-lg ${skin.feedback?.("success") ?? "text-green-600 font-black"}`}>{RECORDED_TEXT}</span>
        )}
      </div>
      ) : null}
    </PlayerShell>
    </HideResultBanner>
  );
};
