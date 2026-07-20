export interface AgentSpec {
  id: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  colorHex: string;
  phase: number;
  phaseName: string;
  description: string;
  inputs: string[];
  outputs: string[];
  memory: { type: string; description: string }[];
  tools: string[];
  llmModel: string;
  errorHandling: string[];
  scalability: string[];
  kpis: string[];
}

export const agents: AgentSpec[] = [
  {
    id: "trend-researcher",
    name: "Trend Researcher",
    role: "Intelligence Gathering",
    icon: "TrendingUp",
    color: "blue",
    colorHex: "#3b82f6",
    phase: 1,
    phaseName: "Research & Discovery",
    description:
      "Continuously monitors YouTube trending feeds, Google Trends, social media platforms, and news APIs to identify emerging content opportunities before they peak.",
    inputs: [
      "YouTube Trending API feeds (regional + global)",
      "Google Trends real-time data",
      "Twitter/X trending topics & hashtag velocity",
      "Reddit rising posts (target subreddits)",
      "News API aggregated headlines",
      "Historical trend performance database",
      "Niche-specific keyword watchlists",
    ],
    outputs: [
      "Trend Report JSON (topic, velocity, confidence score, decay estimate)",
      "Trend category classification (evergreen vs viral vs seasonal)",
      "Time-sensitivity rating (1-10)",
      "Estimated audience size & demographic overlay",
      "Related keyword clusters",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Active trend queue with TTL-based expiry; real-time velocity tracking" },
      { type: "Long-term (PostgreSQL)", description: "Historical trend archive with outcome tracking; pattern recognition training data" },
      { type: "Vector Store (Pinecone)", description: "Semantic embeddings of past trends for similarity matching and déjà-vu detection" },
    ],
    tools: ["YouTube Data API v3", "Google Trends API", "Twitter API v2", "Reddit API", "NewsAPI", "Custom web scrapers"],
    llmModel: "GPT-4o (analysis) + Claude 3.5 (summarization)",
    errorHandling: [
      "API rate limit → exponential backoff with jitter + failover to cached data",
      "Data staleness → timestamp validation; reject data older than configurable TTL",
      "Trend false positive → cross-reference minimum 3 sources before flagging",
      "Service outage → circuit breaker pattern; degrade gracefully to historical predictions",
    ],
    scalability: [
      "Horizontal: Multiple instances per region/niche",
      "Async: Event-driven via Kafka topic partitions",
      "Caching: Redis cluster with read replicas for hot trend data",
    ],
    kpis: ["Trend detection lead time (hours before peak)", "Prediction accuracy %", "False positive rate"],
  },
  {
    id: "topic-discoverer",
    name: "Topic Discoverer",
    role: "Content Ideation",
    icon: "Lightbulb",
    color: "yellow",
    colorHex: "#eab308",
    phase: 1,
    phaseName: "Research & Discovery",
    description:
      "Synthesizes trend data with channel identity and audience preferences to generate ranked, actionable video topic ideas with strategic rationale.",
    inputs: [
      "Trend Reports from Trend Researcher agent",
      "Channel brand guidelines & content pillars",
      "Audience persona profiles",
      "Content gap analysis results",
      "Past video performance data (views, CTR, retention)",
      "Competitor content mapping",
      "Seasonal/calendar event schedule",
    ],
    outputs: [
      "Ranked Topic Proposals (title, angle, format, urgency)",
      "Content brief with strategic rationale",
      "Estimated performance range (views, engagement)",
      "Content format recommendation (short, long, series)",
      "Audience-topic fit score",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Active ideation queue; in-progress topic evaluations" },
      { type: "Long-term (PostgreSQL)", description: "Topic history with actual vs predicted performance; ideation patterns" },
      { type: "Vector Store (Pinecone)", description: "Semantic topic embeddings for uniqueness scoring and cannibalization detection" },
    ],
    tools: ["YouTube Analytics API", "AnswerThePublic API", "Ahrefs/SEMrush API", "Internal content calendar"],
    llmModel: "GPT-4o (creative ideation) + Claude 3.5 (strategic analysis)",
    errorHandling: [
      "Topic saturation → automatic pivot to adjacent niches with audience overlap",
      "Low confidence scores → request additional data from Trend Researcher",
      "Content cannibalization → semantic similarity check against existing library",
      "Approval timeout → auto-escalate to human review queue after 4 hours",
    ],
    scalability: [
      "Parallel ideation across multiple channels/niches",
      "Batch processing for content calendar planning",
      "Priority queue for time-sensitive viral opportunities",
    ],
    kpis: ["Topic-to-publish conversion rate", "Performance prediction accuracy", "Ideation throughput (topics/day)"],
  },
  {
    id: "competitor-analyst",
    name: "Competitor Analyst",
    role: "Market Intelligence",
    icon: "Crosshair",
    color: "red",
    colorHex: "#ef4444",
    phase: 1,
    phaseName: "Research & Discovery",
    description:
      "Performs deep competitive intelligence on rival channels, analyzing content strategies, upload patterns, audience overlap, and identifying exploitable gaps.",
    inputs: [
      "Competitor channel IDs and URLs",
      "Competitor video metadata (titles, descriptions, tags)",
      "Competitor upload schedules and frequency",
      "Competitor engagement metrics (likes, comments, shares)",
      "Competitor thumbnail styles and patterns",
      "Social Blade / VidIQ data feeds",
    ],
    outputs: [
      "Competitor Strategy Report (content mix, posting cadence, growth trajectory)",
      "Content gap matrix (topics they miss)",
      "Winning format analysis (what works for them)",
      "Audience overlap estimation",
      "Threat assessment and opportunity scoring",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Active monitoring queue; recent competitor uploads" },
      { type: "Long-term (PostgreSQL)", description: "Competitor profiles with historical tracking; strategy evolution timeline" },
      { type: "Vector Store (Pinecone)", description: "Competitor content embeddings for similarity and gap detection" },
    ],
    tools: ["YouTube Data API v3", "Social Blade API", "VidIQ API", "Custom web scrapers", "Wayback Machine API"],
    llmModel: "GPT-4o (strategic analysis) + Gemini 1.5 Pro (large context video analysis)",
    errorHandling: [
      "Competitor channel private/deleted → graceful degradation; flag for manual review",
      "API quota exhaustion → priority-based scheduling; critical competitors first",
      "Data inconsistency → cross-validate across multiple data sources",
      "Rapid competitor pivot → trigger alert to Topic Discoverer for strategy adjustment",
    ],
    scalability: [
      "Configurable competitor pools per channel/niche",
      "Background continuous monitoring with event-driven alerts",
      "Tiered analysis depth (daily quick scan vs weekly deep dive)",
    ],
    kpis: ["Gap identification accuracy", "Competitive response time", "Actionable insight generation rate"],
  },
  {
    id: "script-writer",
    name: "Script Writer",
    role: "Content Creation",
    icon: "FileText",
    color: "purple",
    colorHex: "#a855f7",
    phase: 2,
    phaseName: "Content Production",
    description:
      "Generates broadcast-quality scripts optimized for YouTube retention, incorporating hooks, pattern interrupts, CTAs, and platform-specific engagement techniques.",
    inputs: [
      "Approved Topic Brief from Topic Discoverer",
      "Channel voice/tone guidelines",
      "Target video duration",
      "SEO keyword targets from SEO Agent",
      "Storytelling structure recommendation",
      "Audience retention data from Analytics Agent",
      "Competitor script patterns (what to differentiate from)",
    ],
    outputs: [
      "Full video script with timestamps",
      "Section-level retention predictions",
      "Hook variations (3-5 options)",
      "B-roll and visual cue markers",
      "Spoken word count and estimated duration",
      "CTA placement recommendations",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Active script drafts; revision history within session" },
      { type: "Long-term (PostgreSQL)", description: "Script archive with performance correlation; successful pattern library" },
      { type: "Vector Store (Pinecone)", description: "Script segment embeddings for style consistency and plagiarism detection" },
    ],
    tools: ["Grammarly API", "Hemingway readability scorer", "Custom retention prediction model", "Plagiarism checker"],
    llmModel: "Claude 3.5 Sonnet (primary writing) + GPT-4o (hook generation) + Gemini (fact-checking)",
    errorHandling: [
      "Writer's block → fallback to template-based generation with fill-in-the-blanks",
      "Off-brand output → automatic brand voice scoring; reject below threshold",
      "Factual errors → multi-model fact-checking pipeline with source citations",
      "Duration mismatch → automatic expansion/compression with quality preservation",
    ],
    scalability: [
      "Parallel script generation for multiple topics",
      "Version branching for A/B script testing",
      "Template library for rapid production of recurring formats",
    ],
    kpis: ["Script-to-approval rate", "Average revision cycles", "Retention correlation score"],
  },
  {
    id: "storyteller",
    name: "Storyteller",
    role: "Narrative Architecture",
    icon: "BookOpen",
    color: "pink",
    colorHex: "#ec4899",
    phase: 2,
    phaseName: "Content Production",
    description:
      "Engineers narrative structures that maximize emotional engagement and retention. Applies proven storytelling frameworks adapted for YouTube's unique consumption patterns.",
    inputs: [
      "Raw script draft from Script Writer",
      "Target emotional arc (inspire, educate, entertain, persuade)",
      "Audience psychographic profiles",
      "Retention curve data from similar videos",
      "Video format (essay, list, story, tutorial, reaction)",
      "Brand narrative pillars",
    ],
    outputs: [
      "Narrative structure blueprint (acts, beats, turning points)",
      "Emotional intensity mapping per segment",
      "Pattern interrupt placement guide",
      "Cliffhanger and open loop positions",
      "Pacing recommendations (fast/slow segments)",
      "Revised script with narrative enhancements",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Active narrative sessions; emotional arc calculations" },
      { type: "Long-term (PostgreSQL)", description: "Narrative pattern library; framework effectiveness data" },
      { type: "Vector Store (Pinecone)", description: "Story beat embeddings for template matching and innovation tracking" },
    ],
    tools: ["Custom narrative analysis engine", "Sentiment analysis API", "Audience emotional response predictor"],
    llmModel: "Claude 3.5 Sonnet (narrative design) + GPT-4o (emotional mapping)",
    errorHandling: [
      "Flat emotional arc → automatic insertion of tension/release cycles",
      "Retention cliff predicted → restructure with additional hooks at risk points",
      "Narrative inconsistency → continuity checker with section cross-references",
      "Over-complexity → simplification pass with readability scoring",
    ],
    scalability: [
      "Modular narrative blocks for mix-and-match composition",
      "Format-specific narrative templates",
      "Multi-language narrative adaptation support",
    ],
    kpis: ["Retention curve improvement %", "Emotional engagement score", "Narrative coherence rating"],
  },
  {
    id: "visual-prompter",
    name: "Visual Prompt Generator",
    role: "Visual Direction",
    icon: "Palette",
    color: "cyan",
    colorHex: "#06b6d4",
    phase: 3,
    phaseName: "Visual Production",
    description:
      "Translates script content into detailed visual prompts for AI image/video generation tools, ensuring visual continuity and brand consistency across all frames.",
    inputs: [
      "Final script with visual cue markers",
      "Brand visual guidelines (colors, style, mood)",
      "Scene breakdown from Storyteller",
      "Reference image library",
      "Target visual style (cinematic, minimal, animated, etc.)",
      "Aspect ratio and resolution requirements",
    ],
    outputs: [
      "Scene-by-scene visual prompt sequences",
      "Negative prompt specifications",
      "Camera angle and movement directives",
      "Color grading and lighting instructions",
      "Character/object consistency tokens",
      "B-roll visual prompt library",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Active prompt session; visual consistency cache" },
      { type: "Long-term (PostgreSQL)", description: "Prompt template library; prompt-to-output quality mapping" },
      { type: "Vector Store (Pinecone)", description: "Visual prompt embeddings for style consistency and deduplication" },
    ],
    tools: ["Midjourney API", "DALL-E 3 API", "Stable Diffusion API", "Runway ML API", "Custom style transfer models"],
    llmModel: "GPT-4o Vision (visual analysis) + Claude 3.5 (prompt engineering)",
    errorHandling: [
      "Visual inconsistency → character/style reference anchoring with seed control",
      "Prompt rejection by model → automatic rephrasing with safety-compliant alternatives",
      "Quality below threshold → iterative refinement loop (max 5 iterations)",
      "Style drift → periodic recalibration against brand reference set",
    ],
    scalability: [
      "Batch prompt generation for full video in parallel",
      "Multi-model distribution (route by style/quality requirements)",
      "Prompt caching for recurring visual elements",
    ],
    kpis: ["Visual consistency score", "Prompt-to-output success rate", "Generation iterations per scene"],
  },
  {
    id: "thumbnail-creator",
    name: "Thumbnail Creator",
    role: "Click Optimization",
    icon: "Image",
    color: "orange",
    colorHex: "#f97316",
    phase: 3,
    phaseName: "Visual Production",
    description:
      "Designs high-CTR thumbnails using proven visual psychology principles, A/B testing data, and competitor analysis to maximize click-through rates.",
    inputs: [
      "Video title and topic",
      "Key emotional hook from Storyteller",
      "Brand thumbnail style guide",
      "Top-performing competitor thumbnails",
      "A/B test results from previous thumbnails",
      "Target audience demographic data",
      "YouTube search result visual context",
    ],
    outputs: [
      "3-5 thumbnail variants per video",
      "Thumbnail with text overlay specifications",
      "Predicted CTR score per variant",
      "A/B test recommendation",
      "Mobile vs desktop optimization versions",
      "Accessibility contrast compliance report",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Active design session; variant comparison cache" },
      { type: "Long-term (PostgreSQL)", description: "Thumbnail performance database; design pattern effectiveness tracking" },
      { type: "Vector Store (Pinecone)", description: "Thumbnail embeddings for uniqueness scoring and trend analysis" },
    ],
    tools: ["DALL-E 3 / Midjourney", "Figma API", "Custom CTR prediction model", "Color theory analyzer", "Face detection API"],
    llmModel: "GPT-4o Vision (design analysis) + DALL-E 3 (generation)",
    errorHandling: [
      "Low predicted CTR → automatic redesign with alternative visual strategies",
      "Brand guideline violation → automated compliance checker with fix suggestions",
      "Text readability failure → contrast/size auto-adjustment",
      "Similarity to competitor → uniqueness enforcer with visual differentiation",
    ],
    scalability: [
      "Parallel variant generation",
      "Template-based rapid production for series content",
      "Automated A/B rotation via YouTube API",
    ],
    kpis: ["Average CTR improvement", "A/B test win rate", "Design-to-approval cycle time"],
  },
  {
    id: "seo-optimizer",
    name: "SEO Optimizer",
    role: "Search Optimization",
    icon: "Search",
    color: "green",
    colorHex: "#22c55e",
    phase: 4,
    phaseName: "Optimization & Publishing",
    description:
      "Optimizes all discoverable elements for YouTube search, suggested videos, and browse features using keyword research, competitor analysis, and algorithm understanding.",
    inputs: [
      "Final video script and topic",
      "Target keyword research data",
      "Competitor SEO analysis",
      "YouTube autocomplete suggestions",
      "Search volume and competition metrics",
      "Channel authority score",
      "Video category and content classification",
    ],
    outputs: [
      "Optimized video title (with variants)",
      "SEO-optimized description (with timestamps, links, keywords)",
      "Tag set (primary, secondary, long-tail)",
      "Hashtag recommendations",
      "Category and language settings",
      "Closed caption / subtitle keywords",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Active optimization session; keyword ranking cache" },
      { type: "Long-term (PostgreSQL)", description: "Keyword performance history; ranking trajectory data" },
      { type: "Vector Store (Pinecone)", description: "Title/description embeddings for uniqueness and relevance scoring" },
    ],
    tools: ["YouTube Data API v3", "Google Keyword Planner", "VidIQ/TubeBuddy API", "Ahrefs API", "Custom SERP analyzer"],
    llmModel: "GPT-4o (keyword strategy) + Claude 3.5 (description writing)",
    errorHandling: [
      "Keyword cannibalization → automatic detection and differentiation strategy",
      "Over-optimization penalty risk → keyword density monitoring with caps",
      "Algorithm update → adaptive model retraining on latest ranking factors",
      "Low search volume → pivot to browse/suggested optimization strategy",
    ],
    scalability: [
      "Batch optimization for content calendar",
      "Multi-language SEO for international channels",
      "Real-time keyword rank monitoring and adjustment",
    ],
    kpis: ["Search ranking improvement", "Organic traffic %", "Keyword target hit rate"],
  },
  {
    id: "metadata-manager",
    name: "Metadata Manager",
    role: "Asset Coordination",
    icon: "Database",
    color: "indigo",
    colorHex: "#6366f1",
    phase: 4,
    phaseName: "Optimization & Publishing",
    description:
      "Centralizes and validates all video metadata, ensures cross-platform consistency, manages content tagging, and maintains the production knowledge graph.",
    inputs: [
      "SEO-optimized title, description, tags",
      "Video file metadata (duration, resolution, codec)",
      "Thumbnail file references",
      "Script and narrative metadata",
      "Content classification and ratings",
      "Licensing and rights information",
      "Cross-platform distribution settings",
    ],
    outputs: [
      "Validated metadata package (YouTube-ready)",
      "Cross-platform metadata variants (TikTok, Instagram, X)",
      "Content graph node (relationships to other videos)",
      "Archive manifest with versioning",
      "Compliance and policy check report",
      "Structured data / schema markup for embeds",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Active metadata assembly; validation queue" },
      { type: "Long-term (PostgreSQL)", description: "Complete content catalog; metadata version history" },
      { type: "Graph DB (Neo4j)", description: "Content relationship graph; topic clustering; series linkage" },
    ],
    tools: ["YouTube Data API v3", "FFprobe (media analysis)", "Custom metadata validator", "Content ID checker"],
    llmModel: "GPT-4o-mini (validation) + rule-based systems (compliance)",
    errorHandling: [
      "Missing required fields → block publishing; alert responsible agent",
      "Policy violation detected → automatic remediation or human escalation",
      "Metadata conflict → version comparison and resolution workflow",
      "Format incompatibility → automatic transcoding/adaptation",
    ],
    scalability: [
      "Centralized metadata service for multi-channel operations",
      "Event-driven validation pipeline",
      "Automated cross-platform adaptation",
    ],
    kpis: ["Metadata completeness score", "Policy compliance rate", "Cross-platform sync accuracy"],
  },
  {
    id: "publisher",
    name: "Publisher",
    role: "Distribution & Scheduling",
    icon: "Upload",
    color: "teal",
    colorHex: "#14b8a6",
    phase: 4,
    phaseName: "Optimization & Publishing",
    description:
      "Manages the end-to-end publishing workflow including optimal scheduling, multi-platform distribution, community post coordination, and premiere setup.",
    inputs: [
      "Validated metadata package from Metadata Manager",
      "Final video file (rendered and encoded)",
      "Thumbnail variants",
      "Publishing schedule and timezone data",
      "Audience online activity patterns",
      "Cross-platform distribution configuration",
      "Community post templates",
    ],
    outputs: [
      "Published video confirmation with URL",
      "Cross-platform post confirmations",
      "Community post / premiere announcements",
      "Publishing receipt with timestamps",
      "Distribution status dashboard update",
      "Notification trigger to Analytics Agent",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Publishing queue; upload progress tracking; retry state" },
      { type: "Long-term (PostgreSQL)", description: "Publishing history; schedule optimization data; platform status log" },
      { type: "Queue (RabbitMQ)", description: "Scheduled publish jobs with guaranteed delivery" },
    ],
    tools: ["YouTube Upload API", "TikTok API", "Instagram Graph API", "Twitter API v2", "Custom scheduling engine"],
    llmModel: "GPT-4o-mini (community posts) + rule-based (scheduling logic)",
    errorHandling: [
      "Upload failure → automatic retry with exponential backoff (max 5 attempts)",
      "API quota exceeded → queue with priority scheduling for next available window",
      "Processing stuck → timeout detection with alert and manual override option",
      "Schedule conflict → intelligent rescheduling with impact analysis",
    ],
    scalability: [
      "Multi-channel parallel publishing",
      "Queue-based guaranteed delivery",
      "Geographic distribution for optimal upload speeds",
    ],
    kpis: ["Publishing success rate", "Schedule adherence", "Time-to-live (upload to public)"],
  },
  {
    id: "analytics-tracker",
    name: "Analytics Tracker",
    role: "Performance Intelligence",
    icon: "BarChart3",
    color: "emerald",
    colorHex: "#10b981",
    phase: 5,
    phaseName: "Analysis & Optimization",
    description:
      "Provides real-time and historical performance tracking, generates actionable insights, identifies patterns, and feeds learning signals back to all upstream agents.",
    inputs: [
      "YouTube Analytics API real-time data",
      "Video performance metrics (views, watch time, CTR, retention)",
      "Audience demographics and behavior data",
      "Revenue and monetization metrics",
      "Comment sentiment analysis",
      "External traffic source data",
      "Social media engagement metrics",
    ],
    outputs: [
      "Real-time performance dashboard data",
      "Daily/weekly/monthly performance reports",
      "Anomaly detection alerts",
      "Audience growth analysis",
      "Content performance attribution",
      "Revenue forecasting",
      "Feedback signals to upstream agents (JSON events)",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Real-time metrics cache; alert state management" },
      { type: "Long-term (PostgreSQL + TimescaleDB)", description: "Complete analytics history; time-series performance data" },
      { type: "Data Warehouse (BigQuery)", description: "Aggregated analytics for cross-channel analysis and ML training" },
    ],
    tools: ["YouTube Analytics API", "Google Analytics 4", "Custom ML anomaly detector", "Sentiment analysis engine", "Revenue tracker"],
    llmModel: "GPT-4o (insight generation) + Custom ML models (prediction)",
    errorHandling: [
      "Data delay → graceful degradation with stale data indicators",
      "Metric anomaly → automatic investigation pipeline with root cause analysis",
      "API data inconsistency → multi-source validation and reconciliation",
      "Alert fatigue → intelligent alert suppression and aggregation",
    ],
    scalability: [
      "Time-series optimized storage (TimescaleDB)",
      "Real-time streaming pipeline (Kafka → Flink → Dashboard)",
      "Multi-channel aggregation with rollup tables",
    ],
    kpis: ["Insight actionability score", "Anomaly detection accuracy", "Report generation latency"],
  },
  {
    id: "performance-optimizer",
    name: "Performance Optimizer",
    role: "Continuous Improvement",
    icon: "Zap",
    color: "amber",
    colorHex: "#f59e0b",
    phase: 5,
    phaseName: "Analysis & Optimization",
    description:
      "The meta-learning agent that analyzes system-wide performance, identifies improvement opportunities, runs experiments, and evolves the entire pipeline's effectiveness over time.",
    inputs: [
      "Analytics reports from Analytics Tracker",
      "Agent performance metrics (all agents)",
      "A/B test results",
      "System latency and throughput data",
      "Cost and resource utilization metrics",
      "Industry benchmark data",
      "Feedback from human reviewers",
    ],
    outputs: [
      "Agent parameter adjustment recommendations",
      "Workflow optimization proposals",
      "A/B test design and execution plans",
      "System health report",
      "ROI analysis per content piece",
      "Strategic pivot recommendations",
      "Model fine-tuning triggers",
    ],
    memory: [
      { type: "Short-term (Redis)", description: "Active experiments; optimization job queue" },
      { type: "Long-term (PostgreSQL)", description: "Experiment history with outcomes; optimization trajectory" },
      { type: "ML Model Registry (MLflow)", description: "Model versions, performance metrics, deployment history" },
    ],
    tools: ["Custom A/B testing framework", "MLflow", "Prometheus/Grafana", "Cost analyzer", "Bayesian optimization engine"],
    llmModel: "GPT-4o (strategic analysis) + Custom RL models (parameter optimization)",
    errorHandling: [
      "Optimization regression → automatic rollback with previous best parameters",
      "Experiment contamination → isolation checker and invalidation protocol",
      "Resource budget exceeded → cost-aware optimization with hard limits",
      "Conflicting optimizations → priority-based resolution with impact scoring",
    ],
    scalability: [
      "Multi-armed bandit for parallel experimentation",
      "Automated model retraining pipelines",
      "Cross-channel optimization knowledge transfer",
    ],
    kpis: ["System-wide performance improvement %", "Experiment velocity", "Cost per production unit trend"],
  },
];

