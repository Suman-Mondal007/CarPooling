import React from 'react';

export function Skeleton({ className = '', variant = 'text' }) {
  const variants = {
    text: 'h-4 w-full rounded-md',
    circle: 'rounded-full',
    rect: 'rounded-xl',
    card: 'h-48 w-full rounded-2xl'
  };

  return (
    <div
      className={`animate-shimmer ${variants[variant] || variants.text} ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
      <div className="flex items-center space-x-3">
        <Skeleton variant="circle" className="w-10 h-10" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="w-1/3" />
          <Skeleton className="w-1/4" />
        </div>
      </div>
      <Skeleton className="w-full h-16" variant="rect" />
      <div className="flex justify-between pt-2">
        <Skeleton className="w-20" />
        <Skeleton className="w-24" />
      </div>
    </div>
  );
}

export function SkeletonTableRows({ rows = 4, cols = 4 }) {
  return (
    <div className="space-y-3 w-full" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={rIdx}
          className="flex items-center space-x-4 p-3 bg-white rounded-xl border border-slate-100"
        >
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton
              key={cIdx}
              className={`h-4 ${cIdx === 0 ? 'w-1/4' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
