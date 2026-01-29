/**
 * Loading state for conversation pages.
 * Shows a skeleton that matches the chat layout to prevent jarring transitions.
 */
export default function Loading() {
  return (
    <>
      {/* Messages area skeleton */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="w-full max-w-4xl mx-auto px-6 py-6 flex-1 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center animate-pulse">
              <svg
                className="w-10 h-10 text-cyan-400 animate-spin"
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
            <div className="text-zinc-400 text-sm">Loading conversation...</div>
          </div>
        </div>
      </div>

      {/* Stats bar skeleton */}
      <div className="h-8 bg-zinc-900/30 border-t border-white/5" />

      {/* Input area skeleton */}
      <div className="flex-shrink-0 px-6 py-4 relative z-10">
        <div className="w-full max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 h-12 bg-zinc-900/50 border border-white/10 rounded-xl animate-pulse" />
            <div className="w-20 h-12 bg-zinc-800 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </>
  );
}
