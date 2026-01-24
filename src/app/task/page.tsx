import { Suspense } from 'react';
import TsugiChat from '@/components/TsugiChat';

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center animate-pulse">
          <svg
            className="w-6 h-6 text-cyan-400 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <div className="text-zinc-400 text-sm">Loading...</div>
      </div>
    </div>
  );
}

export default function ForgePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TsugiChat />
    </Suspense>
  );
}
