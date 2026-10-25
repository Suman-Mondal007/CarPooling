import React, { useState } from 'react';

const AVATAR_COLORS = [
  'bg-teal-600 text-white',
  'bg-emerald-600 text-white',
  'bg-indigo-600 text-white',
  'bg-blue-600 text-white',
  'bg-cyan-700 text-white',
  'bg-sky-600 text-white',
  'bg-slate-700 text-white',
  'bg-teal-700 text-white'
];

function getInitials(name = '') {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name = '') {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function Avatar({
  src,
  name = 'User',
  size = 'md', // sm, md, lg, xl
  className = '',
  alt
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-lg font-bold'
  }[size] || 'w-10 h-10 text-sm';

  const colorClass = getAvatarColor(name);
  const initials = getInitials(name);

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden select-none font-medium flex-shrink-0 shadow-sm ${sizeClasses} ${colorClass} ${className}`}
      aria-label={alt || name}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt || name}
          onError={() => setImageError(true)}
          onLoad={() => setImageLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <span className="leading-none">{initials}</span>
      )}
    </div>
  );
}

export default Avatar;
