import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackGoogleTagPageView } from '@/core/analytics/googleTag';

/** Sends SPA route changes to Google Tag (gtag.js). */
export function GoogleTagPageTracker() {
  const location = useLocation();

  useEffect(() => {
    trackGoogleTagPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}
