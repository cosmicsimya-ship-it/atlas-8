import type { AgentRuntime, PipelineRun, Notification, Channel, QueueItem, ArsenalItem, MemoryEntry, ActivityEvent } from '../types';

export const mockAgents: AgentRuntime[] = [
  { id: 'trend-researcher', name: 'Trend Researcher', role: 'Intelligence Gathering', status: 'online', phase: 'research', model: 'GPT-4o', currentTask: null, completedToday: 12, failedToday: 0, avgLatencyMs: 2400, costToday: 3.20, apiCallsToday: 156, memoryMb: 245, uptimeHrs: 168, lastActive: '2m ago', queueDepth: 0, successRate: 98.5, description: 'Monitors YouTube trends, Google Trends, social media, and news APIs to identify emerging content opportunities.' },
  { id: 'topic-discoverer', name: 'Topic Discoverer', role: 'Content Ideation', status: 'processing', phase: 'research', model: 'GPT-4o + Claude 3.5', currentTask: 'Evaluating 3 trending AI topics', completedToday: 8, failedToday: 1, avgLatencyMs: 4500, costToday: 5.40, apiCallsToday: 89, memoryMb: 312, uptimeHrs: 168, lastActive: 'now', queueDepth: 2, successRate: 94.2, description: 'Synthesizes trend data with channel identity and audience preferences to generate ranked topic ideas.' },
  { id: 'competitor-analyzer', name: 'Competitor Analyzer', role: 'Market Intelligence', status: 'idle', phase: 'research', model: 'GPT-4o', currentTask: null, completedToday: 5, failedToday: 0, avgLatencyMs: 3800, costToday: 2.10, apiCallsToday: 67, memoryMb: 198, uptimeHrs: 168, lastActive: '15m ago', queueDepth: 0, successRate: 97.1, description: 'Performs deep competitive intelligence on rival channels, analyzing content strategies and identifying gaps.' },
  { id: 'script-writer', name: 'Script Writer', role: 'Content Creation', status: 'processing', phase: 'content', model: 'Claude 3.5 Sonnet', currentTask: 'Writing script: "AI Revolution 2026"', completedToday: 3, failedToday: 0, avgLatencyMs: 18000, costToday: 8.90, apiCallsToday: 42, memoryMb: 456, uptimeHrs: 168, lastActive: 'now', queueDepth: 1, successRate: 96.8, description: 'Generates broadcast-quality scripts optimized for YouTube retention with hooks and engagement techniques.' },
  { id: 'story-architect', name: 'Story Architect', role: 'Narrative Architecture', status: 'idle', phase: 'content', model: 'Claude 3.5 Sonnet', currentTask: null, completedToday: 3, failedToday: 0, avgLatencyMs: 12000, costToday: 4.50, apiCallsToday: 38, memoryMb: 289, uptimeHrs: 168, lastActive: '8m ago', queueDepth: 0, successRate: 95.3, description: 'Engineers narrative structures that maximize emotional engagement and retention.' },
  { id: 'prompt-engineer', name: 'Prompt Engineer', role: 'Prompt Design', status: 'idle', phase: 'production', model: 'GPT-4o Vision', currentTask: null, completedToday: 6, failedToday: 0, avgLatencyMs: 5200, costToday: 3.70, apiCallsToday: 78, memoryMb: 267, uptimeHrs: 168, lastActive: '12m ago', queueDepth: 0, successRate: 93.6, description: 'Translates scripts into detailed visual prompts for AI image/video generation.' },
  { id: 'image-director', name: 'Image Director', role: 'Visual Production', status: 'processing', phase: 'production', model: 'DALL-E 3 + Midjourney', currentTask: 'Generating scenes for "10 React Tips"', completedToday: 15, failedToday: 2, avgLatencyMs: 22000, costToday: 12.40, apiCallsToday: 234, memoryMb: 678, uptimeHrs: 160, lastActive: 'now', queueDepth: 3, successRate: 91.2, description: 'Generates and curates all visual assets for video production using multi-model routing.' },
  { id: 'video-director', name: 'Video Director', role: 'Video Assembly', status: 'paused', phase: 'production', model: 'Runway ML', currentTask: null, completedToday: 2, failedToday: 0, avgLatencyMs: 45000, costToday: 6.80, apiCallsToday: 18, memoryMb: 890, uptimeHrs: 155, lastActive: '1h ago', queueDepth: 0, successRate: 89.5, description: 'Assembles final video from visual assets, audio, and script with transitions and effects.' },
  { id: 'voice-director', name: 'Voice Director', role: 'Audio Production', status: 'online', phase: 'production', model: 'ElevenLabs', currentTask: null, completedToday: 4, failedToday: 0, avgLatencyMs: 8000, costToday: 5.20, apiCallsToday: 56, memoryMb: 345, uptimeHrs: 168, lastActive: '20m ago', queueDepth: 0, successRate: 97.8, description: 'Generates narration and voiceover using AI voice synthesis with style consistency.' },
  { id: 'thumbnail-agent', name: 'Thumbnail Agent', role: 'Click Optimization', status: 'processing', phase: 'optimization', model: 'DALL-E 3 + GPT-4o Vision', currentTask: 'A/B testing thumbnails for "Crypto Market"', completedToday: 7, failedToday: 1, avgLatencyMs: 15000, costToday: 4.60, apiCallsToday: 89, memoryMb: 412, uptimeHrs: 168, lastActive: 'now', queueDepth: 1, successRate: 92.4, description: 'Designs high-CTR thumbnails using visual psychology and A/B testing.' },
  { id: 'seo-agent', name: 'SEO Agent', role: 'Search Optimization', status: 'online', phase: 'optimization', model: 'GPT-4o', currentTask: null, completedToday: 9, failedToday: 0, avgLatencyMs: 3200, costToday: 2.80, apiCallsToday: 112, memoryMb: 178, uptimeHrs: 168, lastActive: '5m ago', queueDepth: 0, successRate: 96.1, description: 'Optimizes titles, descriptions, tags, and metadata for YouTube search and suggested videos.' },
  { id: 'publisher', name: 'Publisher', role: 'Distribution', status: 'online', phase: 'publishing', model: 'GPT-4o-mini', currentTask: null, completedToday: 2, failedToday: 0, avgLatencyMs: 6500, costToday: 1.20, apiCallsToday: 24, memoryMb: 134, uptimeHrs: 168, lastActive: '30m ago', queueDepth: 0, successRate: 99.1, description: 'Manages end-to-end publishing including scheduling, uploading, and cross-platform distribution.' },
  { id: 'analytics-agent', name: 'Analytics Agent', role: 'Performance Intelligence', status: 'processing', phase: 'analytics', model: 'GPT-4o + Custom ML', currentTask: 'Real-time monitoring across 3 channels', completedToday: 48, failedToday: 0, avgLatencyMs: 1800, costToday: 2.90, apiCallsToday: 345, memoryMb: 567, uptimeHrs: 168, lastActive: 'now', queueDepth: 0, successRate: 99.4, description: 'Provides real-time and historical performance tracking with actionable insights.' },
  { id: 'learning-agent', name: 'Learning Agent', role: 'Continuous Improvement', status: 'error', phase: 'analytics', model: 'GPT-4o + Custom RL', currentTask: null, completedToday: 6, failedToday: 3, avgLatencyMs: 25000, costToday: 7.60, apiCallsToday: 78, memoryMb: 789, uptimeHrs: 164, lastActive: '45m ago', queueDepth: 2, successRate: 85.7, description: 'Meta-learning agent that analyzes system performance and optimizes all agents over time.' },
];

