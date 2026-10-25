import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Lightweight global top progress bar for route transitions.
 */
export function TopProgressBar() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start progress
    setVisible(true);
    setProgress(35);

    const timer1 = setTimeout(() => {
      setProgress(85);
    }, 80);

    const timer2 = setTimeout(() => {
      setProgress(100);
    }, 180);

    const timer3 = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 320);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[2.5px] z-50 pointer-events-none bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400 shadow-sm transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: 'width 200ms ease-out, opacity 120ms ease-in'
        }}
      />
    </div>
  );
}

export default TopProgressBar;
