import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import '@/styles.css';
import { Bootstrap } from '@/app/bootstrap';
import { initGoogleTag } from '@/core/analytics/googleTag';
import { AuthProvider } from '@/core/auth/AuthContext';
import { applyBrand } from '@/core/brand/brand';
import { applyTheme } from '@/core/theme/theme';
import { preloadDigitizedManifests } from '@/modules/digitized-content/api/loader';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
// Covers the build-time VITE_THEME channel; the index.html inline script
// already applies the runtime THEME before first paint (no-FOUC).
applyTheme();
// Covers the build-time VITE_BRAND channel; runtime BRAND (title + favicon)
// is applied by the index.html inline script before first paint.
applyBrand();
initGoogleTag();
// Preload manifest của nội dung tự số hóa (file nhỏ ~2KB/sách) để
// BookDetailPage / AdvancedBookSection tra được ngay khi render. Content.json
// lớn hơn nên fetch lazy khi vào bài.
preloadDigitizedManifests();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID ?? ''}>
      <AuthProvider>
        <Bootstrap />
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