export const mockPipelines: PipelineRun[] = [
  { id: 'pl-001', title: 'AI Revolution 2026', channelId: 'ch-1', channelName: 'TechVision AI', status: 'processing', priority: 'high', phase: 'content', agentId: 'script-writer', agentName: 'Script Writer', progress: 45, startedAt: '2h ago', eta: '3h 15m', cost: 12.40 },
  { id: 'pl-002', title: '10 React Tips You Need', channelId: 'ch-2', channelName: 'CodeCraft', status: 'processing', priority: 'normal', phase: 'production', agentId: 'image-director', agentName: 'Image Director', progress: 72, startedAt: '4h ago', eta: '1h 30m', cost: 18.90 },
  { id: 'pl-003', title: 'Crypto Market Analysis Q1', channelId: 'ch-1', channelName: 'TechVision AI', status: 'review', priority: 'high', phase: 'optimization', agentId: 'seo-agent', agentName: 'SEO Agent', progress: 88, startedAt: '6h ago', eta: '25m', cost: 24.30 },
  { id: 'pl-004', title: 'Morning Routine for Devs', channelId: 'ch-2', channelName: 'CodeCraft', status: 'completed', priority: 'normal', phase: 'publishing', agentId: 'publisher', agentName: 'Publisher', progress: 100, startedAt: '12h ago', eta: '-', cost: 31.20 },
  { id: 'pl-005', title: 'Python for Beginners Ep.4', channelId: 'ch-2', channelName: 'CodeCraft', status: 'completed', priority: 'normal', phase: 'analytics', agentId: 'analytics-agent', agentName: 'Analytics Agent', progress: 100, startedAt: '1d ago', eta: '-', cost: 28.50 },
  { id: 'pl-006', title: 'Space Tech in 2026', channelId: 'ch-3', channelName: 'Future Labs', status: 'queued', priority: 'low', phase: 'research', agentId: 'trend-researcher', agentName: 'Trend Researcher', progress: 0, startedAt: '-', eta: '8h', cost: 0 },
  { id: 'pl-007', title: 'Cooking with AI Assistants', channelId: 'ch-3', channelName: 'Future Labs', status: 'processing', priority: 'normal', phase: 'research', agentId: 'topic-discoverer', agentName: 'Topic Discoverer', progress: 15, startedAt: '45m ago', eta: '5h 40m', cost: 2.10 },
  { id: 'pl-008', title: 'Machine Learning 101', channelId: 'ch-1', channelName: 'TechVision AI', status: 'failed', priority: 'high', phase: 'content', agentId: 'script-writer', agentName: 'Script Writer', progress: 33, startedAt: '3h ago', eta: '-', cost: 8.70, error: 'Script Writer timeout after 3 retries — LLM rate limit exceeded' },
];

