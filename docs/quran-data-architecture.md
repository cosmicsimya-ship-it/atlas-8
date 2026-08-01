# ATLAS Kur’an Veri Katmanı — Mimari Tasarım

**Durum:** Mimari kilit (kod yok)  
**Tarih:** 2026-07-30  
**Kapsam:** Araştırma, veri modeli, lisans, genişleme planı  
**Kapsam dışı:** Production kodu, ingest scripti, backend/frontend değişikliği, commit/push

---

## 1. Amaç

ATLAS içinde kullanılacak Kur’an veri altyapısını tek kaynağa bağlı olmayan, katmanlı ve uzun ömürlü bir mimariye dönüştürmek.

Kur’an tek bir monolit dosya olarak tutulmaz. Kimlik, script, meal, tefsir, görsel mushaf ve Atlas analizi ayrı katmanlarda tutulur; birleşim kanonik ayet kimliği üzerinden yapılır.

---

## 2. Kilitlenen kararlar

### 2.1 L1 / görsel mushaf

| Karar | Detay |
|-------|--------|
| Birincil script katmanı | **Madinah / QPC Unicode metni** (KFGQPC Hafs Uthmani script + uyumlu font) |
| Kayışzâde / Hafız Osman sayfa görselleri | Yalnızca lisans ve kullanım izni doğrulanırsa **ayrı görsel mushaf katmanı** |
| Canonical metin | Görsel katman **asla** canonical metnin yerine geçmez |

Not: Türkiye’de “Hafız Osman hattı” çoğunlukla **Kayışzâde Hâfız Osman Nûri** (ö. 1894) âyet-berkenar mushafına işaret eder; 17. yy hattatı Hâfız Osman ile karıştırılmamalıdır. Serbest Unicode “Hafız Osman fontu” yoktur.

### 2.2 L3 meal

| Karar | Detay |
|-------|--------|
| Birincil yaklaşım | **Diyanet API-first** |
| Offline snapshot | Yalnızca yazılı izin + kullanım koşulları + güncelleme/saklama hakları netleşince |
| Snapshot zorunlu alanlar | `source`, `version`, `fetchedAt`, `checksum` |

### 2.3 Atlas analiz katmanı

Atlas ürettiği analizler Kur’an metnini değiştirmez. Analizler `verse_key` ile bağlanır; script/meal paketlerine yazılmaz.

---

## 3. Katman mimarisi

```text
L0  Identity & Structure     sure / ayet / cüz / hizb / secde + layout map’leri
L1  Canonical Arabic Script  Madinah / QPC Unicode (birincil, salt okunur)
L1v Visual Mushaf            Kayışzâde vb. sayfa görselleri (opsiyonel, lisanslı)
L2  Search / Imla variants   Tanzil simple / simple_clean (arama & eşleme yardımcı)
L3  Default translation      Diyanet meal (API-first)
L4  Optional translations    Bağımsız meal paketleri
L5  Tafsir                   İleride; L4 ile aynı sözleşme
L6  Atlas analysis           Atlas çıktıları; corpus mutate yok
L7+ Audio / words / qiraat   Eklenti paketleri
```

**Runtime birleşim:** `resolve(verse_key, requestedLayers[])`  
**Invariant:** L1 hash’lenmiş salt okunur; L6 yalnızca kendi deposuna yazar.

ATLAS `daily-analysis` ile hizalama (ileride): L6 çıktıları `LayerResult` (`type: 'traditional'`) taşınabilir. Ham mushaf/meal metni daily-analysis computed payload’ına gömülmez.

---

## 4. Canonical ayet kimliği modeli

### 4.1 Birincil anahtar

```text
verse_key = "{surah}:{ayah}"
```

Örnekler: `1:1`, `2:255`, `9:1`, `114:6`

| Alan | Tip | Kural |
|------|-----|--------|
| `surah` | integer | 1..114 |
| `ayah` | integer | Sure içi 1..N (Hafs / standart 6236 ayet modeli) |
| `verse_key` | string | `surah:ayah`, sıfır dolgusuz |
| `global_ayah_index` | integer (opsiyonel) | 1..6236, sabit kanonik sıra |

Kelime düzeyi (L7+):

```text
word_key = "{surah}:{ayah}:{word}"
```

Örnek: `1:1:1`

### 4.2 Kimlik nesnesi (kavramsal)

```text
VerseIdentity {
  surah: number
  ayah: number
  verse_key: string
  global_ayah_index?: number
}
```

### 4.3 Sabitler

