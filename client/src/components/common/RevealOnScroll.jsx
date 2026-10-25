import React, { useEffect, useRef, useState } from 'react';

/**
 * Reusable RevealOnScroll wrapper component using IntersectionObserver.
 * Triggers fade-in and slide-up once when element enters the viewport.
 */
export function RevealOnScroll({
  children,
  className = '',
  threshold = 0.1,
  delay = 0,
  stagger = false
}) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // If reduced motion is preferred or IntersectionObserver is unsupported, reveal immediately
    if (
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold]);

  const style = delay > 0 ? { animationDelay: `${delay}ms` } : undefined;

  return (
    <div
      ref={ref}
      style={style}
      className={`${className} ${
        revealed
          ? `animate-slide-up ${stagger ? 'opacity-100' : ''}`
          : 'opacity-0 translate-y-3'
      } transition-all duration-300 ease-out`}
    >
      {children}
    </div>
  );
}

export default RevealOnScroll;
