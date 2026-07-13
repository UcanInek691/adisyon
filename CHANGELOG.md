# CHANGELOG

Tüm önemli değişiklikler burada tutulur. Format: [Keep a Changelog](https://keepachangelog.com/),
Sürümleme: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- **Analiz & tasarım dokümanları:** `CONVENTIONS.md`, `SYSTEM_ANALYSIS.md`, `PROJECT_STRUCTURE.md`,
  `DATABASE_DESIGN.md`, `API_DESIGN.md` (hepsi onaylandı, v1.0).
- **Monorepo iskeleti:** pnpm workspaces (`apps/*`, `packages/*`, `plugins/*`), kök `tsconfig.base.json`
  (strict), Prettier, EditorConfig, `.gitignore`, `.env.example`.
- **`@ado/shared` paketi:** merkezi enum'lar, izin (permission) anahtarları + varsayılan rol haritası,
  para/miktar yardımcıları (kuruş / milis / binde), ULID kimlik üreteci.
- **`prisma/schema.prisma`:** `DATABASE_DESIGN.md`'deki tüm tablolar (40+ model) — her modelde SyncBase
  alanları, finansal append-only tablolar, hash-zincirli `audit_logs`, outbox/sync/conflict tabloları.
  `prisma validate` ✅, client üretildi ✅, shared typecheck ✅.
