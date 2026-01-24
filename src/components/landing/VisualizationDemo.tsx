'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { CheckCircle2, Zap, BrainCircuit, Repeat } from 'lucide-react';

type DemoPhase = 'idle' | 'run1' | 'codifying' | 'run2' | 'completed';

export const VisualizationDemo: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.5 });
  const hasAutoStarted = useRef(false);

  const [phase, setPhase] = useState<DemoPhase>('idle');
  const [timer1, setTimer1] = useState(0);
  const [timer2, setTimer2] = useState(0);

  const startDemo = () => {
    setPhase('run1');
    setTimer1(0);
    setTimer2(0);
  };

  const resetDemo = () => {
    setPhase('idle');
    setTimer1(0);
    setTimer2(0);
  };

  // Auto-play when in view with 3s Delay
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (isInView && phase === 'idle' && !hasAutoStarted.current) {
      timeout = setTimeout(() => {
        startDemo();
        hasAutoStarted.current = true;
      }, 3000);
    }

    return () => clearTimeout(timeout);
  }, [isInView, phase]);

  // Sequence Controller
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (phase === 'run1') {
      interval = setInterval(() => {
        setTimer1((prev) => {
          if (prev >= 45) {
            setPhase('codifying');
            return 45;
          }
          return prev + 0.8;
        });
      }, 50);
    } else if (phase === 'codifying') {
      const timeout = setTimeout(() => {
        setPhase('run2');
      }, 2500);
      return () => clearTimeout(timeout);
    } else if (phase === 'run2') {
      interval = setInterval(() => {
        setTimer2((prev) => {
          if (prev >= 8) {
            setPhase('completed');
            return 8;
          }
          return prev + 0.4;
        });
      }, 30);
    }

    return () => clearInterval(interval);
  }, [phase]);

  const handleReplay = () => {
      resetDemo();
      setTimeout(() => {
          startDemo();
      }, 200);
  }

  // Derived states for UI
  const isRun1Active = phase !== 'idle';
  const isRun1Done = phase === 'codifying' || phase === 'run2' || phase === 'completed';
  const isRun2Active = phase === 'run2' || phase === 'completed';
  const isRun2Done = phase === 'completed';

  return (
    <div ref={containerRef} className="w-full max-w-6xl mx-auto mt-16 mb-4">
      <div className="glass-panel rounded-2xl p-1 border border-white/10 shadow-2xl overflow-hidden relative">
        {/* Header / Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
            </div>
            <span className="text-sm font-mono text-zinc-400 ml-2">tsugi.exe</span>
          </div>
          <div className="flex gap-2">
            {phase === 'completed' && (
                <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleReplay}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                >
                <Repeat size={14} /> Replay
                </motion.button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 relative">

          {/* Codification Overlay / Bridge */}
          <AnimatePresence>
            {phase === 'codifying' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none"
              >
                <div className="bg-zinc-900 border border-teal-500/30 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
                   <div className="relative">
                       <div className="absolute inset-0 bg-teal-500/20 blur-xl rounded-full animate-pulse" />
                       <BrainCircuit size={48} className="text-teal-400 relative z-10" />
                   </div>
                   <div className="text-center">
                       <h4 className="text-white font-bold text-lg">Codifying Skill</h4>
                       <p className="text-zinc-400 text-sm">Analyzing trace... optimizing path... storing procedure.</p>
                   </div>
                   <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                       <motion.div
                          className="h-full bg-teal-400"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 2.5, ease: "easeInOut" }}
                       />
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* RUN 1: Exploration */}
          <div className="bg-[#0c0c0e] p-6 lg:p-8 relative min-h-[400px] flex flex-col group">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-white font-mono text-xl md:text-2xl font-bold uppercase tracking-widest mb-3">Run 1: Exploration</h3>
                <p className="text-xs text-zinc-500">Trial-and-error, research, learning.</p>
              </div>
              <div className="text-right">
                <div className={`font-mono text-3xl font-bold ${isRun1Done ? 'text-red-400' : 'text-zinc-200'}`}>
                  {timer1.toFixed(1)}s
                </div>
              </div>
            </div>

            {/* Animation Canvas Run 1 */}
            <div className="flex-1 relative flex items-center justify-center w-full">
              <div className="relative w-full h-48">
                 <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 350 160" preserveAspectRatio="xMidYMid meet">
                    {/* Winding "Search" Path - Rectilinear/Circuit style */}
                    <motion.path
                        d="M 20 100 H 60 V 40 H 140 V 140 H 220 V 80 H 320"
                        fill="none"
                        stroke="#0d9488"
                        strokeWidth="4"
                        strokeDasharray="6 6"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={isRun1Active ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                        transition={{ duration: isRun1Active ? 3 : 0, ease: "linear" }}
                    />

                    {/* Start Node */}
                    <motion.circle
                        cx={20}
                        cy={100}
                        r={4}
                        fill="#134e4a"
                        stroke="#0d9488"
                        strokeWidth="2"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={isRun1Active ? { scale: 1, opacity: 1 } : { scale: 0 }}
                        transition={{ duration: isRun1Active ? 0.3 : 0 }}
                    />

                    {/* End Node */}
                     <motion.circle
                        cx={320}
                        cy={80}
                        r={6}
                        fill="#22d3ee"
                        stroke="#22d3ee"
                        strokeWidth="2"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={isRun1Active ? { scale: 1, opacity: 1 } : { scale: 0 }}
                        transition={{ duration: isRun1Active ? 0.3 : 0 }}
                    />

                    {/* Intermediate Nodes along the path */}
                    {[
                        { cx: 60, cy: 100, delay: 0.3 },
                        { cx: 60, cy: 40, delay: 0.6 },
                        { cx: 140, cy: 40, delay: 1.0 },
                        { cx: 140, cy: 140, delay: 1.6 },
                        { cx: 220, cy: 140, delay: 2.0 },
                        { cx: 220, cy: 80, delay: 2.5 },
                    ].map((node, i) => (
                        <motion.circle
                            key={i}
                            cx={node.cx}
                            cy={node.cy}
                            r={4}
                            fill="#134e4a"
                            stroke="#0d9488"
                            strokeWidth="2"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={isRun1Active ? { scale: 1, opacity: 1 } : { scale: 0 }}
                            transition={{ delay: isRun1Active ? node.delay : 0, duration: isRun1Active ? 0.2 : 0 }}
                        />
                    ))}
                 </svg>

                 {/* Processing Labels */}
                 {isRun1Active && (
                     <>
                        {/* Start/End Labels */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="absolute left-[2%] top-[68%] text-[10px] text-teal-500 font-mono font-bold uppercase tracking-wider"
                        >
                            Start
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="absolute right-[5%] top-[40%] text-[10px] text-cyan-400 font-mono font-bold uppercase tracking-wider"
                        >
                            End
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="absolute left-[5%] top-[78%] text-[10px] text-zinc-400 font-mono bg-zinc-900/90 border border-zinc-700/50 px-2 py-1 rounded shadow-lg backdrop-blur-sm whitespace-nowrap">
                            Searching docs...
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.2 }}
                            className="absolute left-[35%] top-[8%] text-[10px] text-red-300 font-mono bg-red-950/80 border border-red-900/50 px-2 py-1 rounded shadow-lg backdrop-blur-sm whitespace-nowrap">
                            Error: Rate Limit
                        </motion.div>

                         <motion.div
                            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 2.4 }}
                            className="absolute left-[55%] top-[70%] text-[10px] text-teal-300 font-mono bg-teal-950/80 border border-teal-900/50 px-2 py-1 rounded shadow-lg backdrop-blur-sm whitespace-nowrap">
                            Correcting...
                        </motion.div>
                     </>
                 )}
              </div>
            </div>

            <div className="mt-8 h-24 bg-zinc-950/50 rounded border border-white/5 p-3 font-mono text-xs text-zinc-500 overflow-hidden flex flex-col justify-end">
               {phase === 'idle' && <p>Ready to start...</p>}
               {isRun1Active && (
                   <motion.div initial={{ y: 20 }} animate={{ y: 0 }}>
                       <p className="opacity-50">Log: Starting exploration agent...</p>
                       <p className="opacity-70 text-teal-400">Log: Exploring tool parameters...</p>
                       <p className="opacity-50">Log: Encountered dead ends...</p>
                       <p className="opacity-70 text-red-400">Log: Backtracking...</p>
                       {isRun1Done && <p className="text-teal-500 mt-1">Log: Goal reached. Trace captured.</p>}
                   </motion.div>
               )}
            </div>
          </div>

          {/* RUN 2: Exploitation */}
          <div className="bg-[#0c0c0e] p-6 lg:p-8 relative min-h-[400px] flex flex-col">
              {/* Gradient Border Overlay for active state */}
            {isRun2Active && (
                 <motion.div
                    layoutId="outline"
                    className="absolute inset-0 border-2 border-cyan-500/30 z-10 pointer-events-none"
                    transition={{ duration: 0.3 }}
                 />
            )}

            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-white font-mono text-xl md:text-2xl font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                  Run 2: Exploitation <Zap size={20} className="text-yellow-400" />
                </h3>
                <p className="text-xs text-zinc-500">Direct execution, no research.</p>
              </div>
              <div className="text-right">
                <div className={`font-mono text-3xl font-bold ${isRun2Done ? 'text-green-400' : 'text-zinc-600'}`}>
                  {timer2.toFixed(1)}s
                </div>
                {isRun2Done && (
                    <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-xs text-green-500 font-bold bg-green-950/30 px-2 py-0.5 rounded inline-block mt-1"
                    >
                        5.6x FASTER
                    </motion.span>
                )}
              </div>
            </div>

            {/* Animation Canvas Run 2 */}
            <div className="flex-1 relative flex items-center justify-center w-full">
                 <div className="relative w-full h-48">
                 <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 350 160" preserveAspectRatio="xMidYMid meet">
                     {/* Streamlined Path */}
                     <defs>
                        <linearGradient id="gradientLine" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#0d9488" />
                            <stop offset="100%" stopColor="#22d3ee" />
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                     </defs>

                    <motion.path
                        d="M 20 100 C 120 100, 200 80, 320 20"
                        fill="none"
                        stroke="url(#gradientLine)"
                        strokeWidth="4"
                        filter="url(#glow)"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={isRun2Active ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                        transition={{ duration: isRun2Active ? 0.8 : 0, ease: "circOut" }}
                    />

                    {/* Start Node */}
                    <motion.circle cx="20" cy="100" r="4" fill="#0d9488"
                         initial={{ opacity: 0 }} animate={{ opacity: isRun2Active ? 1 : 0.3 }}
                         transition={{ duration: isRun2Active ? 0.3 : 0 }} />

                    {/* End Node */}
                    <motion.circle cx="320" cy="20" r="6" fill="#22d3ee"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={isRun2Active ? { opacity: 1, scale: 1 } : { opacity: 0.3, scale: 0.5 }}
                        transition={{ delay: isRun2Active ? 0.7 : 0, duration: isRun2Active ? 0.3 : 0 }}
                    />
                 </svg>

                 {/* Start / End Labels for Run 2 */}
                 {isRun2Active && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="absolute left-[2%] top-[68%] text-[10px] text-teal-500 font-mono font-bold uppercase tracking-wider"
                        >
                            Start
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="absolute right-[5%] top-[5%] text-[10px] text-cyan-400 font-mono font-bold uppercase tracking-wider"
                        >
                            End
                        </motion.div>
                    </>
                 )}
                 </div>
            </div>

            <div className="mt-8 h-24 bg-zinc-950/50 rounded border border-white/5 p-3 font-mono text-xs text-zinc-500 overflow-hidden flex flex-col justify-end">
               {!isRun2Active && !isRun2Done && <p className="opacity-30">Waiting for optimized skill...</p>}
               {isRun2Active && !isRun2Done && (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                       <p className="text-zinc-300">Log: Skill &apos;DeployToVercel&apos; found.</p>
                       <p className="text-cyan-400">Log: Executing optimized path...</p>
                   </motion.div>
               )}
                {isRun2Done && (
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                         <p className="text-green-500 flex items-center gap-2 mb-1"><CheckCircle2 size={12}/> Optimization verified.</p>
                         <p className="text-zinc-400">Log: No detours taken.</p>
                    </motion.div>
                )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