export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'success', title: 'Script Completed', message: 'Script Writer finished "Morning Routine for Devs"', time: '12m ago', read: false, agentId: 'script-writer' },
  { id: 'n2', type: 'info', title: 'New Trends Found', message: 'Trend Researcher identified 3 new trending AI topics', time: '18m ago', read: false, agentId: 'trend-researcher' },
  { id: 'n3', type: 'error', title: 'Pipeline Failed', message: 'Machine Learning 101 failed at content phase', time: '45m ago', read: false },
  { id: 'n4', type: 'warning', title: 'Agent Error', message: 'Learning Agent experiencing API timeout issues', time: '1h ago', read: true, agentId: 'learning-agent' },
  { id: 'n5', type: 'success', title: 'Video Published', message: '"Python for Beginners Ep.4" uploaded to YouTube', time: '2h ago', read: true },
  { id: 'n6', type: 'info', title: 'Competitor Alert', message: 'Main competitor uploaded new video in your niche', time: '3h ago', read: true, agentId: 'competitor-analyzer' },
  { id: 'n7', type: 'warning', title: 'API Quota', message: 'OpenAI API usage at 78% of daily limit', time: '4h ago', read: true },
  { id: 'n8', type: 'success', title: 'A/B Test Winner', message: 'Thumbnail variant B selected — +12% CTR predicted', time: '5h ago', read: true, agentId: 'thumbnail-agent' },
];

export const mockChannels: Channel[] = [
  { id: 'ch-1', name: 'TechVision AI', handle: '@techvisionai', subscribers: '524K', videos: 342, avgViews: '45.2K', ctr: 6.8, retention: 52.3, monthlyRevenue: '$8,420', status: 'active', growthRate: 4.2, niche: 'AI / Technology' },
  { id: 'ch-2', name: 'CodeCraft', handle: '@codecraft', subscribers: '89K', videos: 156, avgViews: '12.8K', ctr: 5.4, retention: 48.7, monthlyRevenue: '$2,340', status: 'active', growthRate: 7.8, niche: 'Programming' },
  { id: 'ch-3', name: 'Future Labs', handle: '@futurelabs', subscribers: '2.3K', videos: 12, avgViews: '890', ctr: 3.2, retention: 41.5, monthlyRevenue: '$120', status: 'setup', growthRate: 15.2, niche: 'Science / Future Tech' },
];