- 114 sure, Hafs rivayetine göre **6236 ayet**
- Sure 1 (Fâtiha): besmele ayet 1 olarak sayılır
- Sure 9 (Tevbe): besmele yok
- Diğer surelerde besmele, ayet numarasına dahil edilmez (görüntüleme metadata’sı ayrı olabilir)

`verse_key` tüm katmanların join anahtarıdır. Sayfa numarası, cüz, hizb **kimlik değildir**; L0 yapısal indekstir ve mushaf layout’una göre değişebilir.

---

## 5. Sure / ayet indeksleme yapısı

### 5.1 L0 yapısal indeks

```text
SurahRecord {
  number: 1..114
  name_ar: string
  name_tr: string
  revelation_place?: "mecca" | "medina"
  ayah_count: number
  ruku_count?: number
}

VerseStructure {
  verse_key: string
  surah: number
  ayah: number
  global_ayah_index: number
  juz?: number          // 1..30
  hizb?: number         // 1..60
  rub?: number          // opsiyonel
  sajda?: boolean | { type: "recommended" | "obligatory" }
}
```

### 5.2 Layout indeksleri (kimlikten ayrı)

| Layout ID | Açıklama | Kullanım |
|-----------|----------|----------|
| `madinah_qpc_15line` | KFGQPC Madinah sayfa düzeni | L1 ile uyumlu sayfa navigasyonu |
| `turkey_hafiz_osman` | Âyet-berkenar TR mushaf (lisans sonrası) | Yalnız L1v |

Aynı `verse_key` farklı layout’larda farklı `page_number` alabilir. UI “sayfa” gösterirken aktif layout ID’sini belirtir.

### 5.3 Erişim desenleri

| İhtiyaç | Erişim |
|---------|--------|
| Tek ayet | `verse_key` |
| Sure | `surah` → ayet listesi |
| Cüz | L0 `juz` indeksi → `verse_key[]` |
| Madinah sayfa | layout DB: page → word/verse range |
| Görsel mushaf sayfa | L1v: page image + overlay `verse_key` map |

Önerilen fiziksel depo: L0 için SQLite veya JSONL + indeks; mobil offline’da SQLite tercih.

---

## 6. Arapça metin varyantları

| Varyant ID | Kaynak / rol | Değiştirilebilir mi? | Birincil mi? |
|------------|--------------|----------------------|--------------|
| `qpc_uthmani` | Madinah / QPC Unicode (KFGQPC Hafs) | Hayır | **Evet (L1 canonical)** |
| `tanzil_uthmani` | Tanzil Uthmani | Hayır (Tanzil ToS) | Referans / çapraz doğrulama |
| `tanzil_uthmani_minimal` | Tanzil, az diyakritik | Hayır | Opsiyonel görüntü |
| `tanzil_simple` | İmlâî (modern yazım) | Hayır | Okuma / bazı UI’lar |
| `tanzil_simple_clean` | Diyakritiksiz | Hayır | **Arama / normalizasyon** |

### 6.1 Kavramsal farklar

- **Resm-i Osmânî:** Erken mushaf imla iskeleti (bazı harflerin yazımı modern imlâdan farklıdır).
- **İmlâî (simple):** Modern Arapça yazım; arama ve karşılaştırma için uygundur.
- **Unicode:** Kod noktası standardı; doğru **font** (ör. QPC Hafs) olmadan görsel sadakat düşer.
- **Osmanlı / Kayışzâde hattı:** Görsel üslup ve sayfa tertibi; Unicode metin varyantı değildir → L1v.

### 6.2 ATLAS kuralı

- Ekranda canonical okuma metni: **`qpc_uthmani` + QPC font**
- Arama indeksi: **`tanzil_simple_clean`** (veya eşdeğer normalize edilmiş form)
- İki kaynak arasındaki farklar “hata” sayılmaz; varyant tablosunda belgelenir
- Hiçbir ingest süreci Arapça metni “düzeltmez”; yalnızca paketler ve hash doğrular

---

## 7. Kaynak ve lisans matrisi

