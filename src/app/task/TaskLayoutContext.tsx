'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useConversations, GroupedConversations } from '@/hooks/useConversations';
import { useSkills, SkillMeta } from '@/hooks/useSkills';
import { usePinnedComparisons, PinnedComparison } from '@/hooks/usePinnedComparisons';
import type { Message } from '@/hooks/useTsugiChat';

// Full skill data for the detail view
interface SkillDetail {
  name: string;
  description: string;
  content: string;
  files: string[];
  updatedAt: string;
}

interface TaskLayoutContextValue {
  // Sidebar state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Conversations
  groupedConversations: GroupedConversations;
  createConversation: (title?: string, mode?: 'task' | 'codify-skill') => Promise<{ id: string }>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  updateMode: (id: string, mode: 'task' | 'codify-skill') => Promise<void>;
  saveMessage: (conversationId: string, message: Message, sequenceOrder: number) => Promise<void>;
  refreshConversations: () => Promise<void>;

  // Skills
  skills: SkillMeta[];
  skillsLoading: boolean;
  deleteSkill: (name: string) => Promise<void>;
  selectedSkill: SkillDetail | null;
  setSelectedSkill: (skill: SkillDetail | null) => void;
  handleSelectSkill: (name: string) => Promise<void>;

  // System prompt modal
  showSystemPrompt: boolean;
  setShowSystemPrompt: (show: boolean) => void;

  // Comparison mode
  isComparisonMode: boolean;
  setIsComparisonMode: (mode: boolean) => void;
  toggleComparisonMode: () => void;
  leftConversationId: string | null;
  setLeftConversationId: (id: string | null) => void;
  rightConversationId: string | null;
  setRightConversationId: (id: string | null) => void;
  selectedForComparison: string | null;
  setSelectedForComparison: (id: string | null) => void;
  leftTitle: string | null;
  setLeftTitle: (title: string | null) => void;
  rightTitle: string | null;
  setRightTitle: (title: string | null) => void;

  // Pinned comparisons
  pinnedComparisons: PinnedComparison[];
  pinComparison: (name: string, leftId: string, rightId: string, leftTitle: string, rightTitle: string) => Promise<string | null>;
  unpinComparison: (id: string) => Promise<void>;
  renameComparison: (id: string, name: string) => Promise<void>;
  isPinned: (leftId: string | null, rightId: string | null) => boolean;

  // Pin modal
  showPinModal: boolean;
  setShowPinModal: (show: boolean) => void;
  pinName: string;
  setPinName: (name: string) => void;
}

const TaskLayoutContext = createContext<TaskLayoutContextValue | null>(null);

export function useTaskLayout() {
  const context = useContext(TaskLayoutContext);
  if (!context) {
    throw new Error('useTaskLayout must be used within TaskLayoutProvider');
  }
  return context;
}

export function TaskLayoutProvider({ children }: { children: ReactNode }) {
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);

  // Conversations
  const {
    groupedConversations,
    createConversation,
    deleteConversation,
    renameConversation,
    updateMode,
    saveMessage,
    refreshConversations,
  } = useConversations();

  // Skills
  const { skills, loading: skillsLoading, deleteSkill } = useSkills();
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);

  const handleSelectSkill = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSkill(data);
      }
    } catch (error) {
      console.error('Failed to fetch skill:', error);
    }
  }, []);

  // System prompt modal
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  // Comparison mode
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [leftConversationId, setLeftConversationId] = useState<string | null>(null);
  const [rightConversationId, setRightConversationId] = useState<string | null>(null);
  const [selectedForComparison, setSelectedForComparison] = useState<string | null>(null);
  const [leftTitle, setLeftTitle] = useState<string | null>(null);
  const [rightTitle, setRightTitle] = useState<string | null>(null);

  const toggleComparisonMode = useCallback(() => {
    setIsComparisonMode((prev) => {
      if (prev) {
        // Exiting comparison mode - clear selections
        setLeftConversationId(null);
        setRightConversationId(null);
        setSelectedForComparison(null);
        setLeftTitle(null);
        setRightTitle(null);
      }
      return !prev;
    });
  }, []);

  // Pinned comparisons
  const { pinnedComparisons, pinComparison, unpinComparison, renameComparison, isPinned } = usePinnedComparisons();

  // Pin modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinName, setPinName] = useState('');

  const value: TaskLayoutContextValue = {
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    groupedConversations,
    createConversation,
    deleteConversation,
    renameConversation,
    updateMode,
    saveMessage,
    refreshConversations,
    skills,
    skillsLoading,
    deleteSkill,
    selectedSkill,
    setSelectedSkill,
    handleSelectSkill,
    showSystemPrompt,
    setShowSystemPrompt,
    isComparisonMode,
    setIsComparisonMode,
    toggleComparisonMode,
    leftConversationId,
    setLeftConversationId,
    rightConversationId,
    setRightConversationId,
    selectedForComparison,
    setSelectedForComparison,
    leftTitle,
    setLeftTitle,
    rightTitle,
    setRightTitle,
    pinnedComparisons,
    pinComparison,
    unpinComparison,
    renameComparison,
    isPinned,
    showPinModal,
    setShowPinModal,
    pinName,
    setPinName,
  };

  return (
    <TaskLayoutContext.Provider value={value}>
      {children}
    </TaskLayoutContext.Provider>
  );
}
