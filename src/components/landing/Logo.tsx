'use client';

import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "h-8" }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/logo-dark.png"
        alt="Tsugi Logo"
        className="h-full w-auto"
      />
    </div>
  );
};
