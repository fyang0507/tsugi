'use client';

import { useEffect, useRef, useState } from 'react';

interface TypewriterTextProps {
  /** The full text content to display */
  content: string;
  /** Whether the content is still streaming (enables animation) */
  isStreaming?: boolean;
  /** Characters per second (default: 120 for fast, natural feel) */
  speed?: number;
  /** Render function to display the visible text */
  children: (visibleText: string) => React.ReactNode;
}

/**
 * TypewriterText component that smoothly reveals text character by character.
 *
 * Uses requestAnimationFrame for smooth 60fps animation.
 * Only animates when isStreaming is true, otherwise shows full content immediately.
 */
export function TypewriterText({
  content,
  isStreaming = false,
  speed = 120,
  children,
}: TypewriterTextProps) {
  // Track the number of characters currently visible (only used during streaming)
  const [displayLength, setDisplayLength] = useState(0);

  // Refs for animation state
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const targetLengthRef = useRef<number>(0);

  // Update target length when content changes
  useEffect(() => {
    targetLengthRef.current = content.length;
  }, [content]);

  // Animation effect - only runs during streaming
  useEffect(() => {
    if (!isStreaming) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    // Calculate characters per frame at 60fps
    const charsPerMs = speed / 1000;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      setDisplayLength((prev) => {
        const target = targetLengthRef.current;

        // Already at target, keep animating in case more content comes
        if (prev >= target) {
          animationRef.current = requestAnimationFrame(animate);
          return prev;
        }

        // Calculate how many characters to reveal this frame
        const charsToAdd = Math.max(1, Math.ceil(elapsed * charsPerMs));
        const next = Math.min(prev + charsToAdd, target);

        return next;
      });

      // Continue animation while streaming
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isStreaming, speed]);

  // Calculate visible text - show full content when not streaming
  const visibleText = isStreaming ? content.slice(0, displayLength) : content;

  return <>{children(visibleText)}</>;
}

/**
 * Hook version for more flexible usage
 */
export function useTypewriter(
  content: string,
  isStreaming: boolean,
  speed = 120
): string {
  // Only track animation progress during streaming
  const [displayLength, setDisplayLength] = useState(0);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const targetLengthRef = useRef<number>(0);

  // Update target length when content changes during streaming
  useEffect(() => {
    if (isStreaming) {
      targetLengthRef.current = content.length;
    }
  }, [content, isStreaming]);

  // Animation loop - only runs during streaming
  useEffect(() => {
    if (!isStreaming) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      // Reset animation state for next streaming session
      lastTimeRef.current = 0;
      return;
    }

    const charsPerMs = speed / 1000;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      setDisplayLength((prev) => {
        const target = targetLengthRef.current;
        if (prev >= target) return prev;

        const charsToAdd = Math.max(1, Math.ceil(elapsed * charsPerMs));
        return Math.min(prev + charsToAdd, target);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isStreaming, speed]);

  // Show full content when not streaming, animated content when streaming
  return isStreaming ? content.slice(0, displayLength) : content;
}
