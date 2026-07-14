# ARCHITECTURE.md — Sistem Mimarisi (Bütünsel Harita)

> Bu doküman, sistemi **tek bakışta** anlamak için yazılmış üst-seviye haritadır.
> Her başlık, konunun **yetkili detay dokümanına** işaret eder (bkz. §12).
> Kod ile doküman çelişirse: davranış için **kod**, karar/gerekçe için **doküman** esastır.

**Durum:** Sürüm 1.0 · **Oluşturuldu:** 2026-07-15 · **Tür:** Yaşayan doküman (her increment'te güncellenir)

---

## 1. Tek Bakışta Sistem

**Ne:** Kafe/restoran/büfe/pastane vb. için **ticari seviye, offline-first Adisyon / POS** otomasyonu. Özel POS donanımı gerektirmez; normal Windows makinede çalışır.

**Zihinsel model:** Tek bir Windows makinesinde çalışan **backend süreci** her şeyin kalbidir. Owner (kasa) ve Waiter (garson tabletleri) ona **istemci** olarak bağlanır. İnternet olmadan tam fonksiyoneldir.

**Faz stratejisi:**

| Faz | Kapsam | Ağ | Durum |
|-----|--------|-----|-------|
| **Faz 1** | Local-first web uygulaması (backend + frontend + Electron kabuk, tek makine; tabletler LAN'dan) | %100 offline | 🚧 Aktif geliştirme |
| **Faz 2** | Bulut senkron (outbox → cloud), çok şube, uzaktan yönetim | Online (offline-toleranslı) | 📋 Planlı (şema baştan hazır) |

> **Altın kural:** Faz 1'deki her tablo, senkron alanlarını (`id (ULID)`, `created_at`, `updated_at`, `deleted_at`, `version`, `device_id`, `sync_state`) **baştan** içerir. Faz 2 için yeniden yazım yoktur.

---

## 2. Monorepo Yerleşimi

pnpm workspace (`apps/*`, `packages/*`, `plugins/*`):

```
ado/
├── apps/
│   └── backend/          # NestJS API + WebSocket (Faz 1 çekirdek) — TEK uygulama şu an
│   └── (frontend/)       # React+Vite+TS+Tailwind — HENÜZ YOK
│   └── (desktop/)        # Electron ince kabuk — HENÜZ YOK
├── packages/
│   └── shared/           # @ado/shared — backend+frontend ORTAK tek kaynak
│       ├── enums.ts      #   sistem enum'ları (roller, offline tipleri, audit origin)
│       ├── permissions.ts#   izin anahtarları (product.manage, cash.manage, ...)
│       ├── money.ts      #   para/miktar/oran integer yardımcıları
│       ├── id.ts         #   newId() → ULID
│       └── index.ts
├── plugins/              # Rapor + yazıcı sürücüsü eklentileri (ileride)
├── prisma/
│   ├── schema.prisma     # 40+ model (tüm domain)
│   ├── migrations/
│   └── dev.db            # SQLite (yerel)
└── *.md                  # tasarım dokümanları (§12)
```

**`@ado/shared` neden kritik:** Zod şemaları, enum'lar, izinler, para/ID mantığı **tek yerde** tanımlanır; hem backend hem frontend aynı tipi kullanır → tip kayması olmaz. **tsup ile çift-format** (ESM+CJS+dts) derlenir; böylece ESM kaynak, CommonJS backend'i kırmaz.

---

## 3. Dağıtım / Çalışma-Zamanı Topolojisi (Kritik)

Backend, Electron kabuğundan **bağımsız bir süreçtir**. Kabuk yalnızca bir istemci penceresidir.

```
   [ Owner terminali (Windows) ]
   ┌─────────────────────────────────────────────┐
   │  Electron kabuğu (ince istemci - UI)         │
   │             │ HTTP/WebSocket (localhost)      │
   │  ┌──────────▼───────────────────────────┐   │
   │  │  Backend süreci (NestJS)             │   │
   │  │  - REST API + WebSocket (canlı masa) │   │
   │  │  - Domain / Application / Infra       │   │
   │  │  - Prisma → SQLite (yerel dosya)      │   │
   │  │  - Yazıcı sürücüleri, outbox, audit   │   │
   │  └──────────▲───────────────────────────┘   │
   └─────────────┼───────────────────────────────┘
                 │ HTTP/WebSocket (LAN)
        ┌────────┴─────────┐
   [ Waiter tablet ]   [ Waiter telefon ]   ← tarayıcıdan bağlanır (PWA)
```

- LAN'daki tabletler/telefonlar aynı backend'e tarayıcıdan bağlanan **ek terminallerdir**.
- **Canlı güncelleme:** masa/sipariş durumları WebSocket ile tüm istemcilere anlık yansır (garson ekler → kasa görür).
- Kabuğu değiştirmek (ör. Tauri) veya mobil uygulama eklemek backend'i **hiç değiştirmeden** mümkündür.

Detay: `SYSTEM_ANALYSIS.md` §3.

---

## 4. Teknoloji Yığını ve Gerekçe

| Katman | Teknoloji | Neden |
|--------|-----------|-------|
| Backend | **NestJS 10** (CommonJS + ts-node, `emitDecoratorMetadata`) | Modüler, DI, decorator; kurumsal desenler hazır |
| ORM / DB | **Prisma + SQLite** | Yerel dosya DB; offline; Faz 2'de Postgres'e taşınabilir şema |
| Ortak tipler | **Zod** (tek şema) + **@ado/shared** | Backend+frontend tek doğrulama kaynağı |
| Kimlik | **JWT** (access+refresh) · **@node-rs/argon2** · PIN | Offline self-contained token; prebuilt argon2 (node-gyp yok) |
| ID | **ULID** (`newId()`) | Offline üretilebilir, sıralı, çakışmasız |
| Loglama | **nestjs-pino** (requestId=ULID) | Yapısal, hızlı, istek izlenebilir |
| Frontend (planlı) | **React + Vite + TS + Tailwind + TanStack Query** | Dokunmatik öncelikli hızlı UI; sunucu-durum yönetimi |
| Kabuk (planlı) | **Electron** | İnce istemci; backend süreç yöneticisi |

**Para/veri kuralı (float YASAK):** para = integer **kuruş**; miktar = integer **milis** (×1000, kg satışı); oran = integer **binde** (%10 → 100). Detay: `packages/shared/money.ts`, `CONVENTIONS.md`.

---

## 5. Backend Mimarisi — Hedef vs. Gerçekleşen

**Hedef (aspirational):** `PROJECT_STRUCTURE.md`, modül başına 4 katmanlı Clean Architecture (`domain / application / infrastructure / presentation`) + `core/` tarif eder. Bu **yön hedefidir**.

**Gerçekleşen (as-built):** Çekirdek küçükken pragmatik, yalın NestJS modül düzeni kullanılıyor. Modüller büyüdükçe hedef katmanlaşmaya doğru evrilecek.

```
apps/backend/src/
├── main.ts                 # bootstrap (Nest app, pino, global pipe)
├── bootstrap-env.ts        # .env yükleme (uygulama ayağa kalkmadan)
├── app.module.ts           # kök modül: global filter/interceptor/guard sırası
│
├── config/                 # env.schema.ts (zod fail-fast) + AppConfigService
├── prisma/                 # PrismaModule + PrismaService (lifecycle)
│
├── auth/                   # ── İLK DİKEY DİLİM (tamamlandı) ──
│   ├── auth.controller.ts  #   /auth/login, /login-pin, /refresh, /logout, /me
│   ├── auth.service.ts     #   argon2, oturum, brute-force kilit
│   ├── token.service.ts    #   JWT üret/doğrula, TTL role-bağlı
│   ├── guards/             #   JwtAuthGuard + PermissionsGuard (global)
│   └── dto/auth.schemas.ts #   Zod
│
├── catalog/                # ── SIRADAKİ (kısmen: yalnız dto/) ──
│   └── dto/catalog.schemas.ts
│
├── common/                 # ── Kesişen ilgiler ──
│   ├── http/               #   AllExceptionsFilter, ResponseInterceptor, ZodValidationPipe
│   ├── audit/              #   AuditService (hash-zincirli) + AuditModule (@Global)
│   ├── decorators/         #   @Public, @RequirePermissions, @CurrentUser
│   └── util/               #   duration (TTL ayrıştırma)
│
└── seed.ts                 # idempotent tohum (tenant, izinler, roller, owner+garson)
```

**Modül ekleme deseni** (her yeni domain modülü):
`dto/*.schemas.ts` (Zod) → `*.service.ts` (branchId izole, soft-delete, version++, audit) → `*.controller.ts` (izin decorator'ları + ZodValidationPipe) → `*.module.ts` → `AppModule.imports`.

---

## 6. İstek Yaşam Döngüsü (Kesişen Akış)

Her REST isteği aynı boru hattından geçer:

```
HTTP isteği
   │
   ▼ nestjs-pino            → requestId = ULID (x-request-id header)
   ▼ JwtAuthGuard (global)  → token doğrula, req.user = AuthUser
   ▼ PermissionsGuard       → @RequirePermissions ile karşılaştır (403)
   ▼ ZodValidationPipe      → body/query doğrula (422)
   ▼ Controller             → ince; servise devreder
   ▼ Service                → iş kuralı + Prisma; mutasyonda AuditService.record()
   ▼ ResponseInterceptor    → { success: true, data, meta }
   │   (hata olursa)
   ▼ AllExceptionsFilter    → { success: false, error: { code, message, details } }
   ▼
HTTP yanıtı
```

- **`@Public()`** işaretli uçlar JwtAuthGuard'ı atlar (login vb.).
- Yanıt zarfı standardı: `API_DESIGN.md` §2.
- Token **kendinden yeterli**: izinler token'a gömülüdür → offline yetki kontrolü mümkün.

---

## 7. Kesişen İlgiler (Cross-Cutting)

| İlgi | Nerede | Özet |
|------|--------|------|
| **Kimlik/Yetki** | `auth/`, guards | Owner=şifre (15 dk access), Waiter=PIN (12 saat access / 30 gün refresh — mesai ortasında kilit yok). İzinler esnek; token'a gömülü. |
| **Yanıt zarfı** | `ResponseInterceptor` | Başarı: `{success,data,meta}` · Hata: `{success,error}` |
| **Hata yönetimi** | `AllExceptionsFilter` | Tüm istisnaları tek biçime indirger; log'a requestId ekler |
| **Doğrulama** | `ZodValidationPipe` | `@ado/shared` şemalarıyla; 422 |
| **Denetim kaydı** | `AuditService` (@Global) | Append-only + **SHA-256 hash zinciri** (her kayıt öncekinin hash'ini içerir → oynanamaz). Yalnız Owner görür. Detay: `AUDIT_LOG.md` (yazılacak) |
| **İdempotency** | `clientOpId` (ULID) | Offline mutasyonlar uçtan uca idempotent; `ProcessedClientOp` defteri. Sipariş/sync modülünde devreye girer |

---

## 8. Veri Mimarisi Prensipleri

- **Global ID: ULID** — offline üretim, sıralı, çakışmasız (auto-increment değil).
- **Para/miktar/oran: integer** — kuruş / milis / binde. **Float yasak.**
- **Finansal kayıtlar append-only** — `payments`, `cash_transactions`, `debt_transactions`, `audit_logs` asla üzerine yazılmaz; düzeltme **ters kayıt**la.
- **Soft delete** — `deleted_at` (tombstone); sorgular `deletedAt: null` filtreler.
- **Denetim** — hash-zincirli, süresiz saklanır (kademeli imzalı arşiv).
- **SyncBase** — her tabloda senkron alanları (§1 altın kuralı).

Detay: `DATABASE_DESIGN.md`.

---

## 9. İki Ayrı Senkron Sınırı (Karıştırma!)

Sistemde **iki farklı** offline/senkron sınırı var; aynı şey değiller:

```
(A) Yerel sunucu ──────────────► Cloud           = FAZ 2
    (outbox)          internet    SyncQueue/Conflict şemada hazır

(B) Waiter tablet ─────────────► Yerel sunucu     = FAZ 1 (istemci-offline)
    (IndexedDB outbox)   LAN      OFFLINE_DESIGN.md
```

- **(A) Faz 2:** Yerel DB → bulut. Çakışma: finansal append-only / katalog last-write-wins+log / çözülemeyen `conflict`.
- **(B) Faz 1:** LAN kopunca garson tableti siparişi **tarayıcıda (IndexedDB) kuyruğa** alır; bağlantı gelince push + tek seferlik snapshot refetch. Kapalı/ödenmiş masaya denk gelen offline işlem → **Owner review** (`PendingOfflineReview`).
- **Ortak omurga:** `clientOpId` (ULID) idempotency, uçtan uca taşınır.

Detay: `OFFLINE_DESIGN.md` (B), `SYNC_AND_OFFLINE.md` (A, yazılacak).

---

## 10. Modül Durumu ve Yol Haritası

İlk dikey dilim (L1): **Kimlik → Ürün → Masa → Sipariş → Ödeme → Yazdırma**.

| Modül | Durum |
|-------|-------|
| Monorepo + `@ado/shared` + Prisma şema | ✅ |
| Kimlik/Yetki (`auth/`) | ✅ |
| Denetim (`common/audit/`) | ✅ |
| **Katalog** (Ürün/Kategori/Birim/Vergi) | 🚧 dto hazır, service/controller sırada |
| Masa/Salon | ⏭️ |
| Sipariş/Adisyon (+ WebSocket canlı masa) | ⏭️ |
| Ödeme | ⏭️ |
| Sync modülü (`/sync/*` + idempotency guard) | ⏭️ |
| Yazdırma | ⏭️ |
| Frontend (React) + Electron kabuk | ⏭️ |

---

## 11. Altyapı ve Maliyet Özeti

Local-first mimarinin doğal sonucu: **kurulum başına yinelenen bulut maliyeti ≈ 0.**

- **Faz 1 (kurulum başına):** backend+DB işletmenin kendi PC'sinde → sunucu/DB hosting yok, internet şart değil, LLM/API maliyeti yok.
- **Ürün sahibi sabit giderleri (~15–30 USD/ay):** lisans doğrulama sunucusu (~5 USD veya serverless), güncelleme dağıtımı (~0–5 USD), domain (~1 USD), **kod imzalama sertifikası** (~10–17 USD/ay, en büyük kalem). Müşteri sayısından bağımsız.
- **Faz 2 (bulut açılınca, ~25–50 USD/ay başlangıç):** managed Postgres, backend hosting, yedek object storage; POS delta verisi küçük olduğu için yavaş ölçeklenir.

Kapsam dışı (Faz 1): ÖKC/GİB/ödeme-gateway → o işlem-başı maliyetler yok (çıktı "bilgi fişi").

---

## 12. Doküman Haritası (Yetkili Kaynaklar)

| Doküman | Kapsam | Durum |
|---------|--------|-------|
| **ARCHITECTURE.md** (bu dosya) | Bütünsel harita | v1.0 |
| `ROADMAP.md` | Platform altyapı katmanları: ne zaman eklenir (Tier A/B/C + reddedilenler) | v1.0 |
| `CONTRIBUTING.md` | İki kişilik ekip çalışma sözleşmesi (rol/sahiplik, dal modeli, migration protokolü) | v1.0 |
| `CONVENTIONS.md` | Kararlar, kod/iş kuralları (yetkili karar kaynağı) | ✅ v1.0 |
| `SYSTEM_ANALYSIS.md` | Ürün tanımı, faz stratejisi, dağıtım, kapsam | ✅ v1.0 |
| `PROJECT_STRUCTURE.md` | Hedef mimari (Clean Arch, klasör düzeni) | ✅ v1.0 |
| `DATABASE_DESIGN.md` | 40+ model, ilişkiler, indeksler | ✅ v1.0 |
| `API_DESIGN.md` | REST/WS uçları, zarf, hata kodları, auth, sync uçları | ✅ v1.1 |
| `OFFLINE_DESIGN.md` | İstemci-offline (B sınırı): IndexedDB outbox, merge, review | ✅ v1.0 |
| `EVENT_BUS.md` · `DOMAIN_EVENTS.md` | Event Bus + domain event sözleşmesi (Tier A) | 🚧 inşa ediliyor |
| `BACKGROUND_WORKERS.md` | Kalıcı iş kuyruğu + worker + scheduler (Tier A) | 🚧 inşa ediliyor |
| `HEALTH_SYSTEM.md` · `FEATURE_FLAGS.md` | Health check + feature flag (Tier A) | 🚧 inşa ediliyor |
| `AUDIT_LOG.md` | Hash zinciri + imzalı arşiv detayı | ⏳ yazılacak |
| `SYNC_AND_OFFLINE.md` | Faz 2 cloud senkron (A sınırı) | ⏳ yazılacak |
| `LICENSING.md`, `UPDATE_SYSTEM.md`, `SECURITY.md`, `PLUGIN_SYSTEM.md`, `MODULES.md` | İlgili alt sistemler | ⏳ yazılacak |
