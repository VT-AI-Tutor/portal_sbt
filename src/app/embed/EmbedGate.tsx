import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useEmbedAuth } from "@/core/embed/useEmbedAuth";

/**
 * Gates an embed page on the native-injected auth session: spinner while
 * waiting for a token, an error notice if none ever arrives, otherwise the
 * chrome-less engine. See `useEmbedAuth` for the token sources.
 */
export function EmbedGate({ children }: { children: ReactNode }) {
  const status = useEmbedAuth();

  if (status === "waiting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <p className="max-w-xs text-sm font-semibold text-muted-foreground">
          Không thể xác thực phiên. Vui lòng mở lại bài học từ ứng dụng.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
