# ATLAS v7.1 — Persistent Asset Storage

## Setup

```bash
npm install
cp .env.example .env        # add OPENAI_API_KEY=sk-...
node server/index.js         # Terminal 1 — backend :3001
npm run dev                  # Terminal 2 — frontend :5173
```

## What's new in v7.1

Generated content is now **persisted to disk**. After every successful pipeline run, 5 files are saved to a timestamped folder:

```
server/generated/
  2026-07-03_14-22-18/
    script.md
    visual-prompts.md
    thumbnail-brief.md
    seo-package.md
    final-package.json
```

The Asset Library page loads these files from the backend and provides real downloads.

## Storage flow

```
Pipeline completes
  → pipeline-engine.ts assembles ShortsPackage
  → POST /api/assets/save { package: {...} }
  → server creates server/generated/YYYY-MM-DD_HH-MM-SS/
  → writes 5 files (script.md, visual-prompts.md, thumbnail-brief.md, seo-package.md, final-package.json)
  → verifies each file exists on disk with fs.existsSync()
  → returns { folder, files: [{ name, size, path }] }
  → pipeline logs: "✓ Saved 5 files to 2026-07-03_14-22-18/"
  → if any write fails → pipeline marked as FAILED

Asset Library page
  → GET /api/assets
  → server reads server/generated/ directory
  → returns productions[] with folder, topic, files[]
  → UI renders real productions sorted newest-first

Download button
  → GET /api/assets/:folder/:file/download
  → server reads physical file from disk
  → returns with Content-Disposition: attachment and correct Content-Type
  → browser downloads the actual file (not index.html)
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/assets/save` | Save pipeline output to disk |
| `GET` | `/api/assets` | List all generated productions |
| `GET` | `/api/assets/:folder/:file/download` | Download a specific file |
| `POST` | `/api/ai/complete` | Proxy to OpenAI (unchanged) |
| `GET` | `/api/ai/health` | Backend health check (unchanged) |
