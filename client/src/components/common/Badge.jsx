import React from 'react';

export function Badge({ children, variant = 'slate', size = 'md', className = '' }) {
  const variants = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    teal: 'bg-teal-50 text-teal-700 border-teal-200/60',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/60',
    rose: 'bg-rose-50 text-rose-700 border-rose-200/60',
    blue: 'bg-sky-50 text-sky-700 border-sky-200/60',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/60'
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variants[variant] || variants.slate} ${sizes[size] || sizes.md} ${className}`}
    >
      {children}
    </span>
  );
}

export default Badge;
