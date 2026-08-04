# TRANSLITERATION DECISION MATRIX

**Status:** Normative decision data (design)  
**Document id:** `atlas-transliteration-decision-matrix-v1`  
**Last updated:** 2026-08-01  
**RFC:** [RFC-009](./rfc/RFC-009-TURKISH-ARABIC-TRANSLITERATION.md)  
**Layer:** `transliteration-tr-ar-v1`  
**Implementation status:** Spec only — **no production code**

---

## 1. Purpose

Latin/Türkçe grafem → olası Arapça karşılıkları Policy / koşul / tipik yaklaşım / alternatif / belirsizlik / onay / kaynak türü satırlarıyla sabitler.

Klasik ebced toplamı **yalnızca** kullanıcı onaylı `selectedSpelling` üzerinden hesaplanır. Bu matris proposal motorunun girdi sözleşmesidir; tek “doğru” imla iddiası taşımaz.

---

## 2. Source types (normative tags)

| Tag | Meaning |
|-----|---------|
| `klasik_ebced_tablosu` | Eastern kebîr 28-letter inventory / countable letter |
| `modern_arapca_imla` | Contemporary Arabic orthography practice |
| `osmanlica_farsca_varyant` | Ottoman / Persian extra letters or conventions |
| `turkce_fonetik_transliterasyon` | Turkish phonetic approximation |
| `atlas_urun_karari` | Explicit Atlas product policy (not classical consensus) |
| `kaynak_belirsiz` | Contested / insufficient attestation |

English aliases (fixtures MAY use either): `classical_abjad_table`, `modern_arabic_orthography`, `ottoman_persian_variant`, `turkish_phonetic_transliteration`, `atlas_product_decision`, `source_unclear`.

---

## 3. How to read a row

| Column | Meaning |
|--------|---------|
| **Latin** | Grapheme after Latin-side NFC + `tr-TR` lowercasing |
| **Olası Arapça** | Candidate Arabic grapheme(s), ranked |
| **Koşul** | Fonetik veya yazımsal koşul |
| **Tipik TR yaklaşım** | Türkçe kişi adlarında yaygın tercih |
| **Alternatifler** | Kullanıcıya sunulabilecek diğer yazımlar |
| **Belirsizlik** | `low` \| `medium` \| `high` |
| **Onay** | Klasik yol için kullanıcı onayı |
| **Kaynak** | §2 tag(leri) |

Global: `autoAcceptHighCertainty: false` — belirsizlik `low` olsa bile klasik hesap öncesi onay gerekir (RFC-009).

---

## 4. Vowels — a e ı i o ö u ü

| Latin | Olası Arapça | Koşul | Tipik TR yaklaşım | Alternatifler | Belirsizlik | Onay | Kaynak |
|-------|--------------|-------|-------------------|---------------|-------------|------|--------|
| **a** | ا | Kısa / nötr a; kelime başı veya açık hece | Çoğunlukla ا | آ (uzunluk iddiası); ع (ʿayn adları, gazetteer) | medium | evet | `turkce_fonetik_transliterasyon`, `modern_arapca_imla` |
| **e** | omit / ا / ي | Kısa e; Arapçada ayrı harf yok | Ortada çoğu zaman yazılmaz; sonda ا veya ه eğilimi | Explicit ا; ي (nadir) | high | evet | `turkce_fonetik_transliterasyon`, `kaynak_belirsiz` |
| **ı** | omit / ي / ا | Türkçe kapalı ı; Arapçada karşılık yok | Çoğu zaman omit veya ي | ا | high | evet | `turkce_fonetik_transliterasyon`, `kaynak_belirsiz` |
| **i** | ي / omit / ا / إ | Kısa i; başlangıçta hemze taşıyıcı mümkün | Medial/final: ي; kısa: omit | إ (onset); ا | high | evet | `turkce_fonetik_transliterasyon`, `modern_arapca_imla` |
| **o** | و / omit / ا | Yuvarlak o | Tercihen و | omit; ا | high | evet | `turkce_fonetik_transliterasyon` |
| **ö** | و / omit | Arapçada ö yok | Fonetik yaklaşık و | omit | high | evet | `turkce_fonetik_transliterasyon`, `kaynak_belirsiz` |
| **u** | و / omit | Kısa u | Tercihen و | omit (hareke yolu klasik toplamda yok) | high | evet | `turkce_fonetik_transliterasyon` |
| **ü** | و / omit | Arapçada ü yok | Fonetik yaklaşık و | omit | high | evet | `turkce_fonetik_transliterasyon`, `kaynak_belirsiz` |

---

## 5. Long vowels — â î û

