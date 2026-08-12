# Atlas Voice Architecture

Production-oriented multilingual TTS layer for Atlas. Provider-independent, registry-driven, server-side only.

## What already existed (audit)

| Area | Finding |
|------|---------|
| `server/atlas-live/voice.js` | Provider **stubs** (ElevenLabs, OpenAI Realtime, Azure, Google, local XTTS, mock). No real TTS HTTP calls. |
| Atlas Live HTTP | `ALLOWED_VOICE_MODES = ['text-only']` — real stream TTS closed. |
| `server/audio-studio/*` | User audio **analysis/processing** (ffmpeg, STT via OpenAI), not Atlas speaking. |
| `server/openai-client.js` | Transcription (`/v1/audio/transcriptions`) only. |
| Frontend | No TTS player; Settings/mockData mention ElevenLabs as product copy. |
| `knowledge/.../voice-profile.json` | **Text** author voice (Lara writing style), not audio. |
| Env | No `ELEVENLABS_*` in `.env.example` before this work. |

This layer does **not** replace Atlas Live radio stubs or Audio Studio. It adds `/api/voice/*` as the shared synthesis surface. Live can bind to it later without forking UI.

## Layout

```
server/voice/
  config.js          # ATLAS_TTS_PROVIDER, quotas, timeouts
  registry.js        # logical voices (lara, …)
  providers/         # elevenlabs | openai | mock
  synthesize.js      # validate → cache → provider → usage
  cache.js           # private hash cache under data/voice-cache/
  usage.js           # request/char quotas + telemetry (no full text)
  routes.js          # HTTP
  errors.js          # normalized error codes

voice-assets/
  source/lara-master.mp3   # IMMUTABLE master copy
  processed/               # regenerable WAVs + inspect JSON
  registry/voices.json     # plug-in registry

scripts/audio/
  inspect-voice.mjs
  prepare-reference.mjs
```

## Request model

```http
POST /api/voice/synthesize
{
  "text": "Merhaba.",
  "voice": "lara",
  "language": "tr-TR"
}
```

English:

```json
{ "text": "Welcome to Atlas.", "voice": "lara", "language": "en-US" }
```

Default response is raw `audio/mpeg` (not JSON). Optional JSON+base64 via `Accept: application/json` and `returnJson: true`.

```http
GET /api/voice/voices
GET /api/voice/health
```

Public responses never include API keys or provider voice IDs.

## Provider selection

```bash
ATLAS_TTS_PROVIDER=elevenlabs   # default
# ATLAS_TTS_PROVIDER=openai
# ATLAS_TTS_PROVIDER=mock       # tests / offline
ATLAS_TTS_DRY_RUN=true          # refuse paid network calls
```

Business logic calls `synthesizeSpeech()` only — never ElevenLabs URLs directly.

## Lara identity (TR + EN)

Logical voice `lara` supports `tr-TR`, `en-US`, `en-GB`.

- Prefer one ElevenLabs multilingual clone: `ELEVENLABS_LARA_VOICE_ID`
- Optional per-language overrides: `ELEVENLABS_LARA_VOICE_ID_TR`, `ELEVENLABS_LARA_VOICE_ID_EN`

Registry resolves provider IDs; the app only selects `voice=lara` + `language=…`.

Language is forwarded to the provider (`language_code` / instructions). Turkish characters are preserved in text; English requests do not apply Turkish pronunciation hints.

## Security & cost

- Keys: server env only (`.env` gitignored)
- Rate limit: lower for anonymous sessions
- Daily request + character quotas
- Max text length (`ATLAS_TTS_MAX_TEXT_LENGTH`)
- Provider timeout + abort
- Cache key = hash(text+voice+language+provider+model+settingsVersion); cache under `data/voice-cache/` (not public)
- Telemetry logs counts/latency/codes — **not** full user text

## Frontend

`VoicePlaybackControls` + `useVoicePlayback` — play / pause / replay / loading / error. **No autoplay**; requires user gesture (iOS Safari).

## Master asset

`voice-assets/source/lara-master.mp3` is a copy of the founder master. Do not overwrite or re-encode in place. Derivatives via `npm run voice:prepare`.

## Error codes

`empty_text` · `text_too_long` · `voice_not_found` · `voice_not_configured` · `language_not_supported` · `provider_unavailable` · `provider_timeout` · `quota_exceeded` · `rate_limited` · `synthesis_failed`
