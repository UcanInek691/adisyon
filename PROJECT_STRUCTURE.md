# PROJECT_STRUCTURE.md — Mimari ve Klasör Yapısı (TASLAK — onay bekliyor)

> Projenin fiziksel yerleşimi, katman sınırları ve modül organizasyonu.
> `CONVENTIONS.md` (kurallar) ve `SYSTEM_ANALYSIS.md` (ne/neden) ile birlikte okunur.

**Durum:** ✅ Kabul edildi (2026-07-13) · **Sürüm:** 1.0 · **Son güncelleme:** 2026-07-13

---

## 1. Depo Modeli: Monorepo

Backend, frontend, Electron kabuğu ve paylaşılan kod **tek bir monorepo**'da yaşar.

**Neden monorepo?**
- Zod şemaları, tipler ve sabitler backend ile frontend arasında **tek kaynaktan** paylaşılır (DRY — `CONVENTIONS.md` §5).
- Tek sürümleme, tek CI, atomik değişiklik (backend + frontend aynı PR'da tutarlı).
- Eklenti kontratları hem çekirdek hem eklentiler tarafından ortak kullanılır.

**Araç:** **pnpm workspaces** (hızlı, disk-verimli, monorepo'ya uygun). Build orkestrasyonu için `turbo` (opsiyonel, ileride) — ADR ile.

```
ado/                              # depo kökü
├─ apps/
│  ├─ backend/                    # NestJS API (yerel sunucu süreci)
│  ├─ frontend/                   # React + Vite (Owner kasa + Waiter web)
│  └─ desktop/                    # Electron kabuğu (ince istemci)
├─ packages/
│  ├─ shared/                     # ortak tipler, Zod şemaları, sabitler, enum'lar
│  ├─ contracts/                  # eklenti kontratları (ReportPlugin, PrinterDriver, PrintDocument)
│  └─ config/                     # paylaşılan tsconfig, eslint, prettier
├─ plugins/
│  ├─ printer-escpos/             # ESC/POS yazıcı sürücüsü (referans eklenti)
│  └─ report-end-of-day/          # Gün sonu raporu (referans eklenti)
├─ prisma/                        # şema + migration'lar (up/down)
├─ docs/
│  ├─ adr/                        # Architecture Decision Records
│  └─ *.md                        # analiz + yaşayan dokümanlar
├─ .github/                       # PR/issue şablonları, CI
├─ package.json                   # workspace kökü
├─ pnpm-workspace.yaml
└─ turbo.json                     # (opsiyonel)
```

> Not: Aynı Windows makinesinde `desktop` çalışırken `backend`'i bir alt-süreç (veya Windows service) olarak başlatır; `frontend` build çıktısı hem Electron penceresine hem de LAN tarayıcılarına aynı backend'ten servis edilir.

---

## 2. Backend — Clean Architecture Katmanları

NestJS içinde her **iş modülü** dört katmana ayrılır. Bağımlılık **yalnızca içeri doğru** akar
(Presentation → Application → Domain; Infrastructure, Domain'in tanımladığı arayüzleri uygular).

```
Presentation  →  Application  →  Domain  ←  Infrastructure
 (controllers)    (use-cases)     (entity,      (Prisma repo,
  DTO, guards      services       value obj,     yazıcı, dış
  WebSocket)       orchestration) kurallar,      dünya)
                                  repo arayüzü
```

```
apps/backend/src/
├─ main.ts                        # bootstrap (HTTP + WebSocket)
├─ app.module.ts
├─ core/                          # çapraz kesen altyapı (framework seviyesi)
│  ├─ config/                     # env okuma, tipli config (magic yok)
│  ├─ database/                   # Prisma bağlantısı, transaction yönetimi
│  ├─ auth/                       # JWT, guard'lar, Owner/Waiter yetki
│  ├─ audit/                      # hash-zincirli denetim kaydı servisi
│  ├─ outbox/                     # SyncQueue yazımı (Faz 2 hazırlığı)
│  ├─ realtime/                   # WebSocket gateway (canlı masa/sipariş)
│  ├─ printing/                   # PrintDocument oluşturma + sürücü köprüsü
│  ├─ plugins/                    # Plugin loader + Report/Printer registry
│  ├─ licensing/                  # imza doğrulama, grace period
│  └─ logging/                    # Pino kurulumu
└─ modules/                       # İŞ MODÜLLERİ (her biri dört katmanlı)
   ├─ identity/                   # Users, Roles, Permissions, Sessions, Devices
   ├─ catalog/                    # Products, Categories, Units, Taxes, Discounts
   ├─ tables/                     # Halls, Tables
   ├─ orders/                     # Orders, OrderItems, notlar
   ├─ billing/                    # Adisyon: indirim/servis/kuver/KDV/toplam
   ├─ payments/                   # Payments (append-only), iade
   ├─ cash/                       # CashSession, CashTransaction
   ├─ customers/                  # Customers, DebtAccounts, DebtTransactions
   ├─ finance/                    # Income, Expense, kategoriler
   ├─ inventory/                  # Stok, hareketler, tedarikçi, alış
   ├─ reports/                    # rapor eklenti host'u + çekirdek raporlar
   ├─ settings/                   # ApplicationSettings
   └─ updates/                    # UpdateHistory, güncelleme akışı
```

**Tek bir modülün iç yapısı (örnek: `payments`):**

```
modules/payments/
├─ domain/
│  ├─ payment.entity.ts           # kurallar (append-only, ters kayıt mantığı)
│  ├─ payment.repository.ts       # ARAYÜZ (interface) — Infra'ya bağımlı değil
│  └─ value-objects/              # Money, PaymentMethod (enum)
├─ application/
│  ├─ take-payment.use-case.ts    # iş akışı orkestrasyonu
│  ├─ refund-payment.use-case.ts  # iade = ters kayıt
│  └─ dto/                        # Zod-türetilmiş giriş/çıkış tipleri
├─ infrastructure/
│  └─ prisma-payment.repository.ts# repo arayüzünün Prisma implementasyonu
└─ presentation/
   ├─ payments.controller.ts      # REST endpoint + yetki guard'ı
   └─ payments.module.ts          # DI bağlama (arayüz → implementasyon)
```

**Kilit kural:** Domain katmanı **Prisma'yı, NestJS'i, HTTP'yi bilmez.** Böylece SQLite → PostgreSQL
veya ORM değişimi yalnızca `infrastructure/` içini etkiler (`CONVENTIONS.md` §3).

---

## 3. Frontend — Feature-Based

Tek React uygulaması iki deneyimi barındırır: **Owner kasa** ve **Waiter web**. Rol, girişte
belirlenir ve yalnızca yetkili özellikler render edilir (ama gerçek yetki **backend**'te — güvenlik).

```
apps/frontend/src/
├─ app/                           # router, providers (TanStack Query, tema, i18n)
├─ shared/                        # UI kit (dokunmatik öncelikli), hooks, api client
│  ├─ ui/                         # Button, NumPad, TableTile, ... (Tailwind)
│  ├─ api/                        # tip-güvenli API çağrıları (shared Zod tipleri)
│  └─ realtime/                   # WebSocket client (canlı masa durumu)
├─ features/
│  ├─ auth/                       # Owner şifre / Waiter PIN girişi
│  ├─ tables/                     # masa haritası, birleştir/taşı/böl
│  ├─ order-entry/                # hızlı ürün ekleme (Waiter'ın ana ekranı)
│  ├─ billing/                    # adisyon, indirim, servis
│  ├─ payment/                    # ödeme, parçalı ödeme, para üstü
│  ├─ customers/                  # veresiye, ekstre
│  ├─ reports/                    # rapor eklentilerini dinamik render (registry)
│  ├─ cash/                       # kasa aç/kapa
│  └─ settings/                   # ayarlar, yazıcı, lisans, güncelleme
└─ locales/                       # i18n (tr birincil, en hazır)
```

---

## 4. Paylaşılan Katman (`packages/`)

- **`packages/shared`** — Zod şemaları (tek şema → backend validation + frontend form + tip
  türetme), enum'lar (`PaymentMethod`, `OrderStatus`, `SyncState`, `TableStatus`…), sabitler,
  ortak yardımcılar. **Hem backend hem frontend buradan import eder.** Magic string/number yasağının
  merkezi (`CONVENTIONS.md` §3).
- **`packages/contracts`** — eklenti kontratları: `ReportPlugin`, `PrinterDriver`, `PrintDocument`,
  `PluginManifest`. Çekirdek ve eklentiler ortak bağımlıdır; **çekirdek somut eklentilere bağımlı değildir.**
- **`packages/config`** — paylaşılan `tsconfig`, ESLint, Prettier ayarları.

---

## 5. Eklenti Yerleşimi (`plugins/`)

Her eklenti kendi paketi; bir **manifest** + kontrat implementasyonu içerir.

```
plugins/printer-escpos/
├─ manifest.json                  # id, name, version, compatibleCore, permissions
├─ src/escpos.driver.ts           # PrinterDriver implementasyonu
└─ package.json

plugins/report-end-of-day/
├─ manifest.json
├─ src/end-of-day.report.ts       # ReportPlugin implementasyonu
└─ package.json
```

- Çekirdek, açılışta `plugins/` (ve ileride kullanıcı eklenti dizini) tarar → **registry**'ye kaydeder.
- Sürüm uyumsuz manifest yüklenmez; hata kullanıcıya net gösterilir; yükleme/kaldırma **audit**'e yazılır.
- Bir eklentinin çökmesi çekirdeği çökertmez (izole hata sınırı) — detay `PLUGIN_SYSTEM.md`.

---

## 6. Veritabanı Katmanı (`prisma/`)

```
prisma/
├─ schema.prisma                  # tüm modeller (her modelde sync alanları)
├─ migrations/                    # up migration'lar (Prisma)
└─ down/                          # el ile yazılan geri (down) scriptleri
```

- Her migration için **ileri (up) ve geri (down)** yazılır (`UPDATE_SYSTEM.md` gereği).
- Yıkıcı migration → önce otomatik yedek + açık onay.
- Repository arayüzleri Domain'de; Prisma implementasyonları modüllerin `infrastructure/`sinde.

---

## 7. Süreçler ve İletişim

| Süreç | Sorumluluk | İletişim |
|---|---|---|
| **backend (NestJS)** | tüm iş mantığı, DB, yazdırma, outbox, audit | REST + WebSocket (localhost + LAN) |
| **desktop (Electron)** | pencere, otomatik güncelleme, backend'i başlatma, USB/yazıcı köprüsü | backend'e HTTP/WS |
| **frontend (tarayıcı)** | UI (Owner + Waiter) | backend'e HTTP/WS |

- **REST:** komutlar (sipariş oluştur, ödeme al) ve sorgular.
- **WebSocket:** canlı durum yayını (masa doldu/boşaldı, yeni sipariş) → tüm istemcilere anında.

---

## 8. İsimlendirme Kuralları

- Klasör/dosya: `kebab-case` (`take-payment.use-case.ts`).
- Sınıf/tip: `PascalCase`; değişken/fonksiyon: `camelCase`; sabit: `UPPER_SNAKE_CASE`.
- Dosya sonekleri: `.entity.ts`, `.repository.ts`, `.use-case.ts`, `.controller.ts`, `.dto.ts`, `.module.ts`, `.driver.ts`, `.report.ts`.
- Enum ve sabitler `packages/shared`'da; kodda **çıplak string/number yasak**.

---

## 9. Bağımlılık Kuralları (Zorunlu — lint ile denetlenecek)

1. `domain` hiçbir dış katmana (Prisma, Nest, HTTP) bağımlı **olamaz**.
2. `application` yalnızca `domain` arayüzlerine bağımlıdır.
3. `infrastructure` `domain` arayüzlerini **uygular**, dışarı sızmaz.
4. Çekirdek `plugins/`'e bağımlı **olamaz**; yalnızca `packages/contracts`'a.
5. `frontend` DB'ye **doğrudan** erişemez; yalnızca backend API.
6. Modüller arası doğrudan repo erişimi yok; **use-case / servis** üzerinden.

---

## 10. Sonraki Adım

Bu yapı onaylanınca sıra (§18): **4) Veritabanı tasarımı (`DATABASE_DESIGN.md`)** — tüm tablolar,
alanlar, ilişkiler, sync alanları, append-only ve audit hash-zinciri şeması.
