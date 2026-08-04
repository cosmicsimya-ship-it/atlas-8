# Atlas v0.8 — Namecheap Production Yayın Planı

**Durum:** Uygulanabilir runbook (kod tabanı analizi + production düzeltmeleri)  
**Tarih:** 2026-08-03  
**Kapsam:** cPanel / Namecheap Web Hosting + sürekli Node süreci

---

## 0. Kritik gerçek (varsayım değil)

Atlas **üç süreçli** bir üründür:

| Süreç | Komut | Gerekli mi? |
|-------|--------|-------------|
| API + (opsiyonel) SPA | `node server/index.js` | Evet |
| Telegram poller | `node server/telegram.js` | Telegram kullanılacaksa evet |
| Vite dev sunucusu | `npm run dev` | **Production’da hayır** |

Kodda (`server/index.js`) Express artık `NODE_ENV=production` iken `dist/` sunabilir (`ATLAS_SERVE_FRONTEND`).  
SPA varsayılan API adresi artık **same-origin `/api`** (`src/config.ts`) — `localhost:3001` production tuzağı kapatıldı.

Repo mimari notu (`docs/atlas-product-membership-architecture.md` §21): **yalnızca paylaşımlı cPanel PHP hosting** tam ürün için yetersizdir. Namecheap’te çalışan bir Node backend’iniz varsa devam edin; yoksa VPS / Application Manager gerekir.

**Bu plan iki mod sunar — birini seçin:**

- **Mod A (önerilen):** Tek Node uygulaması → SPA + `/api` same-origin  
- **Mod B:** `public_html` = statik SPA; API ayrı Node uygulaması / port

---

## 1. Analiz özeti — ne yüklenir, ne yüklenmez

### Production’a GİRECEK

| Öğe | Neden |
|-----|--------|
| `dist/index.html` (+ `robots.txt`) | Frontend (single-file build) |
| `server/` | Express API, Telegram, motorlar |
| `knowledge/` | Persona / founder bilgisi |
| `runner/` | Pipeline runner bağımlılığı |
| `package.json` + `package-lock.json` | `npm ci` |
| Boş `data/` iskeleti | Runtime yazma |
| `.env` (**sunucuda oluşturulur**) | Gizli anahtarlar |
| `deploy/public_html/.htaccess` | Yalnızca Mod B |

### Production’a GİRMEYECEK

| Öğe | Neden |
|-----|--------|
| `.env` (laptop kopyası) | Sızıntı riski — sunucuda yeni yaz |
| `.atlas-local-founder-credentials.txt` | Kimlik bilgisi |
| `node_modules/` | Sunucuda `npm ci --omit=dev` |
| `src/`, `scripts/` (test), `docs/`, `agents/` | Zorunlu değil (pakette yok) |
| Dolu `data/user_memory.json`, auth, media, audio-jobs | Yerel / kişisel veri |
| `data/telegram.heartbeat.json`, poll lock, pid | Host-local |
| `dist.zip` eski karışık arşivler | Temiz paket kullan |

### cPanel’de SİLİNECEK / TEMİZLENECEK (dağınıklık)

Aşağıdakileri **yedek alıp** silin veya `old_YYYYMMDD/` altına taşıyın:

- Eski test klasörleri (`test`, `tmp`, `old`, `backup*`, çift `public_html` kopyaları)
- Eski `node_modules` kalıntıları yanlış yerde
- Birden fazla `index.html` / eski Vite `assets/` klasörleri (single-file’da assets klasörü yok)
- Yanlışlıkla yüklenmiş `.env`, `.git`, laptop `data/` dump’ları
- Kullanılmayan PHP/WordPress kalıntıları (aynı vhost’ta çakışıyorsa)

**Korunacak:** DNS/SSL ayarları (cPanel UI), e-posta hesapları, mevcut çalışan Node app tanımı (güncellenecek).

---

## 2. Hedef klasör yapısı

### Mod A — Same-origin Node (önerilen)