| Kaynak | Katman | Lisans / koşul | ATLAS kullanımı | Redistribüsyon | Risk |
|--------|--------|----------------|-----------------|----------------|------|
| KFGQPC / QPC Hafs Unicode + font | L1 | Font ve script paket şartları (QUL/KFGQPC dokümantasyonu) | Canonical metin + font | Font lisansına göre | Orta — font NOTICE |
| Tanzil Quran Text | L2 / çapraz | CC BY 3.0 + **metin değiştirilemez**; atıf + tanzil.net linki | Arama varyantları, doğrulama | Evet (verbatim + NOTICE) | Düşük (şartlara uyum) |
| Tanzil metadata (`quran-data.xml`) | L0 | Aynı atıf ailesi | Cüz/hizb/secde | Evet + atıf | Düşük |
| QUL / Tarteel script & layout paketleri | L1 / L0 layout | Kaynak paketin lisansı | Madinah sayfa map, word layout | Paket lisansına göre | Orta |
| Diyanet Kur’an API (acikkaynakkuran) | L3 | Resmi API; **offline kopya için açık CC yok** | API-first meal | Offline: **izin şart** | **Yüksek** (snapshot) |
| Diyanet meal metni (yayın hakkı) | L3 | Kurum hakkı; yazılı izin | Varsayılan meal | İzne bağlı | **Yüksek** |
| Kayışzâde / Hafız Osman tıpkıbasım | L1v | Yayınevi / Diyanet Vakfı vb. | Görsel mushaf | İzne bağlı | **Yüksek** |
| Üçüncü taraf acikkuran API | — | Örn. CC BY-NC-SA | Ticari ATLAS için varsayılan kaynak değil | NC kısıtı | Yüksek — kullanma |
| EveryAyah / kıraat sesleri | L7+ | Kıraatçı / dağıtıcı bazlı | İsteğe bağlı ses | Tek tek doğrula | Orta–yüksek |
| Atlas L6 analizleri | L6 | ATLAS | Tema / bağ / analiz | ATLAS politikası | Düşük (metin çoğaltmadan `verse_key`) |

### 7.1 Zorunlu NOTICE politikası

Her veri paketinin yanında:

- `NOTICE.md` (atıf, lisans özeti, linkler)
- `manifest.json` (source, version, license id, content hash)
- Registry’de lisans durumu: `cleared` | `api_only` | `pending_permission` | `forbidden`

Lisans `pending_permission` veya `forbidden` iken paket production ship edilmez.

---

## 8. Meal ve tefsir genişleme modeli

### 8.1 Ortak sözleşme

```text
TranslationOrTafsirPackage {
  id: string                 // örn. "diyanet_tr", "diyanet_tafsir"
  layer: "L3" | "L4" | "L5"
  language: string           // BCP-47, örn. "tr"
  title: string
  source: string
  version: string
  license: string
  join_key: "verse_key"
  delivery: "api" | "snapshot" | "hybrid"
  verses: Map<verse_key, {
    text: string
    footnotes?: string[]
  }>
}
```

### 8.2 L3 — varsayılan meal (Diyanet)

- Runtime: Diyanet API’den `verse_key` (veya sure/ayet) ile çek
- Cache: kısa TTL bellek/disk cache (metin “snapshot paketi” değildir)
- UI: kaynak etiketi “Diyanet İşleri Başkanlığı Meali”
- Offline: varsayılan **yok**; kullanıcıya net mesaj

### 8.3 L4 — alternatif mealler

```text
data/quran/L4_translations/<translation_id>/
  manifest.json
  verses.jsonl | verses.sqlite
  NOTICE.md
```

Yeni meal eklemek = yeni klasör + registry kaydı. L1/L0 şeması değişmez.

### 8.4 L5 — tefsir

L4 ile aynı paket modeli; içerik daha uzun olabilir:

- Ayet başına tek blok veya segmentli metin
- İsteğe bağlı `segments[]` (konu başlıklı parçalar)
- Ayrı indirme / lazy load (boyut)

### 8.5 Genişleme kuralı

Meal/tefsir asla L1 Arapça dosyasına gömülmez. Join yalnızca `verse_key` ile yapılır.

---

## 9. QPC / Madinah ile Diyanet eşleme stratejisi

### 9.1 Varsayım

Hem QPC/Madinah Hafs metni hem Diyanet onaylı metin, standart **114 sure / 6236 ayet** Hafs numaralandırmasını kullanır. Birleşim anahtarı `verse_key`’dir.

### 9.2 Eşleme katmanları

```text
1. Structural identity   surah + ayah  →  verse_key
2. Content binding       L1 qpc_uthmani[verse_key]  ↔  L3 diyanet_meal[verse_key]
3. Cross-check (opsiyonel)  Tanzil uthmani[verse_key] ile L1 karakter/normalize karşılaştırma
4. Display               Arapça: L1 + QPC font; meal: L3 API
```

### 9.3 Uyuşmazlık politikası

