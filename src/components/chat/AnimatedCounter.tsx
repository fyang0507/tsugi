'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  formatFn?: (value: number) => string;
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 1000,
  suffix = '',
  prefix = '',
  formatFn,
  className = '',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const startValueRef = useRef(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = startValueRef.current;
    const diff = value - startValue;

    if (diff === 0) return;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + diff * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        startValueRef.current = value;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  const formatted = formatFn ? formatFn(displayValue) : Math.round(displayValue).toLocaleString();

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

// Helper to format milliseconds as human-readable time
export function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// Helper to format large numbers compactly
export function formatCompact(num: number): string {
  if (num < 1000) return num.toLocaleString();
  if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
  return `${(num / 1000000).toFixed(1)}M`;
}
