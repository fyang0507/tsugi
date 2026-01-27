'use client';

import type { SandboxStatus } from '@/hooks/useTsugiChat';

interface SandboxStatusIndicatorProps {
  status: SandboxStatus;
}

export function SandboxStatusIndicator({ status }: SandboxStatusIndicatorProps) {
  const isConnected = status === 'connected';

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <div
        className={`w-2 h-2 rounded-full transition-colors ${
          isConnected ? 'bg-emerald-500' : 'bg-gray-500'
        }`}
      />
      <span className="hidden sm:inline">
        {isConnected ? 'Sandbox' : 'No sandbox'}
      </span>
    </div>
  );
}
