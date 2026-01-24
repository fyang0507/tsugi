'use client';

import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "h-8" }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto text-white"
        aria-label="Tsugi Logo"
      >
        {/* Abstract circular brush strokes */}
        <path
          d="M85 30 C 80 10, 50 5, 30 20 C 10 35, 5 70, 25 85 C 45 100, 80 90, 90 60"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          className="opacity-90"
        />
        <path
          d="M20 60 C 25 75, 50 85, 75 70"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="opacity-70"
        />
        {/* The Arrow */}
        <path
          d="M30 80 C 40 60, 60 40, 90 15"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M70 15 L 90 15 L 85 35"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-bold text-2xl tracking-tighter text-white">tsugi</span>
    </div>
  );
};
