import React from 'react';

export interface NavItem {
  label: string;
  href: string;
}

export interface StepProps {
  number: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

export enum RunState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED'
}
