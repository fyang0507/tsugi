'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const FloatingOrbs: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/*
        Electron Cloud / Nucleus Effect - TEAL/CYAN ONLY
        Using radial gradients with a bright core and fading edge.
        mix-blend-screen allows them to interact and glow against the dark background.
      */}

      {/* 1. Primary Bottom Left - Deep Teal */}
      <motion.div
        animate={{
          x: [-50, 100, -50],
          y: [0, -100, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-[-15%] left-[-10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen"
        style={{
          background: 'radial-gradient(circle at center, rgba(13,148,136,0.4) 0%, rgba(13,148,136,0.05) 50%, rgba(0,0,0,0) 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* 2. Top Right - Bright Cyan */}
      <motion.div
        animate={{
          x: [0, -120, 0],
          y: [0, 120, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-screen"
        style={{
          background: 'radial-gradient(circle at center, rgba(34,211,238,0.3) 0%, rgba(34,211,238,0.05) 50%, rgba(0,0,0,0) 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* 3. Center Left Bridge */}
      <motion.div
        animate={{
          x: [-60, 60, -60],
          y: [-50, 80, -50],
          scale: [0.9, 1.25, 0.9],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
        className="absolute top-[25%] left-[-5%] w-[45vw] h-[45vw] rounded-full mix-blend-screen"
        style={{
          background: 'radial-gradient(circle at center, rgba(45,212,191,0.25) 0%, rgba(20,184,166,0.05) 50%, rgba(0,0,0,0) 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* 4. NEW Dedicated Top Left Corner Orb - Made Brighter & Larger */}
      <motion.div
        animate={{
            scale: [1, 1.5, 1],
            opacity: [0.4, 0.7, 0.4],
            x: [0, 50, 0],
            y: [0, 30, 0],
        }}
        transition={{
          duration: 11,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="absolute top-[-15%] left-[-15%] w-[55vw] h-[55vw] rounded-full mix-blend-screen"
        style={{
          background: 'radial-gradient(circle at center, rgba(34,211,238,0.25) 0%, rgba(5,150,105,0.1) 60%, rgba(0,0,0,0) 70%)',
          filter: 'blur(90px)',
        }}
      />

      {/* 5. Center Right - Active "Splash" */}
      <motion.div
        animate={{
          x: ['-20%', '30%', '-20%'],
          y: ['-20%', '30%', '-20%'],
          scale: [0.8, 1.4, 0.8],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[35%] right-[0%] w-[40vw] h-[40vw] rounded-full mix-blend-screen"
        style={{
          background: 'radial-gradient(circle at center, rgba(6,182,212,0.3) 0%, rgba(8,145,178,0.05) 60%, rgba(0,0,0,0) 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* 6. Bottom Right - Filler */}
      <motion.div
         animate={{
            opacity: [0.2, 0.5, 0.2],
            y: [0, -80, 0],
            x: [0, -60, 0]
         }}
         transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 3 }}
         className="absolute bottom-[0%] right-[10%] w-[30vw] h-[30vw] rounded-full mix-blend-screen"
         style={{
             background: 'radial-gradient(circle at center, rgba(20,184,166,0.2) 0%, rgba(0,0,0,0) 70%)',
             filter: 'blur(45px)'
         }}
       />

       {/* 7. Tiny High-Intensity "Spark" - Very Erratic */}
       <motion.div
         animate={{
            opacity: [0, 0.9, 0],
            scale: [0.5, 1.8, 0.5],
            x: [0, 200, 0],
            y: [0, -150, 0]
         }}
         transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
         className="absolute top-[50%] left-[50%] w-[12vw] h-[12vw] rounded-full mix-blend-screen"
         style={{
             background: 'radial-gradient(circle at center, rgba(200,255,255,0.6) 0%, rgba(34,211,238,0) 70%)',
             filter: 'blur(25px)'
         }}
       />
    </div>
  );
};
