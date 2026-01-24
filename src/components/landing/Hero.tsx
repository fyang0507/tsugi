'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Key, Check } from 'lucide-react';
import { VisualizationDemo } from './VisualizationDemo';

const STORAGE_KEY = 'tsugi_llm_api_key';

export const Hero: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isKeyValid, setIsKeyValid] = useState(false);
  const router = useRouter();

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    if (val.length > 10) {
      setIsKeyValid(true);
    } else {
      setIsKeyValid(false);
    }
  };

  const handleGetStarted = () => {
    if (apiKey.trim()) {
      sessionStorage.setItem(STORAGE_KEY, apiKey.trim());
    }
    router.push('/task');
  };

  return (
    <div className="relative flex flex-col pt-32 pb-10 overflow-hidden">

      <div className="container mx-auto px-6 z-10 flex flex-col items-center text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8"
        >
          <Sparkles size={14} className="text-cyan-400" />
          <span className="text-xs font-medium text-zinc-300">Gemini 3 Hackathon Entry</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl"
        >
          Explore once. <br className="hidden md:block" />
          <span className="text-gradient">Exploit</span>{" "}
          <span className="relative inline-block ml-1">
             <span className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full scale-125"></span>
             <span className="relative z-10 text-cyan-200 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">next.</span>
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-12 leading-relaxed"
        >
          An agent harness that turns trial-and-error into reusable skills.
        </motion.p>

        {/* CTA Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-md flex flex-col gap-4"
        >
            {/* API Key Input */}
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key size={16} className="text-zinc-500 group-focus-within:text-cyan-400 transition-colors" />
                </div>
                <input
                    type="password"
                    value={apiKey}
                    onChange={handleKeyChange}
                    placeholder="Paste GOOGLE_GENERATIVE_AI_API_KEY to start"
                    className="w-full pl-10 pr-4 py-4 bg-zinc-900/80 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-sm text-white placeholder-zinc-600 transition-all shadow-lg"
                />
                {isKeyValid && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <Check size={16} className="text-green-500" />
                    </div>
                )}
            </div>

            <button
              onClick={handleGetStarted}
              className="relative w-full py-4 rounded-xl overflow-hidden group hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_40px_-10px_rgba(34,211,238,0.6)]"
            >
                {/* Liquid gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-500 bg-[length:200%_auto] animate-aurora opacity-100" />

                {/* Glass sheen/highlight */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent opacity-100" />

                {/* Content */}
                <div className="relative flex items-center justify-center gap-2 text-white font-bold tracking-wide text-lg shadow-black/20 drop-shadow-sm">
                    Get Started <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </div>
            </button>

            <p className="text-xs text-zinc-600">
                Don&apos;t have a key? <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white underline decoration-zinc-700 underline-offset-2">Get one free from Google AI Studio</a>
            </p>
        </motion.div>
      </div>

      {/* The Big Demo */}
      <motion.div
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={{ delay: 0.4, duration: 0.8 }}
         className="w-full px-4"
      >
          <VisualizationDemo />
      </motion.div>
    </div>
  );
};
