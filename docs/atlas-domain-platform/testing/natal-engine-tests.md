# Natal Engine Tests

## Commands

```bash
npm run test:natal
npm run test:all   # includes test:natal
```

## Coverage

| Area | What is asserted |
|------|------------------|
| Normalization | ISO / dotted / Turkish month dates; HH:MM / HH.MM; invalid dates/times; verbal time not coerced |
| Longitude helpers | Sign boundaries; angular separation |
| Location | Bursa resolve; Springfield/Cambridge ambiguity |
| Timezone | TR 1986 winter +02; summer DST-aware; US DST winter≠summer |
| Missing data | No ASC without time; no houses without place; ambiguous place errors |
| Full chart | Planets, ASC/MC, 12 cusps, aspects, distributions, methodology ids |
| Golden fixtures | `server/natal-engine/fixtures/*.json` |
| Pipeline | `ASCENDANT_CALC_AVAILABLE=true`; natal intent; no invented rising fallback |
| Performance | Single chart &lt; 2s; cache hit |

## Tolerances

| Quantity | Default tolerance |
|----------|-------------------|
| Planet longitude | ±0.05° (fixture may override) |
| ASC / MC | ±0.15°–0.25° |

Do not widen tolerances only to make tests pass.

## Fixtures

- `bursa-1986-winter.json` — historical TR offset + degree-level ASC/MC
- `istanbul-1990-summer.json` — summer DST path
- `ulm-1879.json` — northern historical
- `sydney-2000.json` — southern + equal houses
- `newyork-1985.json` — western longitude + whole sign