| Latin | Olası Arapça | Koşul | Tipik TR yaklaşım | Alternatifler | Belirsizlik | Onay | Kaynak |
|-------|--------------|-------|-------------------|---------------|-------------|------|--------|
| **â** | ا , آ | Circumflex = uzunluk / madd işareti; **asla sessiz drop yok** | Hem ا hem آ öner | آ tercih (madd); ا (bare) | medium | **zorunlu** (toplamı değiştirir) | `atlas_urun_karari`, `modern_arapca_imla` |
| **î** | ي | Uzun i | ي | ئ (hemze taşıyıcı bağlamında) | medium | evet (toplamı değiştirebilir) | `turkce_fonetik_transliterasyon`, `modern_arapca_imla` |
| **û** | و | Uzun u | و | ؤ | medium | evet (toplamı değiştirebilir) | `turkce_fonetik_transliterasyon`, `modern_arapca_imla` |

**Normative:** Production Latin motif’te `â`’nın sessiz atılması klasik transliterasyon katmanında **MUST NOT** tekrarlanır.

---

## 6. Affricates / sibilants — c ç j

| Latin | Olası Arapça | Koşul | Tipik TR yaklaşım | Alternatifler | Belirsizlik | Onay | Kaynak |
|-------|--------------|-------|-------------------|---------------|-------------|------|--------|
| **c** | ج | Türkçe c ≈ [dʒ] | ج | ك (nadir yabancı); س (yanlış) | medium | evet | `turkce_fonetik_transliterasyon`, `modern_arapca_imla` |
| **ç** | چ → (klasik fold) ج | Osmanlı ç | Proposal: چ; klasik sayı: چ→ج (ADR-005) | Doğrudan ج | high | **zorunlu** | `osmanlica_farsca_varyant`, `atlas_urun_karari` |
| **j** | ج / ژ | Loanword | Tercihen ج | ژ → klasikte ز fold | medium | evet | `turkce_fonetik_transliterasyon`, `osmanlica_farsca_varyant` |

---

## 7. Velars — g ğ k q

| Latin | Olası Arapça | Koşul | Tipik TR yaklaşım | Alternatifler | Belirsizlik | Onay | Kaynak |
|-------|--------------|-------|-------------------|---------------|-------------|------|--------|
| **g** | غ / ق / گ | Sert g | Rank: غ, sonra ق; گ Osmanlı | Context gazetteer | high | **zorunlu** | `turkce_fonetik_transliterasyon`, `osmanlica_farsca_varyant` |
| **ğ** | غ / omit | Yumuşak g | غ ve soft-omit birlikte öner | — | high | **zorunlu** | `turkce_fonetik_transliterasyon`, `kaynak_belirsiz` |
| **k** | ك / ق | Velar k | Tercihen ك; qāf adlarında ق | ق | medium | evet | `modern_arapca_imla`, `turkce_fonetik_transliterasyon` |
| **q** | ق | Latin q | ق | ك (nadir) | low | evet | `modern_arapca_imla`, `klasik_ebced_tablosu` |

---

## 8. Sibilants / dental — s ş t

| Latin | Olası Arapça | Koşul | Tipik TR yaklaşım | Alternatifler | Belirsizlik | Onay | Kaynak |
|-------|--------------|-------|-------------------|---------------|-------------|------|--------|
| **s** | س / ص | Düz s vs emphatic | Tercihen س; ṣād lexikonunda ص | ص | medium | evet | `modern_arapca_imla` |
| **ş** | ش | Güçlü gelenek | ش | — | low | evet | `turkce_fonetik_transliterasyon`, `modern_arapca_imla` |
| **t** | ت / ط | Düz t vs emphatic | Tercihen ت; ṭāʾ adlarında ط | ط | medium | evet | `modern_arapca_imla` |

---

## 9. Labials / glides — v p y

| Latin | Olası Arapça | Koşul | Tipik TR yaklaşım | Alternatifler | Belirsizlik | Onay | Kaynak |
|-------|--------------|-------|-------------------|---------------|-------------|------|--------|
| **v** | و / ف / ڤ | Contested | Rank و, sonra ف | ڤ (28 dışı) | high | **zorunlu** | `kaynak_belirsiz`, `osmanlica_farsca_varyant` |
| **p** | پ → (fold) ب | Arapçada p yok | Proposal پ; klasik fold پ→ب | Doğrudan ب | medium | **zorunlu** | `osmanlica_farsca_varyant`, `atlas_urun_karari` |
| **y** | ي | Glide / ünlü | ي | ى (normalize öncesi; ADR-005 → ي) | low | evet | `klasik_ebced_tablosu`, `modern_arapca_imla` |

---

## 10. h

| Latin | Olası Arapça | Koşul | Tipik TR yaklaşım | Alternatifler | Belirsizlik | Onay | Kaynak |
|-------|--------------|-------|-------------------|---------------|-------------|------|--------|
| **h** | ه / ح | Soft h vs ḥāʾ | Tercihen ه; dinî/klasik ad ipuçlarında ح aday | ح | medium | evet (ح seçimi toplamı değiştirir) | `modern_arapca_imla`, `atlas_urun_karari` |

**Normative:** Ürün “kutsal ح”yi otomatik seçmemeli; aday olarak sunmalı.

---

## 11. Name-structure policies

