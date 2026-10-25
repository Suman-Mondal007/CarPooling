import React from 'react';

export function Card({
  children,
  className = '',
  hover = false,
  selected = false,
  onClick,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border transition-all duration-200 ${
        selected
          ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-md'
          : 'border-slate-200/80 shadow-xs'
      } ${
        hover
          ? 'hover:shadow-md hover:border-teal-200 hover:-translate-y-0.5 cursor-pointer active:scale-[0.99]'
          : ''
      } p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div
      className={`flex items-start justify-between pb-4 mb-4 border-b border-slate-100 ${className}`}
    >
      <div>
        {title && (
          <h3 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h3>
        )}
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export default Card;
