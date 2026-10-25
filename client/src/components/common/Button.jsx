import React from 'react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled = false,
  onClick,
  className = '',
  icon: Icon,
  ...props
}) {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 select-none active:scale-[0.97] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none';

  const variants = {
    primary:
      'bg-teal-600 hover:bg-teal-700 text-white shadow-sm hover:shadow-md focus-visible:ring-teal-500',
    secondary:
      'bg-slate-800 hover:bg-slate-900 text-white shadow-sm hover:shadow-md focus-visible:ring-slate-700',
    outline:
      'border border-slate-300 hover:border-slate-400 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-xs focus-visible:ring-teal-500',
    ghost:
      'text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:translate-y-0 active:scale-95 focus-visible:ring-slate-400',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow-md focus-visible:ring-rose-500',
    subtle:
      'bg-teal-50 text-teal-800 hover:bg-teal-100 focus-visible:ring-teal-500'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3.5 text-base gap-2.5'
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${
        sizes[size] || sizes.md
      } ${className}`}
      {...props}
    >
      {/* If loading, display spinner while maintaining content width */}
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg
            className="animate-spin h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        </span>
      )}

      {/* Children with optional Icon; if loading, render invisible so dimensions remain fixed */}
      <span
        className={`inline-flex items-center gap-2 transition-opacity duration-150 ${
          loading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {Icon && <Icon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
        {children}
      </span>
    </button>
  );
}

export default Button;
