# CHANGELOG

Tüm önemli değişiklikler burada tutulur. Format: [Keep a Changelog](https://keepachangelog.com/),
Sürümleme: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- **İstemci-offline sync API (2026-07-20):** `POST /sync/mutations` (toplu idempotent replay,
  ProcessedClientOp defteri, akıllı birleştirme), `GET /sync/snapshot` (tek istekte aktif durum),
  `GET /sync/health` (token'sız heartbeat), `/offline-reviews` Owner onay kuyruğu
  (yeni_adisyon / yeniden_aç / reddet). Bkz. `OFFLINE_DESIGN.md` §7-9.
- **Cloud yedek (2026-07-19):** şifreli yedeğin isteğe bağlı senkron klasörüne kopyası
  (`backup.cloudDir`) + günlük otomatik yedek 06:00 (`backup.autoDaily`, kapatılabilir).
  Yedekler asla otomatik silinmez.
- **Canlı senkron — SSE (2026-07-19, PR #9):** `GET /events/stream` olay akışı; masa/adisyon
  ekranları anında tazelenir (5 sn polling → SSE + 30 sn emniyet polling'i).
- **Kullanıcı yönetimi (PR #8):** backend CRUD + frontend ekranı.
- **İlk-kurulum sihirbazı (PR #6):** kullanıcısız DB'de owner/garson oluşturma.
- **Frontend MVP + Electron (PR #5):** 14 ekran (satış/kasa/veresiye/finans/rapor/ayarlar),
  LAN statik servis, NSIS masaüstü paketi.
- **Backend Faz-1:** sipariş (indirim/mutfak/held/taşı/merge/split), ödeme (idempotency/split/iade),
  veresiye + CSV ekstre, kasa, gelir-gider, raporlar (gün sonu Z), yazdırma (mutfak/bar ayrımı),
  yedek + restore, kullanıcı/cihaz/ayarlar/health/worker; birim self-check + e2e smoke + CI kapısı.
- **Analiz & tasarım dokümanları:** `CONVENTIONS.md`, `SYSTEM_ANALYSIS.md`, `PROJECT_STRUCTURE.md`,
  `DATABASE_DESIGN.md`, `API_DESIGN.md` (hepsi onaylandı, v1.0).
- **Monorepo iskeleti:** pnpm workspaces (`apps/*`, `packages/*`, `plugins/*`), kök `tsconfig.base.json`
  (strict), Prettier, EditorConfig, `.gitignore`, `.env.example`.
- **`@ado/shared` paketi:** merkezi enum'lar, izin (permission) anahtarları + varsayılan rol haritası,
  para/miktar yardımcıları (kuruş / milis / binde), ULID kimlik üreteci.
- **`prisma/schema.prisma`:** `DATABASE_DESIGN.md`'deki tüm tablolar (40+ model) — her modelde SyncBase
  alanları, finansal append-only tablolar, hash-zincirli `audit_logs`, outbox/sync/conflict tabloları.
  `prisma validate` ✅, client üretildi ✅, shared typecheck ✅.