| Id | Yapı | Policy | Belirsizlik | Onay | Kaynak |
|----|------|--------|-------------|------|--------|
| NS-COMPOUND | Birleşik isim (`Nurcan`, `Ayşegül`) | Token’lara böl; her token için ayrı proposal; birleşik yazımı da alternatif olarak sun | high | zorunlu | `atlas_urun_karari` |
| NS-DOUBLE | Çift isim (`Ayşe Fatma`) | Boşluk koru; her parça ayrı; birleşik toplam anne adı politikasından bağımsız | medium | zorunlu | `atlas_urun_karari` |
| NS-SURNAME | Soyad | Aynı harf matrisi; gazetteer öncelikli değilse düşük certainty | high | zorunlu | `turkce_fonetik_transliterasyon` |
| NS-ABD | `Abdül-` / `Abdur-` / `Abdülmecid` | `عبد` + bağlayıcı ا/ال + ikinci unsur; `Abdür`/`Abdur` → عبد ال… kalıpları | medium | zorunlu | `modern_arapca_imla`, `osmanlica_farsca_varyant` |
| NS-EL | Latin `el-` / `al-` / `er-` | With/without ال **ayrı** adaylar; asla auto-strip (ADR-005) | medium | zorunlu | `atlas_urun_karari`, `klasik_ebced_tablosu` |
| NS-FINAL-A-E | Sonu `-a` / `-e` | ة / ه / ا adayları | high | zorunlu | `modern_arapca_imla`, `kaynak_belirsiz` |
| NS-LONG-V | Uzun ünlü (â/î/û) | §5; toplam farkı varsa auto-select yok | medium–high | zorunlu | `atlas_urun_karari` |
| NS-SHADDA | Şedde | Proposal aşamasında şedde varsayma; kullanıcı/expert girişi | high | zorunlu | `atlas_urun_karari` |
| NS-HAMZA | Hemze | أ/إ/آ/ء adayları; bağımsız ء klasikte value 0 (ADR-005) | high | zorunlu | `atlas_urun_karari` |
| NS-TMAR | Te marbuta | ة önerisi; klasikte ة→ه | medium | evet | `klasik_ebced_tablosu`, `atlas_urun_karari` |
| NS-MAQ | Elif maksura | ى önerisi mümkün; klasikte ى→ي | medium | evet | `klasik_ebced_tablosu` |
| NS-LA | Lam-elif | لا ligature; klasikte ل+ا | low | evet | `klasik_ebced_tablosu` |
| NS-FOREIGN | Yabancı köken | Düşük certainty; uzman override teşvik | high | **zorunlu** | `kaynak_belirsiz`, `atlas_urun_karari` |

---

## 12. Aggregate ranking band (proposal only)

```text
proposal.confidence band:
  high   ← tüm harfler belirsizlik ≤ low ve gazetteer güçlü
  medium ← en az bir medium belirsizlik
  low    ← herhangi bir high belirsizlik veya yabancı köken
```

Bu band **API assessment top-level `confidence` alanı değildir** (ADR-003).

**Assessment `transliterationCertainty`:**

- Machine field MAY store interim 0–1 mapped from band (internal).
- Calibration: **NOT VERIFIED**.
- **User UI MUST show only yüksek / orta / düşük** — never raw 0–1 or “%NN”.

Gazetteer (optional): may raise ranking toward `high` when attested; **MUST NOT** auto-accept; confirmation still required; Arabic-only classical path works without gazetteer.

---

## 13. Safety language

Yasak ürün iddiaları:

- “Tek doğru Arapça yazım”
- “Dinî olarak kesin imla”
- Alternatifleri gizleyen auto-accept

Zorunlu:

- “İsminiz için birden fazla Arapça yazım mümkün.”
- “Hesap sonucu seçilen yazıma göre değişebilir.”
- “Lütfen kullandığınız yazımı seçin.”

---

## 14. Fixture links

| Concern | Fixture id |
|---------|------------|
| Saf Arapça | `FAB-001` |
| Türkçe isim | `FAB-002` |
| â / آ expand | `FAB-003`, `FAB-012a`, `FAB-CONFLICT-AA` (sibling bare: `FAB-012b`; **no** `FAB-012`) |
| ç ğ ı ö ş ü | `FAB-004` |
| Şedde | `FAB-005` |
| Hemze | `FAB-006` |
| Te marbuta | `FAB-007` |
| Elif maksura | `FAB-008` |
| Lam-elif | `FAB-009` |
| Anne adı | `FAB-010a`, `FAB-010b` (parts model) |
| Alternatif yazımlar | `FAB-011`, `FAB-011b` |
| Farklı toplamlar | `FAB-012a`, `FAB-012b` |
| Unsupported | `FAB-013` |
| Birleşik isim | `FAB-014` |
| Abdül- | `FAB-015` |

---

## 15. Acceptance criteria

- [x] a e ı i o ö u ü + â î û satırları
- [x] c ç j g ğ k q s ş t v p h y satırları
- [x] İsim yapıları §11
- [x] Kaynak türleri §2
- [x] Spec only
