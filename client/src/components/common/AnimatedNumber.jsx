import React, { useEffect, useState } from 'react';

/**
 * AnimatedNumber component that performs a smooth count-up animation
 * on first mount or value change. Respects prefers-reduced-motion and
 * always concludes at the exact formatted value.
 */
export function AnimatedNumber({
  value = 0,
  duration = 450,
  formatter = (val) => val.toLocaleString('en-IN'),
  className = ''
}) {
  const numericTarget = typeof value === 'number' ? value : parseFloat(value) || 0;
  const [displayValue, setDisplayValue] = useState(() => {
    // Check reduced motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return numericTarget;
    }
    return 0;
  });

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayValue(numericTarget);
      return;
    }

    let startTimestamp = null;
    let animationFrameId = null;
    const startVal = 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic curve: 1 - (1 - progress)^3
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (numericTarget - startVal) * easeOutProgress;

      if (progress < 1) {
        setDisplayValue(Math.floor(current));
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(numericTarget);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [numericTarget, duration]);

  return <span className={className}>{formatter(displayValue)}</span>;
}

export default AnimatedNumber;
