// ═══════════════════════════════════════════════════════════════════════
// Arsenal Store Service
//
// WHY THIS EXISTS:
// The old Arsenal page rendered a flat static array from mockData.
// This service turns the Arsenal into a shared intelligence layer:
//   1. Every agent queries templates before generating content
//   2. Usage counts track which assets are most effective
//   3. The store is the single source of truth — no duplicated prompts
//
// ARCHITECTURAL DECISION:
// In-memory Map for now, but the interface is designed for a future
// persistence layer (IndexedDB → PostgreSQL). The get/query pattern
// means we can add caching and invalidation without UI changes.
// ═══════════════════════════════════════════════════════════════════════

import type { ArsenalCategory, ArsenalAsset } from '../types/pipeline';

// ── Seed Data ─────────────────────────────────────────────────────────
// These are the production templates that agents actually use.
const SEED_ASSETS: ArsenalAsset[] = [
  {
    id: 'tpl-hook-controversy',
    name: 'Controversy Hook Template',
    category: 'prompt_templates',
    content: 'Open with a bold, slightly controversial statement that challenges a common belief in the niche. Format: "[Unexpected claim]… and here\'s the proof." Tone: confident, urgent, scroll-stopping.',
    tags: ['hook', 'controversy', 'shorts', 'retention'],
    uses: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'tpl-hook-fear',
    name: 'Fear/Urgency Hook Template',
    category: 'prompt_templates',
    content: 'Open with a fear-based statement that creates urgency. Format: "[Thing they care about] is already [happening/gone]… and most people don\'t know." Tone: serious, fast, no fluff.',
    tags: ['hook', 'fear', 'urgency', 'shorts'],
    uses: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'tpl-shorts-structure',
    name: 'Shorts 5-Act Structure',
    category: 'story_templates',
    content: 'Structure: [HOOK 0-3s] → [CONTEXT 3-8s] → [EVIDENCE 8-18s] → [TENSION 18-28s] → [PAYOFF+CTA 28-42s]. Total: 30-45 seconds. Word count: 240-300 words. Pacing: 4-4.5 words/second.',
    tags: ['shorts', 'structure', 'narrative', '5-act'],
    uses: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'tpl-thumb-split',
    name: 'Split Frame Thumbnail',
    category: 'thumbnail_templates',
    content: 'Composition: split the frame into two halves. Left: human subject with strong emotion. Right: opposing concept (AI, danger, opportunity). Bold text overlay in yellow/white. High contrast. Faces must be readable at 120px height.',
    tags: ['thumbnail', 'split-frame', 'high-ctr'],
    uses: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'tpl-brand-techvision',
    name: 'TechVision AI Brand Rules',
    category: 'brand_rules',
    content: 'Voice: authoritative, fast-paced, no filler words. Visual style: dark backgrounds, blue/cyan accents, cinematic. Target audience: tech professionals 25-40. Content pillars: AI, programming, tech careers. Never: clickbait without substance, political opinions, personal attacks.',
    tags: ['brand', 'techvision', 'voice', 'style'],
    uses: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'tpl-visual-cinematic',
    name: 'Cinematic Dark Style',
    category: 'visual_styles',
    content: 'Visual direction: dark, moody backgrounds. Color grading: blue/orange cinematic split toning. Lighting: dramatic side lighting with deep shadows. Camera: shallow depth of field when faces present. Text overlays: clean sans-serif, white or yellow on dark. Negative prompts: no bright backgrounds, no cartoon style, no watermarks.',
    tags: ['visual', 'cinematic', 'dark', 'moody'],
    uses: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'tpl-publish-optimal',
    name: 'Optimal Publishing Preset',
    category: 'publishing_presets',
    content: 'Schedule: Tuesday or Thursday, 11am-1pm EST. Cross-post: YouTube Shorts → TikTok → Instagram Reels (same day, 2-hour gaps). Community post: 2 hours before upload. Pin comment: engagement question. Monitor: first-hour CTR, swap title if below 4%.',
    tags: ['publishing', 'schedule', 'cross-post'],
    uses: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'tpl-workflow-shorts',
    name: 'Shorts Production Workflow',
    category: 'workflow_templates',
    content: 'Pipeline: Topic Discovery → Script Writing → Visual Prompts → Thumbnail Brief → SEO Metadata → Export Package. Each step feeds output to next. Parallel where possible: thumbnail + SEO can run concurrently after script. Quality gate: script must score 8+ before proceeding.',
    tags: ['workflow', 'shorts', 'pipeline'],
    uses: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
];

// ── Service ───────────────────────────────────────────────────────────
export class ArsenalStoreService {
  private assets: Map<string, ArsenalAsset>;

  constructor() {
    this.assets = new Map();
    SEED_ASSETS.forEach((a) => this.assets.set(a.id, a));
  }

  get(id: string): ArsenalAsset | undefined {
    return this.assets.get(id);
  }

  getByCategory(category: ArsenalCategory): ArsenalAsset[] {
    return Array.from(this.assets.values()).filter((a) => a.category === category);
  }

  getByTag(tag: string): ArsenalAsset[] {
    return Array.from(this.assets.values()).filter((a) => a.tags.includes(tag));
  }

  search(query: string): ArsenalAsset[] {
    const q = query.toLowerCase();
    return Array.from(this.assets.values()).filter(
      (a) => a.name.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q)) || a.content.toLowerCase().includes(q)
    );
  }

  // Record that an asset was used by an agent — tracks effectiveness
  recordUsage(id: string): void {
    const asset = this.assets.get(id);
    if (asset) {
      asset.uses++;
      asset.updatedAt = Date.now();
    }
  }

  add(asset: Omit<ArsenalAsset, 'id' | 'uses' | 'createdAt' | 'updatedAt'>): ArsenalAsset {
    const newAsset: ArsenalAsset = {
      ...asset,
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      uses: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.assets.set(newAsset.id, newAsset);
    return newAsset;
  }

  getAll(): ArsenalAsset[] {
    return Array.from(this.assets.values());
  }
}

export const arsenalStore = new ArsenalStoreService();