| Durum | Davranış |
|-------|----------|
| Aynı `verse_key`, farklı görsel imla (QPC vs başka Unicode) | Beklenen olabilir; L1 kazanır (görüntü) |
| API’den gelen meal satırı eksik / hata | L3 `status: unavailable`; L1 gösterilir |
| Numaralandırma şüphesi (nadir) | Manuel reconciliation tablosu `exceptions.json`; sessiz “düzeltme” yok |
| Besmele / sure başı UI farkı | Görüntüleme kuralı; `verse_key` modeli değişmez |

### 9.4 Reconciliation kaydı (ileride, gerekirse)

```text
MappingException {
  verse_key: string
  layer_a: "qpc_uthmani"
  layer_b: "diyanet_api"
  issue: string
  resolution: "accept_divergence" | "manual_review" | "block_pair"
  reviewed_at?: string
}
```

---

## 10. Görsel mushaf katmanı (L1v)

### 10.1 Rol

- Canonical metin **değildir**
- Kullanıcıya “basılı mushaf” deneyimi için sayfa görselleri + dokunmatik ayet bölgeleri
- L1 Unicode metin her zaman kaynak gerçeklik (source of truth)

### 10.2 Etkinleştirme koşulu

Yalnızca şu doğrulandığında:

1. Yayıncı / hak sahibi yazılı kullanım izni  
2. Ticari / uygulama içi gösterim hakkı  
3. Önbellekleme / CDN / offline dağıtım hakkı (ayrı maddeler)  
4. Atıf ve mühür/kurul onayı gereksinimleri  

Aksi halde L1v registry’de `pending_permission` kalır; UI’da sunulmaz.

### 10.3 Veri modeli

```text
VisualMushafPackage {
  id: "kayiszade_hafiz_osman"
  layout_id: "turkey_hafiz_osman"
  pages: [{
    page_number: number
    image_ref: string          // URL veya lisanslı local asset
    width: number
    height: number
    regions: [{
      verse_key: string
      polygon_or_bbox: ...
    }]
  }]
}
```

Sayfa numarası Madinah layout ile **eşitlenmez**. Kullanıcı layout seçer: `madinah_qpc_15line` (metin/layout) vs `turkey_hafiz_osman` (görsel).

---

## 11. API-first ve offline snapshot karşılaştırması

| Ölçüt | Diyanet API-first (seçilen L3) | Offline snapshot (koşullu) |
|-------|-------------------------------|----------------------------|
| Lisans riski | Daha düşük (canlı resmi kaynak) | Yüksek — yazılı izin şart |
| Offline okuma | Yok / sınırlı cache | Tam meal offline |
| Güncellik | API’deki güncel sürüm | `version` + `fetchedAt` ile pin |
| Bütünlük | Ağ + API token | `checksum` zorunlu |
| Bağımlılık | Diyanet API uptime / token | Yerel paket yönetimi |
| ATLAS varsayılanı | **Evet** | İzin sonrası planlanır |

### 11.1 API-first davranış

- İstek: sure/ayet veya `verse_key`
- Yanıt normalize: `{ verse_key, text, source, api_version?, fetchedAt }`
- Hata: meal katmanı `unavailable`; Arapça L1 etkilenmez
- Kısa TTL cache izinli; bu cache “lisanslı snapshot paketi” sayılmaz

### 11.2 Offline snapshot (izin sonrası) zorunlu alanlar

Her snapshot paketinde `manifest.json`:

```json
{
  "layer": "L3",
  "id": "diyanet_tr",
  "source": "Diyanet İşleri Başkanlığı Kur'an API",
  "version": "string-from-api-or-permission-letter",
  "fetchedAt": "2026-07-30T12:00:00.000Z",
  "checksum": "sha256:...",
  "license": "diyanet-written-permission-ref",
  "permission_ref": "internal://legal/...",
  "verse_count": 6236,
  "join_key": "verse_key"
}
```

Eksik `source` | `version` | `fetchedAt` | `checksum` → paket geçersiz; ingest/ship yok.

---

## 12. Önerilen klasör yapısı

Henüz oluşturulmayacak iskelet (mimari hedef):