```
/home/USER/atlas/                    ← Application root (Node app home)
  package.json
  package-lock.json
  .env                               ← sunucuda oluştur
  dist/
    index.html
    robots.txt
  server/
  knowledge/
  runner/
  data/                              ← writable
    logs/
    telegram-media/
    audio-jobs/
  server/generated/                  ← writable

# public_html seçenekleri:
# 1) Node app doğrudan domain’e bağlıysa public_html’e dokunma / boş tut
# 2) Veya public_html’den reverse proxy yoksa domain’i Node app portuna map et (cPanel Application Manager)
```

### Mod B — Statik public_html + ayrı API

```
/home/USER/public_html/
  index.html                         ← dist/index.html
  robots.txt
  .htaccess                          ← deploy/public_html/.htaccess

/home/USER/atlas-api/                ← Node app
  (server, knowledge, runner, data, .env)
  ATLAS_SERVE_FRONTEND=0
```

Mod B’de frontend’i **yeniden build** edin:

```bash
VITE_BACKEND_URL=https://api.YOURDOMAIN.com npm run build
```

---

## 3. Yerelde paket hazırlama (tek komut)

```bash
npm run prepare:production
```

Çıktı: `release/atlas-v0.8-production/`

Bu klasörü zip’leyip cPanel File Manager / FTP ile yükleyin.

İçerik kontrolü:

- [ ] `dist/index.html` var ve ~700KB+
- [ ] `dist/robots.txt` var
- [ ] `server/index.js` var
- [ ] `.env` **yok** (yalnızca `.env.production.example`)
- [ ] `node_modules` **yok**
- [ ] `data/` boş iskelet

---

## 4. Adım adım deployment

### Adım 1 — Yedek

1. cPanel → File Manager  
2. Mevcut `public_html` ve Node app dizinini `backup_atlas_YYYYMMDD/` olarak kopyala  
3. İndirilebilir zip yedek al

### Adım 2 — Dağınıklığı temizle

1. `public_html` içindeki eski test / çift frontend dosyalarını `backup_…` altına taşı  
2. Yanlış yerdeki `node_modules`, `.env`, `data/*.json` varsa kaldır  
3. **Boşaltılan yerlere hemen yeni paketi koy** (site uzun süre boş kalmasın)

### Adım 3 — Uygulama köküne yükle

1. `release/atlas-v0.8-production/` içeriğini `/home/USER/atlas/` altına çıkar  
2. Mod B ise `deploy/public_html/*` → `public_html/`

### Adım 4 — `.env` oluştur (sunucuda)

1. `.env.production.example` → `.env` kopyala  
2. Doldur:

```env
NODE_ENV=production
PORT=3001
ATLAS_SERVE_FRONTEND=1
ATLAS_SECURE_COOKIES=true
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
ATLAS_CORS_ORIGINS=https://YOURDOMAIN.com,https://www.YOURDOMAIN.com
FRONTEND_ORIGIN=https://YOURDOMAIN.com
ATLAS_INTERNAL_BOT_SECRET=<en-az-16-karakter-rastgele>
BACKEND_URL=http://127.0.0.1:3001
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ENABLE_POLLING=true
```

3. Dosya izinleri: yalnızca app kullanıcısı okusun (ör. `600`)

### Adım 5 — Bağımlılıklar

SSH veya cPanel Terminal / Setup Node.js App:

```bash
cd ~/atlas
npm ci --omit=dev
```

Node **18+** (tercihen 20/22). Bu makinede geliştirme Node 24 ile doğrulandı; hosting Selector’da en yakın LTS seçin.

### Adım 6 — Süreçleri başlat

**Application Manager / Passenger / PM2 — hangisi varsa:**

| Process | Startup file | Env |
|---------|--------------|-----|
| atlas-api | `server/index.js` | `.env` |
| atlas-telegram | `server/telegram.js` | aynı `.env` |

Örnek PM2:

```bash
cd ~/atlas
pm2 start server/index.js --name atlas-api
pm2 start server/telegram.js --name atlas-telegram
pm2 save
```

cPanel “Setup Node.js App” yalnızca **bir** startup file kabul ediyorsa Telegram için ikinci app veya cron/`@reboot` script gerekir — **tek process’te ikisini birleştirmek bu kodda yok**.

### Adım 7 — Domain / port eşlemesi

