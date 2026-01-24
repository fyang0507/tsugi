'use client';

import React, { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { Github } from 'lucide-react';
import { usePinnedComparisons } from '@/hooks/usePinnedComparisons';

export const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const { pinnedComparisons, isLoading } = usePinnedComparisons();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Determine the Examples link destination
  const examplesHref = pinnedComparisons.length > 0
    ? `/task?compare=${pinnedComparisons[0].id}`
    : '/task';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        scrolled
          ? 'bg-zinc-950/80 backdrop-blur-md border-white/10 py-4'
          : 'bg-transparent border-transparent py-6'
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Logo className="h-8" />

        <nav className="flex items-center gap-6">
          <a
            href={examplesHref}
            className={`hidden md:block text-sm font-medium transition-colors ${
              isLoading ? 'text-zinc-600 pointer-events-none' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Examples
          </a>
          <div className="h-6 w-px bg-white/10 hidden md:block" />
          <a
            href="https://github.com/fyang0507/tsugi"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors"
          >
            <Github size={16} />
            <span className="hidden sm:inline">tsugi</span>
          </a>
        </nav>
      </div>
    </header>
  );
};