export interface WorkflowStep {
  phase: number;
  name: string;
  description: string;
  agents: string[];
  duration: string;
  parallel: boolean;
}

export const workflowSteps: WorkflowStep[] = [
  {
    phase: 1,
    name: "Research & Discovery",
    description: "Continuous environmental scanning, trend identification, competitive intelligence gathering, and topic ideation. Runs 24/7 in the background.",
    agents: ["trend-researcher", "topic-discoverer", "competitor-analyst"],
    duration: "Continuous (24/7) / Per-topic: 2-4 hours",
    parallel: true,
  },
  {
    phase: 2,
    name: "Content Production",
    description: "Script generation with narrative architecture, optimized for retention and engagement. Includes iterative revision cycles.",
    agents: ["script-writer", "storyteller"],
    duration: "4-8 hours per video",
    parallel: false,
  },
  {
    phase: 3,
    name: "Visual Production",
    description: "Visual asset generation including scene-by-scene imagery, B-roll, and thumbnail variants. Parallel processing with quality gates.",
    agents: ["visual-prompter", "thumbnail-creator"],
    duration: "2-6 hours per video",
    parallel: true,
  },
  {
    phase: 4,
    name: "Optimization & Publishing",
    description: "SEO optimization, metadata validation, cross-platform adaptation, and scheduled multi-platform publishing.",
    agents: ["seo-optimizer", "metadata-manager", "publisher"],
    duration: "1-2 hours per video",
    parallel: false,
  },
  {
    phase: 5,
    name: "Analysis & Optimization",
    description: "Continuous performance monitoring, insight generation, A/B testing, and system-wide optimization feedback loops.",
    agents: ["analytics-tracker", "performance-optimizer"],
    duration: "Continuous (real-time + scheduled)",
    parallel: true,
  },
];

