import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Automatically scrolls window to top on route change.
 * Safe against environments lacking full Window.scrollTo support (e.g. jsdom).
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: 'instant'
        });
      } catch {
        // Fallback for older browsers or test environments
        try {
          window.scrollTo(0, 0);
        } catch {
          // ignore
        }
      }
    }
  }, [pathname]);

  return null;
}

export default ScrollToTop;
