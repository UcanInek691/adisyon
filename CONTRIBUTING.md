# CONTRIBUTING — İki Kişilik Ekip Çalışma Sözleşmesi

> Amaç: iki geliştirici (**Maya** ve **Çağrı**) GitHub üzerinde **birbirinin alanına dokunmadan**
> paralel çalışabilsin. Mimari (modüler + Event Bus) bunu zaten mümkün kılıyor; bu dosya kuralları netleştirir.
> Genel mimari: `ARCHITECTURE.md` · Kararlar: `CONVENTIONS.md` · Yol haritası: `ROADMAP.md`.

---

## 1. Roller ve Sahiplik

| Rol | Kişi (GitHub) | Alan |
|-----|---------------|------|
| **Maya** | `@UcanInek691` | Satış hattı: **Masa/Salon → Sipariş → Ödeme** + istemci-offline |
| **Çağrı** | `@mhmmtds0` | Platform/destek: kalan **Tier A** (worker, scheduler, health, feature-flag) + **Yazdırma**, **Rapor**, **Kasa**, **Veresiye**, **Stok**, **Backup** |
| **Çekirdek** | ikisi birlikte | Auth, Katalog, Event Bus, `common/`, `config/`, `prisma`, `@ado/shared` |

Sahiplik `.github/CODEOWNERS` ile teknik olarak zorlanır: bir alana PR açıldığında sahibi **zorunlu inceleyici** olur; onayı olmadan merge edilemez. **Çekirdeğe** dokunan PR ikisinin de onayını ister.

**Altın kural:** Kendi alanında özgürce çalış; başkasının alanına **doğrudan dokunma**. İhtiyacın olan şey karşı taraftaysa, **sözleşme** üzerinden al (aşağıya bak), koduna girme.

---

## 2. Modüller Nasıl Konuşur (contract-first)

Modüller birbirini **doğrudan import edip çağırmaz**. İki tek meşru bağlantı noktası:

1. **Event Bus** — yan etkiler için. Örn. Yazdırma (Çağrı), `order.paid` (Maya) event'ine `@OnEvent` ile abone olur; Maya'nın kodu değişmez. Bkz. `EVENT_BUS.md`, `DOMAIN_EVENTS.md`.
2. **`@ado/shared`** — ortak tipler/sözleşmeler (enum, izin, event zarfı/adları, para). Yeni bir kesişim gerekiyorsa **önce burada sözleşmeyi** tanımlayın (küçük PR, iki onay), sonra herkes kendi tarafını uygular.

> Yeni cross-module ihtiyaç = önce `@ado/shared`'da sözleşme PR'ı. Böylece iki kişi paralel, birbirini beklemeden ilerler.

---

## 3. Dal Modeli

```
main      ← yalnız sürüm (korumalı)
  ▲
develop   ← entegrasyon dalı (korumalı, herkes buraya PR açar)
  ▲
feature/* ← her görev kendi dalı  (feature/maya-orders, feature/cagri-printing ...)
```

- `main` ve `develop`'a **doğrudan push yok** — yalnız PR + review + CI yeşil.
- Dal adı: `feature/<rol>-<konu>` (ör. `feature/maya-tables`, `feature/cagri-worker`).
- Küçük ve sık PR; uzun yaşayan dal = büyük çakışma.

---

## 4. Prisma Şeması ve Migration Protokolü (çakışma önleme)

Şema **domain başına ayrı dosya**: `prisma/schema/*.prisma`. Herkes **yalnız kendi domain dosyasını** düzenler → şema çakışması olmaz.

**Migration kuralları:**
1. Migration üretmeden önce `git pull` + `pnpm prisma:generate`.
2. Yalnızca **kendi modellerinin** migration'ını üret: `pnpm prisma:migrate --name <rol>_<konu>` (ör. `maya_orders_init`).
3. `prisma/dev.db` **kişiye özeldir** (gitignore'da) — commit edilmez, paylaşılmaz.
4. Migration klasörü çakışırsa (aynı anda üretim): dal güncelle, migration'ı yeniden üret, çakışan tarihli klasörü at.
5. `prisma/migrations/` çekirdek sayılır (iki onay).

---

## 5. Yerel Kurulum

```bash
pnpm install
cp .env.example .env          # DATABASE_URL vb. doldur
pnpm prisma:generate
pnpm --filter @ado/shared build
pnpm prisma:migrate           # ilk kurulum / şema güncelleme
pnpm --filter backend seed    # örnek veri (owner + garson)
pnpm --filter backend dev     # backend http://127.0.0.1:3001/api/v1
```

---

## 6. Commit ve Hook'lar

- **Conventional Commits** zorunlu (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`). commit-msg hook'u (commitlint) doğrular.
- **pre-commit** hook'u staged dosyalara prettier uygular (lint-staged).
- Mesaj İngilizce; kod yorumları İngilizce, kullanıcı-metni Türkçe (`CONVENTIONS.md` §7).
- Hook'ları atlama (`--no-verify`) yalnız gerçek zorunlulukta.

---

## 7. Kalite Kapıları (CI her PR'da çalışır)

`pnpm install → prisma generate/validate → shared build → format:check → lint → typecheck` (+ testler geldikçe).
PR açmadan önce yerelde: `pnpm lint && pnpm typecheck && pnpm format:check`.

Merge şartları: CI yeşil **+** ilgili alan sahibinin onayı.

---

## 8. Değişmeyen İlkeler

Offline-first korunur · SQLite merkezde · Cloud sync Faz 2 · Yazıcı/Rapor plugin tabanlı · Lisans/Güncelleme değişmez · Audit **append-only + hash-chain** bozulmaz · float yasak (integer kuruş/milis/binde) · ID = ULID. Detay: `CONVENTIONS.md`, `ARCHITECTURE.md`.
