# ADR-002: Default Symbolic Methodology

**Status:** Accepted for Specification  
**Date:** 2026-07-31  
**Spec series:** Atlas Ebced / Esma Architecture v2

---

## Context

Open question across Architecture and Migration: whether Symbolic Analysis should default to classical Ebced-i Kebîr or Atlas Latin motif. Classical requires spelling confirmation; silent classical would be methodologically dishonest and UX-blocking.

## Decision

1. **Default product methodology:** Atlas Latin Harf-Sayı Motif Sistemi (`atlas-letter-number-v2`).
2. Classical (`abjad-kabir-classical-v1`) is an **explicit second option**, never silent default.
3. Classical MUST NOT auto-run without spelling confirmation (Latin→Arabic) or direct Arabic / expert-override path.
4. UI: default tab Latin Motif; second tab Classical; results MUST NOT be merged as one truth; dual request → two cards; neither is fallback for the other.
5. Mandatory label: `Atlas Latin Harf-Sayı Motif Sistemi — klasik ebced değildir.`

## Consequences

- Backward-compatible with current production Latin+reduce behavior family.
- Classical gated by Faz 3–4 capabilities.
- Marketing/UI copy must not call Latin motif “ebced” without qualification.

## Rejected Alternatives

- Classical-as-default (breaks current UX; requires confirmation always).
- Auto-running both and picking one (method mixing).
- Using experimental Esma F as cross-method fallback.

## Migration Impact

- Faz 1–2: labels/metadata align to this decision before classical engine ships.
- Legacy stored results remain readable; new runs emit v2 Latin id (see Latin identity decision in Architecture / ADR series).