export interface CommunicationLink {
  from: string;
  to: string;
  protocol: string;
  dataType: string;
  frequency: string;
}

export const communicationLinks: CommunicationLink[] = [
  { from: "trend-researcher", to: "topic-discoverer", protocol: "Kafka Event Stream", dataType: "TrendReport", frequency: "Real-time" },
  { from: "trend-researcher", to: "competitor-analyst", protocol: "Kafka Event Stream", dataType: "TrendAlert", frequency: "Real-time" },
  { from: "competitor-analyst", to: "topic-discoverer", protocol: "Kafka Event Stream", dataType: "CompetitorInsight", frequency: "On-analysis" },
  { from: "topic-discoverer", to: "script-writer", protocol: "REST API + Message Queue", dataType: "ApprovedTopicBrief", frequency: "On-approval" },
  { from: "script-writer", to: "storyteller", protocol: "gRPC (low latency)", dataType: "DraftScript", frequency: "Per-draft" },
  { from: "storyteller", to: "script-writer", protocol: "gRPC (low latency)", dataType: "NarrativeFeedback", frequency: "Per-revision" },
  { from: "script-writer", to: "visual-prompter", protocol: "Message Queue (RabbitMQ)", dataType: "FinalScript", frequency: "On-approval" },
  { from: "script-writer", to: "seo-optimizer", protocol: "Message Queue (RabbitMQ)", dataType: "FinalScript", frequency: "On-approval" },
  { from: "storyteller", to: "thumbnail-creator", protocol: "Message Queue (RabbitMQ)", dataType: "EmotionalHook", frequency: "On-finalization" },
  { from: "visual-prompter", to: "metadata-manager", protocol: "REST API", dataType: "VisualAssets", frequency: "On-completion" },
  { from: "thumbnail-creator", to: "metadata-manager", protocol: "REST API", dataType: "ThumbnailVariants", frequency: "On-completion" },
  { from: "seo-optimizer", to: "metadata-manager", protocol: "REST API", dataType: "SEOPackage", frequency: "On-optimization" },
  { from: "metadata-manager", to: "publisher", protocol: "Message Queue (RabbitMQ)", dataType: "PublishPackage", frequency: "On-validation" },
  { from: "publisher", to: "analytics-tracker", protocol: "Kafka Event Stream", dataType: "PublishEvent", frequency: "On-publish" },
  { from: "analytics-tracker", to: "performance-optimizer", protocol: "Kafka Event Stream", dataType: "PerformanceData", frequency: "Real-time" },
  { from: "performance-optimizer", to: "trend-researcher", protocol: "REST API", dataType: "OptimizationSignal", frequency: "Periodic" },
  { from: "performance-optimizer", to: "script-writer", protocol: "REST API", dataType: "ContentFeedback", frequency: "Periodic" },
  { from: "performance-optimizer", to: "thumbnail-creator", protocol: "REST API", dataType: "CTRFeedback", frequency: "Periodic" },
  { from: "performance-optimizer", to: "seo-optimizer", protocol: "REST API", dataType: "RankingFeedback", frequency: "Periodic" },
  { from: "analytics-tracker", to: "topic-discoverer", protocol: "Kafka Event Stream", dataType: "PerformanceInsight", frequency: "Daily" },
];