export const mockQueue: QueueItem[] = [
  { id: 'q1', pipelineId: 'pl-001', title: 'AI Revolution 2026', priority: 'high', status: 'processing', agent: 'Script Writer', agentId: 'script-writer', attempts: 1, maxAttempts: 3, createdAt: '2h ago' },
  { id: 'q2', pipelineId: 'pl-002', title: '10 React Tips', priority: 'normal', status: 'processing', agent: 'Image Director', agentId: 'image-director', attempts: 1, maxAttempts: 3, createdAt: '4h ago' },
  { id: 'q3', pipelineId: 'pl-003', title: 'Crypto Market Analysis', priority: 'high', status: 'processing', agent: 'SEO Agent', agentId: 'seo-agent', attempts: 1, maxAttempts: 3, createdAt: '6h ago' },
  { id: 'q4', pipelineId: 'pl-007', title: 'Cooking with AI', priority: 'normal', status: 'processing', agent: 'Topic Discoverer', agentId: 'topic-discoverer', attempts: 1, maxAttempts: 3, createdAt: '45m ago' },
  { id: 'q5', pipelineId: 'pl-006', title: 'Space Tech in 2026', priority: 'low', status: 'waiting', agent: 'Trend Researcher', agentId: 'trend-researcher', attempts: 0, maxAttempts: 3, createdAt: '1h ago' },
  { id: 'q6', pipelineId: 'pl-008', title: 'Machine Learning 101', priority: 'high', status: 'failed', agent: 'Script Writer', agentId: 'script-writer', attempts: 3, maxAttempts: 3, createdAt: '3h ago', error: 'LLM rate limit exceeded' },
  { id: 'q7', pipelineId: 'pl-001', title: 'AI Revolution 2026 — Thumbnails', priority: 'normal', status: 'waiting', agent: 'Thumbnail Agent', agentId: 'thumbnail-agent', attempts: 0, maxAttempts: 3, createdAt: '1h ago' },
  { id: 'q8', pipelineId: 'pl-002', title: '10 React Tips — Voice', priority: 'normal', status: 'waiting', agent: 'Voice Director', agentId: 'voice-director', attempts: 0, maxAttempts: 3, createdAt: '2h ago' },
  { id: 'q9', pipelineId: 'pl-008', title: 'ML 101 — Retry Script', priority: 'high', status: 'retry', agent: 'Script Writer', agentId: 'script-writer', attempts: 2, maxAttempts: 5, createdAt: '2h ago', error: 'Retrying with fallback model' },
];

export const mockArsenal: ArsenalItem[] = [
  { id: 'a1', name: 'YouTube Hook Templates', type: 'prompt', category: 'Prompt Library', uses: 145, lastUsed: '2h ago', tags: ['hook', 'intro', 'retention'], description: 'Collection of proven hook templates for first 5 seconds' },
  { id: 'a2', name: 'Tech Tutorial Workflow', type: 'workflow', category: 'Workflow Templates', uses: 67, lastUsed: '1d ago', tags: ['tutorial', 'tech', 'educational'], description: 'End-to-end workflow for technical tutorial videos' },
  { id: 'a3', name: 'Bold Thumbnail Style', type: 'thumbnail', category: 'Thumbnail Templates', uses: 234, lastUsed: '3h ago', tags: ['bold', 'contrast', 'text-heavy'], description: 'High-contrast thumbnail with bold text overlay' },
  { id: 'a4', name: '3-Act Story Structure', type: 'story', category: 'Story Templates', uses: 89, lastUsed: '5h ago', tags: ['narrative', '3-act', 'educational'], description: 'Classic 3-act structure adapted for 10-15 min YouTube videos' },
  { id: 'a5', name: 'Cinematic Dark Visual Style', type: 'visual_style', category: 'Visual Styles', uses: 156, lastUsed: '4h ago', tags: ['cinematic', 'dark', 'moody'], description: 'Dark cinematic visual style with blue/orange color grading' },
  { id: 'a6', name: 'Authoritative Narrator', type: 'voice_style', category: 'Voice Styles', uses: 78, lastUsed: '6h ago', tags: ['narrator', 'deep', 'authority'], description: 'Deep authoritative narration voice preset for documentaries' },
  { id: 'a7', name: 'GPT-4o Balanced Preset', type: 'model_preset', category: 'Model Presets', uses: 312, lastUsed: '1h ago', tags: ['gpt-4o', 'balanced', 'default'], description: 'Temperature 0.7, Top-P 0.9, balanced creativity/accuracy' },
  { id: 'a8', name: 'Weekday 2pm EST Rule', type: 'publishing_rule', category: 'Publishing Rules', uses: 45, lastUsed: '1d ago', tags: ['schedule', 'optimal', 'weekday'], description: 'Publish on Tue/Thu at 2pm EST for maximum initial views' },
  { id: 'a9', name: 'SEO Title Optimizer', type: 'automation', category: 'Automation Blocks', uses: 198, lastUsed: '2h ago', tags: ['seo', 'title', 'keywords'], description: 'Automated title optimization with keyword density check' },
  { id: 'a10', name: 'YouTube Data API v3', type: 'connector', category: 'API Connectors', uses: 890, lastUsed: 'now', tags: ['youtube', 'api', 'data'], description: 'YouTube Data API connector for uploads, analytics, and metadata' },
  { id: 'a11', name: 'TechVision Brand Kit', type: 'asset', category: 'Channel Assets', uses: 234, lastUsed: '3h ago', tags: ['brand', 'techvision', 'colors'], description: 'Full brand kit: colors, fonts, logo variants, style guide' },
  { id: 'a12', name: 'Retention Hook Module', type: 'component', category: 'Reusable Components', uses: 167, lastUsed: '1h ago', tags: ['retention', 'hook', 'reusable'], description: 'Modular retention hook that can be inserted at any timestamp' },
];

