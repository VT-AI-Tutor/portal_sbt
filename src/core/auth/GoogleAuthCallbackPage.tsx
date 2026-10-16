import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { consumeGoogleLoginReturnTo } from "@/core/auth/api";
import { useAuth } from "@/core/auth/AuthContext";

/**
 * Landing route for the LCMS Google redirect flow (/google/authen).
 * LCMS appends accessToken/refreshToken/sessionId/newUser to the query
 * string after the user finishes Google consent; this page adopts them as
 * the session and returns the user to where they started the login.
 */
export function GoogleAuthCallbackPage() {
  const { completeGoogleLoginRedirect } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return; // StrictMode re-runs the effect
    startedRef.current = true;

    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    const sessionId = searchParams.get("sessionId");
    const newUser = searchParams.get("newUser") === "true";

    // Scrub the tokens from the URL immediately so they don't linger in browser
    // history or leak via the Referer header (Fortify: Privacy Violation). The
    // embed flow does the same; keep the path, drop the query.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (!accessToken || !refreshToken) {
      setError("Thiếu thông tin đăng nhập từ Google. Vui lòng thử lại.");
      return;
    }

    void (async () => {
      try {
        await completeGoogleLoginRedirect({
          accessToken,
          refreshToken,
          sessionId,
        });
        if (newUser) {
          toast.success("Chào mừng bạn! Tài khoản của bạn đã được tạo.");
        }
        navigate(consumeGoogleLoginReturnTo() ?? "/", { replace: true });
      } catch {
        setError("Đăng nhập Google thất bại.");
      }
    })();
  }, [completeGoogleLoginRedirect, navigate, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-foreground">
              Đăng nhập Google thất bại
            </h1>
            <p className="mt-2 text-sm text-destructive" role="alert">
              {error}
            </p>
            <a
              href="/"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Về trang chủ
            </a>
          </>
        ) : (
          <>
            <div
              className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
              aria-hidden
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Đang hoàn tất đăng nhập Google…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
