# Adding a Voice to Atlas

**Question:** Tomorrow we want a third voice — what do we do?

You should **not** fork React components or hard-code a new ElevenLabs ID in application code.

## Ideal flow

1. Create / obtain the provider voice (in ElevenLabs, OpenAI, …) — **manual, paid ops need founder approval**.
2. Add the logical voice to `voice-assets/registry/voices.json`.
3. Point provider IDs at env vars (never commit secrets).
4. Declare `languages` and set `enabled: true`.
5. Restart the API process.
6. `GET /api/voice/voices` lists it; clients can pass `"voice": "<id>"`.

## Example registry entry

```json
{
  "id": "narrator-01",
  "displayName": "Narrator 01",
  "provider": "elevenlabs",
  "languages": ["tr-TR", "en-US"],
  "gender": "neutral",
  "role": "narrator",
  "enabled": true,
  "isDefault": false,
  "providerVoiceId": "${ELEVENLABS_NARRATOR01_VOICE_ID}",
  "providerVoiceIds": {
    "tr-TR": "${ELEVENLABS_NARRATOR01_VOICE_ID_TR}",
    "en-US": "${ELEVENLABS_NARRATOR01_VOICE_ID_EN}"
  },
  "metadata": {
    "notes": "Optional per-language IDs when one multilingual clone is not enough."
  }
}
```

Then in `.env` (never commit):

```bash
ELEVENLABS_NARRATOR01_VOICE_ID=xxxxxxxx
# optional splits:
# ELEVENLABS_NARRATOR01_VOICE_ID_TR=
# ELEVENLABS_NARRATOR01_VOICE_ID_EN=
```

## Same identity, two languages

Prefer one multilingual provider voice ID for both TR and EN (`providerVoiceId`).

Only use `providerVoiceIds` when the provider cannot share identity across languages.

## Switching providers

```bash
ATLAS_TTS_PROVIDER=elevenlabs
# or
ATLAS_TTS_PROVIDER=openai
```

OpenAI path needs `OPENAI_API_KEY` and a registry `providerVoiceId` that is a valid OpenAI TTS voice name (e.g. `nova`), typically via env placeholder.

Do **not** add a fake OpenAI/ElevenLabs implementation when credentials are absent — the API returns `voice_not_configured`.

## Frontend

`VoicePlaybackControls` already takes `voice` and `language` props. No component fork:

```tsx
<VoicePlaybackControls text={line} voice="narrator-01" language="en-US" />
```

## Checklist

- [ ] Provider voice created (approved if paid)
- [ ] Env var set on server
- [ ] Registry entry added / enabled
- [ ] Languages listed
- [ ] `GET /api/voice/voices` shows the voice with `configured: true`
- [ ] Dry-run or short synthesis test (watch cost)
- [ ] No secrets in git or client bundle
