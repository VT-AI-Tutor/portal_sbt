import "@/core/lib/pdfjs";

import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import { RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type LessonPdfViewerProps = {
  url: string;
  title: string;
  className?: string;
};

type PdfPageProps = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  containerWidth: number;
};

function PdfPage({ pdf, pageNumber, containerWidth }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (containerWidth <= 0) {
      return;
    }

    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    void (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) {
        return;
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext("2d");

      if (!context || cancelled) {
        return;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber, containerWidth]);

  return (
    <div className="lesson-pdf-page flex justify-center px-2 sm:px-0">
      <canvas
        ref={canvasRef}
        className="lesson-pdf-canvas block max-w-full h-auto bg-white shadow-sm"
      />
    </div>
  );
}

function getLoadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|networkerror|cors/i.test(message)) {
    return "Không thể tải PDF từ máy chủ tài liệu. Kiểm tra kết nối hoặc cấu hình CORS trên gateway media.";
  }
  return "Không thể hiển thị PDF bài học.";
}

export function LessonPdfViewer({ url, title, className = "" }: LessonPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(Math.max(0, Math.floor(element.clientWidth)));
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = getDocument({ url, withCredentials: false, disableRange: true, disableStream: true });

    setStatus("loading");
    setErrorMessage(null);
    setPdf(null);
    setPageCount(0);

    void loadingTask.promise
      .then((loaded) => {
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }
        setPdf(loaded);
        setPageCount(loaded.numPages);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(getLoadErrorMessage(error));
        }
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [url]);

  return (
    <div
      ref={containerRef}
      className={`lesson-pdf-viewer w-full min-w-0 max-w-full flex-1 min-h-0 h-full overflow-x-hidden overflow-y-auto bg-slate-100 ${className}`}
      role="document"
      aria-label={title}
    >
      {status === "loading" ? (
        <div className="flex h-full min-h-48 items-center justify-center text-muted-foreground">
          <RotateCw className="size-8 animate-spin text-primary" aria-hidden />
          <span className="sr-only">Đang tải PDF bài học...</span>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {errorMessage}
        </div>
      ) : null}

      {status === "ready" && pdf && containerWidth > 0 ? (
        <div className="flex flex-col gap-4 py-4">
          {Array.from({ length: pageCount }, (_, index) => (
            <PdfPage
              key={`${url}-${index + 1}-${containerWidth}`}
              pdf={pdf}
              pageNumber={index + 1}
              containerWidth={containerWidth}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
