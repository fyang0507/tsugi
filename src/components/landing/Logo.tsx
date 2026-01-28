'use client';

import React from 'react';
import Image from 'next/image';

export const Logo: React.FC<{ className?: string }> = ({ className = "h-8" }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/logo-dark.png"
        alt="Tsugi Logo"
        width={89}
        height={32}
        className="h-full w-auto"
      />
    </div>
  );
};
