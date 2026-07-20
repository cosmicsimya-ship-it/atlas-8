import {
  TrendingUp, Lightbulb, Crosshair, FileText, BookOpen,
  Wand2, ImageIcon, Video, Mic, FrameIcon, Search, Upload,
  BarChart3, Zap, type LucideIcon,
} from 'lucide-react';
import type { AgentStatus, Priority, PipelinePhase } from '../types';

export const agentIconMap: Record<string, LucideIcon> = {
  'trend-researcher': TrendingUp,
  'topic-discoverer': Lightbulb,
  'competitor-analyzer': Crosshair,
  'script-writer': FileText,
  'story-architect': BookOpen,
  'prompt-engineer': Wand2,
  'image-director': ImageIcon,
  'video-director': Video,
  'voice-director': Mic,
  'thumbnail-agent': FrameIcon,
  'seo-agent': Search,
  'publisher': Upload,
  'analytics-agent': BarChart3,
  'learning-agent': Zap,
};

export const agentColorMap: Record<string, string> = {
  'trend-researcher': '#3b82f6',
  'topic-discoverer': '#eab308',
  'competitor-analyzer': '#ef4444',
  'script-writer': '#a855f7',
  'story-architect': '#ec4899',
  'prompt-engineer': '#06b6d4',
  'image-director': '#f97316',
  'video-director': '#8b5cf6',
  'voice-director': '#14b8a6',
  'thumbnail-agent': '#f97316',
  'seo-agent': '#22c55e',
  'publisher': '#14b8a6',
  'analytics-agent': '#10b981',
  'learning-agent': '#f59e0b',
};

export const statusConfig: Record<AgentStatus, { label: string; color: string; bg: string }> = {
  online:     { label: 'Online',     color: '#22c55e', bg: '#22c55e18' },
  idle:       { label: 'Idle',       color: '#94a3b8', bg: '#94a3b818' },
  processing: { label: 'Processing', color: '#3b82f6', bg: '#3b82f618' },
  error:      { label: 'Error',      color: '#ef4444', bg: '#ef444418' },
  paused:     { label: 'Paused',     color: '#f59e0b', bg: '#f59e0b18' },
  offline:    { label: 'Offline',    color: '#6b7280', bg: '#6b728018' },
};

export const priorityConfig: Record<Priority, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#ef4444', bg: '#ef444418' },
  high:     { label: 'High',     color: '#f59e0b', bg: '#f59e0b18' },
  normal:   { label: 'Normal',   color: '#3b82f6', bg: '#3b82f618' },
  low:      { label: 'Low',      color: '#94a3b8', bg: '#94a3b818' },
};

export const phaseConfig: Record<PipelinePhase, { label: string; color: string }> = {
  research:     { label: 'Research',     color: '#3b82f6' },
  content:      { label: 'Content',      color: '#a855f7' },
  production:   { label: 'Production',   color: '#06b6d4' },
  optimization: { label: 'Optimization', color: '#22c55e' },
  publishing:   { label: 'Publishing',   color: '#14b8a6' },
  analytics:    { label: 'Analytics',    color: '#f59e0b' },
};

export function getAgentIcon(id: string): LucideIcon {
  return agentIconMap[id] || Zap;
}

export function getAgentColor(id: string): string {
  return agentColorMap[id] || '#94a3b8';
}