export interface RoadmapItem {
  phase: string;
  title: string;
  duration: string;
  items: string[];
  status: "completed" | "in-progress" | "planned" | "future";
}

export const roadmap: RoadmapItem[] = [
  {
    phase: "Phase 1",
    title: "Foundation & Core Infrastructure",
    duration: "Weeks 1-4",
    status: "completed",
    items: [
      "Set up Kubernetes cluster with Terraform IaC",
      "Deploy message broker infrastructure (Kafka + RabbitMQ)",
      "Establish PostgreSQL + Redis + Pinecone data layer",
      "Build agent framework with base classes and interfaces",
      "Implement centralized logging (ELK) and monitoring (Prometheus/Grafana)",
      "Create CI/CD pipeline with GitHub Actions",
      "Set up API gateway (Kong) with rate limiting and auth",
    ],
  },
  {
    phase: "Phase 2",
    title: "Research & Discovery Agents",
    duration: "Weeks 5-8",
    status: "completed",
    items: [
      "Deploy Trend Researcher with YouTube + Google Trends integration",
      "Build Topic Discoverer with ideation engine and scoring",
      "Implement Competitor Analyst with monitoring and gap detection",
      "Establish inter-agent communication protocols",
      "Build human-in-the-loop review dashboard",
      "Integration testing for Phase 1 agent cluster",
    ],
  },
  {
    phase: "Phase 3",
    title: "Content Production Agents",
    duration: "Weeks 9-14",
    status: "in-progress",
    items: [
      "Deploy Script Writer with multi-model pipeline",
      "Build Storyteller with narrative framework engine",
      "Implement iterative revision loop between Script Writer ↔ Storyteller",
      "Fine-tune LLMs on channel-specific voice data",
      "Build quality gate with automated scoring",
      "Create script template library and management system",
    ],
  },
  {
    phase: "Phase 4",
    title: "Visual Production & Publishing",
    duration: "Weeks 15-20",
    status: "planned",
    items: [
      "Deploy Visual Prompt Generator with multi-model routing",
      "Build Thumbnail Creator with CTR prediction model",
      "Implement SEO Optimizer with keyword tracking",
      "Deploy Metadata Manager with validation pipeline",
      "Build Publisher with multi-platform distribution",
      "End-to-end pipeline integration testing",
    ],
  },
  {
    phase: "Phase 5",
    title: "Analytics & Optimization Loop",
    duration: "Weeks 21-26",
    status: "planned",
    items: [
      "Deploy Analytics Tracker with real-time pipeline",
      "Build Performance Optimizer with A/B testing framework",
      "Implement feedback loops to all upstream agents",
      "Build executive dashboard with KPI tracking",
      "Set up automated model retraining pipelines",
      "Performance benchmarking and load testing",
    ],
  },
  {
    phase: "Phase 6",
    title: "Production Hardening & Scale",
    duration: "Weeks 27-32",
    status: "future",
    items: [
      "Multi-channel support with tenant isolation",
      "Geographic distribution and CDN optimization",
      "Advanced security audit and penetration testing",
      "Disaster recovery and business continuity setup",
      "Cost optimization and resource right-sizing",
      "Documentation, runbooks, and team training",
      "Production launch with staged rollout",
    ],
  },
];

export const techStack = {
  "Orchestration": ["Kubernetes (EKS)", "Terraform", "ArgoCD", "Helm"],
  "Messaging": ["Apache Kafka", "RabbitMQ", "Redis Pub/Sub"],
  "Data Layer": ["PostgreSQL 16", "Redis 7 Cluster", "Pinecone", "Neo4j", "TimescaleDB", "BigQuery"],
  "AI/ML": ["GPT-4o / 4o-mini", "Claude 3.5 Sonnet", "Gemini 1.5 Pro", "DALL-E 3", "Midjourney", "Stable Diffusion", "Custom fine-tuned models"],
  "Observability": ["Prometheus", "Grafana", "ELK Stack", "Jaeger (tracing)", "PagerDuty"],
  "API & Auth": ["Kong API Gateway", "OAuth 2.0 + JWT", "Vault (secrets)", "Rate limiting"],
  "CI/CD": ["GitHub Actions", "Docker", "ECR", "SonarQube", "Snyk"],
  "Languages": ["Python 3.12 (agents)", "TypeScript (dashboard)", "Go (high-perf services)", "SQL"],
};