```text
data/quran/
  _registry/
    layers.manifest.json
    licenses/
      tanzil.NOTICE.md
      qpc.NOTICE.md
      diyanet.status.md
      kayiszade.status.md
  L0_structure/
    surahs.json
    verse_index.sqlite
    layouts/
      madinah_qpc_15line/
      turkey_hafiz_osman/          # yalnızca lisans sonrası
  L1_script_qpc/
    qpc_uthmani.jsonl
    fonts/
      NOTICE.md
    manifest.json
  L1v_visual_mushaf/               # pending_permission
    kayiszade_hafiz_osman/
      manifest.json
      pages/...
  L2_script_search/
    tanzil/
      uthmani.jsonl
      simple_clean.jsonl
      NOTICE.md
      manifest.json
  L3_translation_default/
    diyanet_tr/
      delivery.json                # { "mode": "api_first" }
      manifest.snapshot.json       # yalnız izin + snapshot sonrası
      cache/                       # runtime TTL cache (opsiyonel)
  L4_translations/
    <translation_id>/
  L5_tafsir/
    <tafsir_id>/
  L6_atlas/
    schemas/
    analyses/
  L7_audio/
  L7_words/
  L7_qiraat/
  search/
    arabic_fts.sqlite
    tr_meal_fts.sqlite             # snapshot veya indekslenmiş cache sonrası
```

**Yasak:** Bu corpus `server/generated/` altına konmaz (o yol Shorts/asset dump içindir).

---

## 13. Arama sistemi (mimari)

| Korpus | İndeks girdisi | Motor |
|--------|----------------|--------|
| Arapça | `tanzil_simple_clean` (+ harf normalizasyonu) | SQLite FTS5 |
| Türkçe meal | L3/L4 metinleri (API sonucu indekslenir veya snapshot) | FTS5 / dil tokenizer |
| Referans | `2:255`, `Bakara 255` parse | Yapısal resolver |

Arama sonuçları her zaman `verse_key` döner; UI L1 + L3’ü resolve eder.

---

## 14. Performans notları

| Senaryo | Beklenti |
|---------|----------|
| L1 QPC + L0 indeks | Birkaç MB; offline uygun |
| + FTS (Arapça) | +%20–40 |
| L3 API-first | Ağ latansı; ayet/sure bazlı istek |
| L1v tam tıpkıbasım | Büyük; on-demand sayfa |
| L7 ses | Ayrı paket / CDN |

Mobil: SQLite; web: sure bazlı lazy JSON + font subset.

---

## 15. Gelecek genişleme (L5 / L7+)

| Eklenti | Katman | Join | Not |
|---------|--------|------|-----|
| Tefsir | L5 | `verse_key` | L4 sözleşmesi |
| Kıraat | L7 | `verse_key` + `qiraat_id` | Varsayılan Hafs; metin paketi ayrı |
| Ses | L7 | `verse_key` + `reciter_id` | Lisans kıraatçı bazlı |
| Kelime analizi | L7 | `word_key` | Morphology ayrı lisans |
| Atlas temaları | L6 | `verse_key` | Metin mutate yok |

---

## 16. Açık riskler ve izin gerektiren noktalar

### 16.1 İzin / hukuk (blocker)

1. **Diyanet meal offline snapshot** — yazılı izin; saklama, güncelleme, ticari uygulama içi kullanım  
2. **Kayışzâde / Hafız Osman görselleri** — yayıncı izni olmadan L1v yok  
3. **QPC font redistribüsyonu** — font dosyasının uygulama ile dağıtım şartları  
4. **Ses / tefsir** — kaynak bazlı ayrı izinler  

### 16.2 Teknik / ürün riskleri

1. Madinah sayfa ≠ Türkiye âyet-berkenar sayfa karışıklığı  
2. API kesintisi → meal yok (L1 ayakta kalmalı)  
3. Unicode + yanlış font → görsel “hata” algısı  
4. Tanzil metnini “düzeltme” → lisans ihlali  
5. Monolit JSON’a geri dönüş → genişleme kırılır  
6. L6’da kader/kehanet dili — mevcut ATLAS test politikasıyla çelişir  
7. Üçüncü taraf NC lisanslı meal API’lerinin çekirdeğe alınması  

### 16.3 Operasyonel

- Diyanet API token yaşam döngüsü (`acikkaynakkuran-dev` / resmi geliştirici süreci)  
- Paket `checksum` doğrulama CI’si (ileride)  
- Lisans registry’sinin product release gate’e bağlanması  

---

## 17. Ingest prototype — sonraki adım planı

> Bu bölüm plan içindir. **Bu görevde ingest scripti veya production kodu yazılmaz.**

### Faz P0 — Hukuk / kaynak kilidi (kod yok)

1. Diyanet API geliştirici erişimi ve ToS özeti (internal not)  
2. Offline snapshot için izin talebi taslağı (istersen ayrı legal checklist)  
3. QPC font redistribüsyon şartlarının okunması  
4. L1v için: şimdilik `pending_permission` bırak  

