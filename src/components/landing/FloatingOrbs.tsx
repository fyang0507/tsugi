'use client';

import React from 'react';

export const FloatingOrbs: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/*
        Optimized Floating Orbs - CSS-only animations for better GPU performance
        - Reduced from 7 to 4 orbs
        - CSS animations run on compositor thread
        - Removed mix-blend-screen, using opacity layering
        - Reduced blur values for lower GPU cost
        - Added will-change hints for GPU layer optimization
      */}

      {/* 1. Primary Bottom Left - Deep Teal */}
      <div
        className="orb-animate-1 absolute bottom-[-15%] left-[-10%] w-[60vw] h-[60vw] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, rgba(13,148,136,0.35) 0%, rgba(13,148,136,0.05) 50%, rgba(0,0,0,0) 70%)',
          filter: 'blur(35px)',
          willChange: 'transform',
        }}
      />

      {/* 2. Top Right - Bright Cyan */}
      <div
        className="orb-animate-2 absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, rgba(34,211,238,0.25) 0%, rgba(34,211,238,0.05) 50%, rgba(0,0,0,0) 70%)',
          filter: 'blur(40px)',
          willChange: 'transform',
        }}
      />

      {/* 3. Top Left Corner - Teal/Cyan blend */}
      <div
        className="orb-animate-3 absolute top-[-15%] left-[-15%] w-[55vw] h-[55vw] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, rgba(34,211,238,0.2) 0%, rgba(5,150,105,0.08) 60%, rgba(0,0,0,0) 70%)',
          filter: 'blur(45px)',
          opacity: 0.4,
          willChange: 'transform, opacity',
        }}
      />

      {/* 4. Center Right - Active glow */}
      <div
        className="orb-animate-4 absolute top-[35%] right-[0%] w-[40vw] h-[40vw] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, rgba(6,182,212,0.25) 0%, rgba(8,145,178,0.05) 60%, rgba(0,0,0,0) 70%)',
          filter: 'blur(30px)',
          willChange: 'transform',
        }}
      />
    </div>
  );
};