1. Domain’in Node app’e (veya reverse proxy’ye) işaret ettiğini doğrula  
2. `http://127.0.0.1:PORT/api/ai/health` sunucu içinden 200 dönmeli  
3. Tarayıcı: `https://YOURDOMAIN.com/` → Atlas SPA  
4. Tarayıcı Network: `/api/ai/health` same-origin veya `VITE_BACKEND_URL` host’u

### Adım 8 — SSL (DNS yayılımı sonrası)

1. DNS Namecheap Web Hosting’e geçmiş ve **yayılmış** olsun (`dig` / cPanel Zone Editor)  
2. cPanel → **SSL/TLS Status** → domain için **Run AutoSSL**  
3. Sertifika “valid” olana kadar bekle  
4. **HTTPS yönlendirmesini AutoSSL yeşil olduktan sonra aç**  
   - Mod A: hosting panel “Force HTTPS”  
   - Mod B: `.htaccess` içindeki HTTPS satırlarının yorumunu kaldır  
5. HSTS zaten production’da API yanıtlarına ekleniyor (`Strict-Transport-Security`) — erken Force HTTPS, kırık SSL döneminde siteyi düşürür

### Adım 9 — CORS / cookie

Same-origin Mod A’da CORS daha az kritik; yine de `ATLAS_CORS_ORIGINS` gerçek `https://` origin’leri içermeli.  
`ATLAS_SECURE_COOKIES=true` + HTTPS olmadan oturum cookie’si tarayıcıda tutmaz.

### Adım 10 — Smoke test

| Test | Beklenen |
|------|----------|
| `GET /` | SPA HTML |
| `GET /api/ai/health` | `{ status: "ok", ... }` |
| Web chat kısa mesaj | Yanıt |
| `GET /robots.txt` | Allow |
| Telegram DM | Yanıt (bot process ayaktaysa) |
| Mobil genişlik | Landing / chat okunur |
| `data/logs` / stderr | Stack trace / secret yok |

---

## 5. SSL kontrol listesi

| Durum | Aksiyon |
|-------|---------|
| DNS hâlâ Cloudflare eski NS | AutoSSL başarısız olur — NS Namecheap olmalı |
| DNS yayılıyor | AutoSSL’i zorlamayın; 24–48s sonra tekrar |
| AutoSSL valid | Force HTTPS aç |
| Mixed content | Sayfada `http://` API kalmış mı bak (eski build) — **yeni same-origin build kullan** |

---

## 6. Yayın sonrası kontrol (acceptance)

- [ ] Site HTTPS ile açılıyor  
- [ ] `/api/ai/health` OK  
- [ ] Chat çalışıyor  
- [ ] Session cookie Secure + login (founder)  
- [ ] Telegram ayrı process + heartbeat yazılıyor (`data/telegram.heartbeat.json`)  
- [ ] Audio Studio: provider yoksa dürüst “motor yok” cevabı (sahte mastering yok)  
- [ ] ElevenLabs / Atlas Live: stub — production vaadi yok  
- [ ] Mobil viewport OK  
- [ ] Loglarda API key / bot token yok  
- [ ] Eski dağınık dosyalar `backup_*` dışında canlı path’te yok  

---

## 7. Bilinen sınırlar (dürüst)

| Özellik | Production notu |
|---------|-----------------|
| JSON `data/` | Tek instance; çoklu Node replica için uygun değil |
| Atlas Live | Bellek içi session; restart’ta kaybolur |
| Audio processing | Flag kapalı; ffmpeg/provider gerekir |
| Windows `atlas:autostart` | Linux’ta geçersiz — PM2/systemd kullan |
| Paylaşımlı hosting CPU/RAM | LLM + Telegram için yetersiz kalabilir → VPS’e geçiş planı |

---

## 8. Rollback

1. Node process’leri durdur  
2. `backup_atlas_YYYYMMDD/` içeriğini geri kopyala  
3. Eski `.env` ile process’leri başlat  
4. AutoSSL’e dokunma  

---

## 9. Yerel komutlar (özet)

```bash
# Temiz production paketi
npm run prepare:production

# Sadece paketle (build hazırsa)
node scripts/prepare-production.mjs --skip-build

# Frontend secret sızıntı taraması (varsa)
node server/scripts/scan-frontend-build-secrets.mjs
```