### Faz P1 — Salt okunur prototype (ayrı onay + branch)

1. L0: sure listesi + `verse_key` indeksi (Tanzil metadata veya QUL)  
2. L1: QPC/Madinah Unicode ayet paketini `verse_key` ile hizala; `manifest` + `checksum`  
3. L2: `simple_clean` arama indeksi (FTS prototype)  
4. Çapraz: rastgele N ayette L1 ↔ Tanzil uthmani rapor (mutate yok)  

### Faz P2 — L3 API-first adapter (ayrı onay)

1. Diyanet API client (read-only)  
2. Normalize: `verse_key`, `text`, `source`, `fetchedAt`  
3. Kısa TTL cache  
4. UI/contract stub: meal `unavailable` iken L1 bağımsız  

### Faz P3 — Snapshot kapısı (yalnızca izin sonrası)

1. Snapshot writer: zorunlu `source`, `version`, `fetchedAt`, `checksum`  
2. Registry `license: cleared` olmadan ship engeli  
3. Offline FTS meal indeksi  

### Faz P4 — L6 Atlas şeması

1. `analyses` şeması (`verse_key`, themes, evidence, warnings)  
2. daily-analysis traditional layer hook tasarımı  
3. Metin çoğaltmama kuralı testleri  

### Bilinçli olarak ertelenenler

- L1v görsel ingest  
- L4/L5 içerik doldurma  
- Ses / kelime / kıraat  
- Backend production route’ları  

---

## 18. Alternatif yaklaşımlar (reddedilen / ikincil)

| Yaklaşım | Karar |
|----------|--------|
| Tek monolit `quran.json` (metin+meal+tefsir) | Red — lisans ve genişleme kırılır |
| Yalnız Diyanet API (Arapça dahil tek vendor) | Red — L1 QPC canonical; tek vendor riski |
| Görsel mushaf = canonical | Red — karar 2.1 |
| L3’te hemen offline Diyanet dump | Red — izin yokken |
| Üçüncü taraf NC meal API çekirdek | Red — ticari uyumsuzluk riski |

---

## 19. Neden bu mimari

1. Canonical Arapça Madinah/QPC ile sabitlenir; görsel mushaf opsiyonel kalır.  
2. Diyanet meal API-first ile lisans riski düşürülür; snapshot kapısı net alanlarla açılır.  
3. `verse_key` endüstri standardı (QUL, yaygın dijital mushaf API’leri).  
4. Meal/tefsir/analiz ayrı paketlerle yıllarca genişletilebilir.  
5. Atlas L6 corpus’u kirletmez.  
6. Mevcut ATLAS traditional-layer yoluna ileride bağlanabilir; şu an kod dokunulmaz.

---

## 20. Sınırlar (bu doküman görevine ait)

- Production kodu yazılmadı  
- Ingest scripti yazılmadı  
- Backend / frontend değiştirilmedi  
- Commit / push yapılmadı  
- Yalnızca `docs/quran-data-architecture.md` üretildi  

---

## 21. PASS / FAIL

| Kriter | Sonuç |
|--------|--------|
| L1 birincil = Madinah/QPC Unicode | **PASS** |
| Kayışzâde yalnızca lisanslı L1v; canonical değil | **PASS** |
| L3 = Diyanet API-first | **PASS** |
| Snapshot alanları: source, version, fetchedAt, checksum | **PASS** |
| Kaynak ve lisans matrisi | **PASS** |
| Canonical ayet kimliği modeli | **PASS** |
| Sure/ayet indeksleme | **PASS** |
| Arapça metin varyantları | **PASS** |
| Meal ve tefsir genişleme modeli | **PASS** |
| QPC/Madinah ↔ Diyanet eşleme | **PASS** |
| Görsel mushaf katmanı | **PASS** |
| API-first vs offline karşılaştırma | **PASS** |
| Klasör yapısı | **PASS** |
| Ingest prototype sonraki adımlar | **PASS** |
| Açık riskler / izin noktaları | **PASS** |
| Production/ingest/backend/frontend’e dokunulmadı | **PASS** |
| Commit / push yok | **PASS** |
| Doküman yolu: `docs/quran-data-architecture.md` | **PASS** |

### Genel: **PASS**

**Review:** Mimari kilit bu dokümanda. Sonraki iş için ayrı onay gerekir (P0 hukuk notları veya P1 salt okunur prototype). Bu aşamada duruldu.
