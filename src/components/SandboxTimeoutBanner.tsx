'use client';

interface SandboxTimeoutBannerProps {
  message: string;
  onDismiss: () => void;
}

export function SandboxTimeoutBanner({ message, onDismiss }: SandboxTimeoutBannerProps) {
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-lg">
      <div className="glass-panel bg-amber-900/60 border border-amber-500/30 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 backdrop-blur-md">
        {/* Warning icon */}
        <svg
          className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>

        <div className="flex-1">
          <p className="text-amber-100 text-sm font-medium">Sandbox Terminated</p>
          <p className="text-amber-200/80 text-sm mt-1">{message}</p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="text-amber-400 hover:text-amber-200 transition-colors p-1"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
