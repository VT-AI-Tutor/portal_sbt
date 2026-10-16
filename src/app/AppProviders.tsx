import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Toaster } from '@/core/ui/sonner';
import { ConfirmProvider } from '@/core/ui/confirm';
import { SkinProvider, getDefaultSkin } from '@/core/exercise/skin';
import { SESSION_CLEARED_EVENT } from '@/core/auth/storage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  // Resolve the theme's default player skin at the app root (config.js is loaded
  // before this renders) so useSkin() is a pure useContext read; nested
  // <SkinProvider>s (e.g. the players demo) still override for their subtree.
  // getDefaultSkin() returns a module-constant skin, so no memo is needed —
  // the value reference is already stable across renders.
  const defaultSkin = getDefaultSkin();

  // Dữ liệu đã tải là của người vừa đăng xuất. Nghe sự kiện thay vì gọi ở từng
  // nút Đăng xuất — mọi đường kết thúc phiên đều đi qua clearSession.
  useEffect(() => {
    const clearCache = () => queryClient.clear();
    window.addEventListener(SESSION_CLEARED_EVENT, clearCache);
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, clearCache);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SkinProvider skin={defaultSkin}>
        <ConfirmProvider>{children}</ConfirmProvider>
      </SkinProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
