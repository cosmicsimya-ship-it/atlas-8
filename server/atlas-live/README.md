# ATLAS LIVE — AI Radio Host Engine

> A living late-night radio presenter.  
> **Not** a chatbot. **Not** text-to-speech alone. **Not** a podcast player.

Atlas Live continuously creates a natural radio atmosphere for Telegram Voice Chat (later Web and Mobile). The listener should forget they are listening to an AI.

---

## Module layout

```
server/atlas-live/
  index.js             Public barrel
  engine.js            Session orchestrator (start / tick / events)
  scheduler.js         Organic speak / silence / music timing
  presenter.js         Content selection + radio pacing
  topics.js            Content-block catalog
  music-controller.js  Independent music layer + speak windows
  voice.js             Provider interfaces (ElevenLabs, OpenAI Realtime, …)
  transitions.js       Soft edges between speech / music / silence
  personality.js       Calm, warm, slightly mysterious host
  history.js           Anti-repetition memory
  prompts.js           Optional LLM polish + event cue fallbacks
  schema.js            Contracts, versions, makers
  README.md            This file
```

**Isolation:** nothing in this folder is imported by the chat pipeline, astrology flows, or Express routes yet. Existing Atlas behavior is unchanged.

---

## Quick start

```js
import { createAtlasLiveEngine } from './server/atlas-live/index.js';

const live = createAtlasLiveEngine({
  autoLoop: false,          // call tick() yourself (tests / sinks)
  voiceProvider: 'mock',    // timing-only until a TTS adapter is bound
  onEvent: (type, payload) => console.log(type, payload),
});

await live.start();

// Drive the show one beat at a time
for (let i = 0; i < 8; i++) {
  const step = await live.tick();
  console.log(step.beat?.kind, step.beat?.segment?.text ?? step.beat?.reason);
}

// Soft live events (never hard-cuts mid-song)
live.setListenerCount(100);
live.pushEvent('midnight', {}, 'high');
live.pushEvent('ramadan', {}, 'normal');

await live.stop();
```

Smoke test:

```bash
npm run test:atlas-live
```

---

## Presentation style

Speech is **cues**, not paragraphs:

```
Good evening...

You're listening to Atlas Live.

I'm Atlas.

Tonight feels quieter than usual...

Let's stay together for a while.
```

Rules enforced by personality + prompts + topic seeds:

- Never dump information
- Never lecture or preach
- Never sound like Wikipedia
- Do not constantly talk about astrology / planets
- Silence is a first-class beat
- Humor is occasional and light

---

## Content blocks

The presenter randomly chooses weighted blocks by daypart, while `history` cools recent categories.

Categories include: morning/night greetings, space & history facts, psychology, listener questions, reflections, philosophy, book/movie picks, music transitions, silence, weather mood, moon / constellation (rare), ancient civilization, science & tech curiosity, paradoxes, thought experiments, patterns, human behavior, creative challenges, memory exercises, brain teasers, quotes, life observations, invisible details.

Extend at runtime:

```js
import { registerContentBlock } from './server/atlas-live/index.js';

registerContentBlock({
  id: 'custom_01',
  category: 'life_observation',
  title: 'Custom',
  dayparts: ['night'],
  weight: 1.2,
  cues: ['A small thing...', 'Worth noticing.'],
});
```

---

## Scheduler

`createScheduler()` decides organic actions:

| Action | Role |
|--------|------|
| `speak` | Presenter beat |
| `silence` | Held quiet |
| `music` | Music bed |
| `transition` | Soft edge |
| `listen_window` | Future listener interaction timing |

Durations are jittered. Night favors silence; morning favors a bit more presence. The same action is less likely twice in a row.

---

## Music layer

Music is **independent**. Atlas may speak only in:

- fade-in
- fade-out
- no music / paused

Mid-song `playing` → `canSpeak: false`. The engine waits or requests a talk window (fade-out) — it does **not** hard-interrupt tracks.

```js
live.music.enqueue({
  id: 'track_1',
  title: 'Night bed',
  durationMs: 180_000,
});
live.music.play();
```

---

## Voice providers (uncoupled)

| Id | Factory |
|----|---------|
| `mock` | Timing only (default) |
| `elevenlabs` | Stub — bind SDK later |
| `openai_realtime` | Stub |
| `azure_tts` | Stub |
| `google_tts` | Stub |
| `local_xtts` | Stub |

```js
import { createVoiceFacade } from './server/atlas-live/index.js';

const voice = createVoiceFacade({ provider: 'elevenlabs' });
// Engine falls back to mock until adapters return ok:true audio
```

Env hooks (future adapters): `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `OPENAI_API_KEY`, `AZURE_SPEECH_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `LOCAL_XTTS_URL`.

---

## Live events

```js
live.pushEvent('listener_joined', { name: 'Ada' }, 'low');
live.pushEvent('milestone_listeners', { count: 100 }, 'high');
live.pushEvent('midnight');
live.pushEvent('sunrise');
live.pushEvent('friday_evening');
live.pushEvent('ramadan');
live.pushEvent('eid');
live.pushEvent('astronomical_event', { name: 'Perseids' }, 'normal');
```

`setListenerCount(n)` auto-emits join/leave and 100-listener milestones.

Interrupt policy: events **wait for speak windows** when music is mid-track. Never aggressive cuts.

---

## Engine API

| Method | Description |
|--------|-------------|
| `start()` / `stop()` / `pause()` / `resume()` | Session lifecycle |
| `tick()` | Advance one beat (or auto via `autoLoop: true`) |
| `pushEvent(type, payload?, priority?)` | Queue soft on-air event |
| `setListenerCount(n)` | Update room size |
| `injectCues(cues[], category?)` | Manual producer line |
| `snapshot()` | Full runtime state |
| `music` / `voice` / `history` / `scheduler` / `presenter` | Subsystems |

---

## Channel wiring (future)

This engine is **computation + pacing**. Transport sinks are separate:

1. **Telegram Voice Chat** — stream synthesized audio / music into the group call
2. **Web** — WebAudio / MediaStream
3. **Mobile** — native player bridge

Suggested glue (not shipped yet): `server/atlas-live-flow.js` + a voice-chat adapter. Do not wire into `atlas-message-service` text chat.

Optional LLM polish: pass `polishScript(cues, meta) => Promise<string[]>` using `buildPresenterSystemPrompt()` / `buildPolishUserPrompt()` from `prompts.js`. The engine runs fully without an LLM.

---

## Quality bar

Closer to a premium Spotify radio host or calm late-night FM presenter than a bot.

Companionship. Atmosphere. Curiosity. Silence when needed.