export const mockMemory: MemoryEntry[] = [
  { id: 'm1', type: 'learning', source: 'Analytics Agent', content: 'Videos with hooks under 5 seconds have 23% better average retention across all channels.', confidence: 0.94, created: '3d ago', accesses: 45, tags: ['retention', 'hooks', 'performance'] },
  { id: 'm2', type: 'mistake', source: 'Thumbnail Agent', content: 'Using red backgrounds decreased CTR by 8% for tech content on the TechVision channel.', confidence: 0.87, created: '1w ago', accesses: 23, tags: ['thumbnail', 'color', 'ctr'] },
  { id: 'm3', type: 'pattern', source: 'Learning Agent', content: '3-act narrative structure works best for educational content over 10 minutes. List-format preferred under 8 minutes.', confidence: 0.91, created: '2w ago', accesses: 67, tags: ['narrative', 'format', 'duration'] },
  { id: 'm4', type: 'success', source: 'Publisher', content: 'Publishing at 2pm EST on Tuesdays gives 34% more initial views than other time slots for our audience.', confidence: 0.96, created: '1m ago', accesses: 89, tags: ['publishing', 'schedule', 'timing'] },
  { id: 'm5', type: 'learning', source: 'SEO Agent', content: 'Titles with numbers (e.g., "10 Tips") consistently outperform question-format titles by 18% in CTR.', confidence: 0.89, created: '5d ago', accesses: 34, tags: ['seo', 'title', 'ctr'] },
  { id: 'm6', type: 'pattern', source: 'Competitor Analyzer', content: 'Top competitor uploads 3x/week with 82% tutorial content and 18% reaction/commentary.', confidence: 0.92, created: '4d ago', accesses: 12, tags: ['competitor', 'frequency', 'format'] },
  { id: 'm7', type: 'mistake', source: 'Script Writer', content: 'Scripts over 2500 words for 10-min videos result in rushed delivery. Optimal: 1800-2200 words.', confidence: 0.88, created: '2w ago', accesses: 56, tags: ['script', 'length', 'pacing'] },
  { id: 'm8', type: 'success', source: 'Image Director', content: 'Midjourney v6 with --style raw produces best results for tech explainer B-roll. DALL-E better for thumbnails.', confidence: 0.85, created: '1w ago', accesses: 78, tags: ['visual', 'model', 'quality'] },
];

export const mockActivity: ActivityEvent[] = [
  { id: 'ev1', type: 'agent', message: 'Script Writer completed script for "Morning Routine for Devs"', time: '12m ago', agentId: 'script-writer', variant: 'success' },
  { id: 'ev2', type: 'agent', message: 'Trend Researcher identified 3 new trending AI topics', time: '18m ago', agentId: 'trend-researcher', variant: 'info' },
  { id: 'ev3', type: 'pipeline', message: 'Pipeline "Machine Learning 101" failed at content phase', time: '45m ago', variant: 'error' },
  { id: 'ev4', type: 'agent', message: 'Publisher uploaded "Python for Beginners Ep.4" to YouTube', time: '2h ago', agentId: 'publisher', variant: 'success' },
  { id: 'ev5', type: 'agent', message: 'Thumbnail Agent generated 4 A/B variants for "Crypto Market"', time: '3h ago', agentId: 'thumbnail-agent', variant: 'info' },
  { id: 'ev6', type: 'agent', message: 'Analytics Agent detected CTR anomaly on "Python Basics"', time: '4h ago', agentId: 'analytics-agent', variant: 'warning' },
  { id: 'ev7', type: 'system', message: 'Learning Agent model retrained with latest performance data', time: '5h ago', agentId: 'learning-agent', variant: 'info' },
  { id: 'ev8', type: 'system', message: 'System performed automatic database backup', time: '6h ago', variant: 'info' },
  { id: 'ev9', type: 'agent', message: 'SEO Agent optimized metadata for 5 pending videos', time: '7h ago', agentId: 'seo-agent', variant: 'success' },
  { id: 'ev10', type: 'pipeline', message: 'Pipeline "10 React Tips" entered production phase', time: '8h ago', variant: 'info' },
];

export const systemMetrics = {
  agentsOnline: 12,
  agentsTotal: 14,
  activePipelines: 5,
  completedToday: 23,
  failedToday: 2,
  costToday: 82.30,
  apiUsagePercent: 78,
  estimatedRevenue: 342,
  systemUptime: 99.7,
  totalQueueItems: 9,
};
