'use client';

import React from 'react';
import { Github } from 'lucide-react';
import { Logo } from './Logo';

export const Footer: React.FC = () => {
  return (
    <footer className="py-12 px-6 relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col items-center md:items-start gap-4">
          <Logo className="h-6" />
          <p className="text-zinc-500 text-sm">
            Explore once. Exploit next.
          </p>
        </div>

        <div className="flex items-center gap-6">
          <a href="https://github.com/fyang0507/tsugi" className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm">
            <Github size={16} /> tsugi
          </a>
        </div>

        <div className="text-zinc-600 text-xs">
          © {new Date().getFullYear()} tsugi. Open Source.
        </div>
      </div>
    </footer>
  );
};
