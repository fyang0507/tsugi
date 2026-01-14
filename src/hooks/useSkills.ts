'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface SkillMeta {
  name: string;
  description: string;
  updatedAt: string;
}

interface UseSkillsResult {
  skills: SkillMeta[];
  loading: boolean;
  deleteSkill: (name: string) => Promise<void>;
}

const POLL_INTERVAL = 5000; // 5 seconds

export function useSkills(): UseSkillsResult {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/skills');
      if (res.ok) {
        const data = await res.json();
        setSkills(data);
      }
    } catch (error) {
      console.error('Failed to fetch skills:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchSkills();

    const poll = () => {
      pollTimeoutRef.current = setTimeout(async () => {
        await fetchSkills();
        poll();
      }, POLL_INTERVAL);
    };
    poll();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [fetchSkills]);

  const deleteSkill = useCallback(async (name: string) => {
    // Optimistic update
    const previousSkills = skills;
    setSkills(skills.filter(s => s.name !== name));

    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        // Revert on failure
        setSkills(previousSkills);
      }
    } catch (error) {
      console.error('Failed to delete skill:', error);
      // Revert on error
      setSkills(previousSkills);
    }
  }, [skills]);

  return { skills, loading, deleteSkill };
}
