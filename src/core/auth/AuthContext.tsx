import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import * as authApi from "@/core/auth/api";
import type { UpdateProfilePayload } from "@/core/auth/api";
import {
  clearSession,
  computeRefreshDelay,
  getStoredSession,
  isAccessTokenValid,
  saveSession,
  SESSION_EXPIRED_EVENT,
  type AuthScope,
} from "@/core/auth/storage";
import type { AuthMeResponse, AuthUser } from "@/core/auth/types";

interface AuthContextValue {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<AuthUser | null>;
  loginWithGoogle: (credential: string) => Promise<AuthUser | null>;
  /** True when Google sign-in is the LCMS full-page redirect flow. */
  usesGoogleRedirectLogin: boolean;
  /** Kicks off the LCMS Google redirect flow (navigates away from the app). */
  beginGoogleLoginRedirect: (returnTo?: string) => Promise<void>;
  /** Adopts the tokens from the /google/authen redirect as the session. */
  completeGoogleLoginRedirect: (
    params: authApi.GoogleRedirectCallbackParams,
  ) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// GAP-001 / PRACT-R26 (V19 bước 3): phiên hết hạn không được "mất im lặng" — báo rõ và
// trấn an rằng bài làm dở vẫn còn (lưu tạm cục bộ PRACT-R26 đảm nhiệm phần giữ bài).
// id cố định để các nhánh cùng phát hiện hết phiên không chồng nhiều toast.
function notifySessionExpired() {
  toast.error(
    "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại — bài làm đang dở vẫn được giữ trên thiết bị.",
    { id: "session-expired" },
  );
}

export function AuthProvider({
  children,
  scope = "user",
}: {
  children: ReactNode;
  scope?: AuthScope;
}) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // GAP-001 / IDENT-R15 / PRACT-R26: tự gia hạn token TRƯỚC hạn để phiên không đứt giữa
  // chừng khi đang học. Bổ trợ cho lớp phản ứng 401 của provider LCMS; ở đây là chủ động,
  // dùng chung cho cả provider native lẫn LCMS (đều đi qua authApi.refresh).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefreshRef = useRef<() => void>(() => {});

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current !== null) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const endSessionLocally = useCallback(() => {
    clearRefreshTimer();
    notifySessionExpired();
    clearSession(scope);
    setAccessToken(null);
    setUser(null);
  }, [clearRefreshTimer, scope]);

  const scheduleRefresh = useCallback(() => {
    clearRefreshTimer();
    const { refreshToken, expiresAt } = getStoredSession(scope);
    if (expiresAt === null) {
      return;
    }
    if (!refreshToken) {
      // Không gia hạn được thì vẫn phải đóng phiên đúng lúc hết hạn.
      refreshTimer.current = setTimeout(
        endSessionLocally,
        Math.max(0, expiresAt - Date.now()),
      );
      return;
    }
    const delay = computeRefreshDelay(expiresAt, Date.now());
    if (delay === null) {
      return;
    }
    refreshTimer.current = setTimeout(() => {
      void (async () => {
        const stored = getStoredSession(scope);
        if (!stored.refreshToken) {
          return;
        }
        try {
          const tokens = await authApi.refresh(stored.refreshToken);
          saveSession(tokens, scope);
          setAccessToken(tokens.access_token);
          scheduleRefreshRef.current();
        } catch {
          // Gia hạn thất bại → phiên đã hết hiệu lực, dọn phiên cục bộ.
          endSessionLocally();
        }
      })();
    }, delay);
  }, [clearRefreshTimer, endSessionLocally, scope]);

  useEffect(() => {
    scheduleRefreshRef.current = scheduleRefresh;
  }, [scheduleRefresh]);

  // Dọn timer khi unmount.
  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  const applyMe = useCallback(
    async (token: string): Promise<AuthUser | null> => {
      try {
        const me: AuthMeResponse = await authApi.fetchMe(token);
        // `admin_scope` nằm cạnh `user` trong phản hồi chứ không nằm trong nó —
        // gộp vào hồ sơ để mọi cổng gác đọc từ MỘT chỗ. Không có thì để trống,
        // các cổng tự lùi về `roles` cho phiên cũ.
        const nextUser = me.user
          ? { ...me.user, ...(me.admin_scope ? { admin_scope: me.admin_scope } : {}) }
          : null;
        setUser(nextUser);
        return nextUser;
      } catch (e) {
        setUser(null);
        // GAP-008: 401 = token không còn hiệu lực → dọn phiên thật, đừng ôm token chết. Lỗi
        // mạng tạm thời (status 0) hay lỗi máy chủ thì GIỮ token: người dùng chỉ mất mạng chốc
        // lát, đá họ ra là sai. Dù trường hợp nào cũng KHÔNG coi là "đã đăng nhập" khi chưa có
        // hồ sơ (xem isAuthenticated) — nếu không shell sẽ hiện tên giả "Học sinh"/"Giáo viên".
        if (e instanceof authApi.AuthApiError && e.status === 401) {
          notifySessionExpired();
          clearSession(scope);
          setAccessToken(null);
        }

        return null;
      }
    },
    [scope],
  );

  const restoreSession = useCallback(async () => {
    const stored = getStoredSession(scope);

    if (!stored.accessToken) {
      setAccessToken(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    if (isAccessTokenValid(stored.expiresAt)) {
      setAccessToken(stored.accessToken);
      await applyMe(stored.accessToken);
      scheduleRefresh();
      setIsLoading(false);
      return;
    }

    if (stored.refreshToken) {
      try {
        const tokens = await authApi.refresh(stored.refreshToken);
        saveSession(tokens, scope);
        setAccessToken(tokens.access_token);
        await applyMe(tokens.access_token);
        scheduleRefresh();
        setIsLoading(false);
        return;
      } catch {
        notifySessionExpired();
        clearSession(scope);
      }
    }

    setAccessToken(null);
    setUser(null);
    setIsLoading(false);
  }, [applyMe, scope, scheduleRefresh]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  // Nghe tín hiệu hết phiên từ lớp fetch 401 để dọn state React ngay → cổng gác
  // chuyển về đăng nhập không cần F5 (line 49).
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, endSessionLocally);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, endSessionLocally);
  }, [endSessionLocally]);

  // Hai đường sẵn có đều có thể không chạy: không request nào ⇒ không có 401;
  // tab nền/máy ngủ ⇒ hẹn giờ gia hạn trễ. Nên soi lại hạn khi tab quay lại.
  useEffect(() => {
    if (!accessToken) return;
    let checking = false;
    const recheck = () => {
      if (document.visibilityState === "hidden" || checking) return;
      const stored = getStoredSession(scope);
      if (isAccessTokenValid(stored.expiresAt)) return;
      if (!stored.refreshToken) {
        endSessionLocally();
        return;
      }
      checking = true;
      void authApi
        .refresh(stored.refreshToken)
        .then((tokens) => {
          saveSession(tokens, scope);
          setAccessToken(tokens.access_token);
          scheduleRefreshRef.current();
        })
        .catch(endSessionLocally)
        .finally(() => {
          checking = false;
        });
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [accessToken, endSessionLocally, scope]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const tokens = await authApi.login(identifier, password);
      saveSession(tokens, scope);
      setAccessToken(tokens.access_token);
      scheduleRefresh();
      return applyMe(tokens.access_token);
    },
    [applyMe, scope, scheduleRefresh],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const tokens = await authApi.googleLogin(credential);
      saveSession(tokens, scope);
      setAccessToken(tokens.access_token);
      scheduleRefresh();
      return applyMe(tokens.access_token);
    },
    [applyMe, scope, scheduleRefresh],
  );

  const completeGoogleLoginRedirect = useCallback(
    async (params: authApi.GoogleRedirectCallbackParams) => {
      const tokens = authApi.completeGoogleLoginRedirect(params);
      saveSession(tokens, scope);
      setAccessToken(tokens.access_token);
      return applyMe(tokens.access_token);
    },
    [applyMe, scope],
  );

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      const token = accessToken ?? getStoredSession(scope).accessToken;
      if (!token) throw new Error("Not authenticated");
      const res = await authApi.updateProfile(token, payload);
      setUser(res.user ?? null);
    },
    [accessToken, scope],
  );

  const logout = useCallback(async () => {
    clearRefreshTimer();
    const token = accessToken ?? getStoredSession(scope).accessToken;
    if (token) {
      try {
        await authApi.logout(token);
      } catch {
        // Clear local session even if server logout fails.
      }
    }
    clearSession(scope);
    setAccessToken(null);
    setUser(null);
  }, [accessToken, clearRefreshTimer, scope]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      user,
      // GAP-008: phải có CẢ token lẫn hồ sơ mới coi là đã đăng nhập. Trước đây chỉ xét token
      // nên khi tải hồ sơ hỏng (user=null) app vẫn cho vào và shell hiện tên giả
      // ("Học sinh"/"Giáo viên") — người dùng tưởng đang đăng nhập bằng tài khoản nào đó.
      isAuthenticated: accessToken !== null && user !== null,
      isLoading,
      login,
      loginWithGoogle,
      usesGoogleRedirectLogin: authApi.usesGoogleRedirectLogin(),
      beginGoogleLoginRedirect: authApi.beginGoogleLoginRedirect,
      completeGoogleLoginRedirect,
      logout,
      updateProfile,
    }),
    [
      accessToken,
      user,
      isLoading,
      login,
      loginWithGoogle,
      completeGoogleLoginRedirect,
      logout,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

/** Access token for authenticated API calls (e.g. catalog PDF URL). */
export function useAccessToken(): string | null {
  return useAuth().accessToken;
}
