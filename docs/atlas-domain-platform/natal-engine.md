# Atlas Natal Astrology Engine

**Status:** Active (v1.0.0)  
**Engine id:** `atlas-natal-astrology`  
**Methodology:** `western-tropical-natal-v1`

## Purpose

Deterministic natal chart calculation from birth date, time, and place. LLM interprets verified structured output only — it must not invent Ascendant, houses, planet degrees, or aspects.

## Ephemeris decision

| Option | License | Native binary | Notes |
|--------|---------|---------------|-------|
| **astronomy-engine (chosen)** | MIT | No | Already in Atlas; used by `atlas-ephemeris.js`; Node-friendly hosting |
| Swiss Ephemeris / swisseph | GPL concerns + native | Yes | Rejected for v1 deployment simplicity |
| circular-natal-horoscope-js | Unlicense | No | Moment dependency; parallel ephemeris path — avoided |

**Provider:** `astronomy-engine@2.1.19`  
**Nodes:** Mean lunar node (Meeus-style); not true node.  
**Chiron:** Not supported in v1.

## Architecture

```text
Natal input
→ normalization
→ location + historical timezone (Intl IANA)
→ planetary positions (astronomy-engine)
→ ASC/MC/DC/IC + house cusps
→ aspects + distributions (+ optional patterns)
→ NatalChartResult JSON
→ interpretation adapter / LLM prompt block
```

Shared by Web and Telegram via `server/atlas-astrology-flow.js` → `server/natal-engine/`.

## API

```js
import { calculateNatalChart } from './server/natal-engine/index.js';

const result = calculateNatalChart({
  birthDate: '1986-01-27', // also 27.01.1986, 27 Ocak 1986
  birthTime: '18:20',
  birthPlace: 'Bursa',
  houseSystem: 'placidus', // placidus | whole-sign | equal
});
```

## Data requirements

| Date | Time | Place | Result |
|------|------|-------|--------|
| ✓ | — | — | Planets (UTC noon probe); no ASC/houses |
| ✓ | ✓ | — | Error `BIRTH_PLACE_REQUIRED` (no ASC invent) |
| ✓ | — | ✓ | Planets; no ASC/houses (no noon-as-exact-chart) |
| ✓ | ✓ | ✓ | Full chart |

Ambiguous cities (`Springfield`, `Victoria`, `Cambridge`) return `AMBIGUOUS_BIRTH_PLACE`.

## House systems

Default comes from methodology (`placidus`), not scattered hard-codes. Supported: Placidus, Whole Sign, Equal. Koch/Porphyry/etc. reserved.

## Orb table (`western-tropical-natal-v1`)

| Aspect | Orb |
|--------|-----|
| conjunction / opposition | 8° |
| trine / square | 7° |
| sextile | 5° |
| Sun/Moon bonus | +2° |

## Tests

```bash
npm run test:natal
# included in
npm run test:all
```

## Known limitations

- Curated place DB (not full geocoder); unknown cities fail closed.
- Sidereal ready in architecture, not calculated in v1.
- Placidus unstable near polar latitudes (warning emitted).
- Synastry / transit matrix / solar return out of scope for this engine.
