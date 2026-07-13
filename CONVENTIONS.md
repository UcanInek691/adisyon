# CONVENTIONS.md — Proje Kuralları (TASLAK — onay bekliyor)

> Bu dosya, projedeki **tüm teknik ve süreç kurallarını** tek yerde toplar.
> Soru turunda (§17) alınan kararlara dayanır. Onaylandıktan sonra "yaşayan doküman"dır;
> her önemli değişiklikte güncellenir ve bir ADR (`docs/adr/`) ile gerekçelenir.

**Durum:** ✅ Kabul edildi (2026-07-13) · **Sürüm:** 1.0 · **Son güncelleme:** 2026-07-13

---

## 1. Karar Özeti (Soru Turu Sonuçları)

| Konu | Karar | Kaynak |
|---|---|---|
| KDV | Ürün bazında KDV alanı; başlangıç oranları %10 ve %20 | A1 |
| Servis ücreti / Kuver | Opsiyonel, varsayılan **kapalı**, ayardan açılır | A2 |
| Gün sonu | **Ayarlanabilir gün sonu saati** (varsayılan 06:00) | A3 |
| Vardiya | Ayrı vardiya yok; **kasa oturumu** (aç/kapa/devir) modeli | A4 |
| Numaralandırma | İnsan-okur günlük sıra no (`YYYYMMDD-####`) **+** global `ULID` | A5 |
| İade | **Ters kayıt (append-only)**; yetki + zorunlu sebep | A6 |
| İndirim yetkisi | Owner tam; Waiter ≤%10, üstü Owner onayı | A7 |
| Roller | **Owner + Waiter** (izin altyapısı esnek, sonradan rol eklenir) | B1 |
| Giriş | Owner: kullanıcı adı + şifre · Waiter: **PIN** | B2 |
| Yazıcı | 80mm birincil + 58mm · USB / Windows Spooler öncelikli | C1 |
| Çıktı yönlendirme | Faz 1'de yok (şema hazır, UI basit) | C2 |
| UI | **Dokunmatik öncelikli** | C3 |
| Şube | Tek şube; `Tenants/Branches` alanları şemada hazır | D1 |
| Ölçek | ~10 masa (dinamik) · 3-5 eşzamanlı · günde birkaç yüz adisyon | D2 |
| Lisans süresi | **Aylık abonelik** + grace period | E1 |
| Cihaz limiti | **Yok** (lisans işletmeye/tenant'a bağlı); `Devices` yine kaydedilir | E2 |
| Planlar | Faz 1'de plan yok; feature-flag altyapısı hazır (ileride) | E3 |
| Güncelleme | Oto-kontrol + **onaylı kurulum**; açık adisyon/mesaide zorlanmaz | F1 |
| Kanal | `stable` (varsayılan) · `beta` **gizli/geliştirici** | F2 |
| Bulut (Faz 2) | Ürünün kendi backend'i; sağlayıcıdan bağımsız | G1 |
| Çakışma | Finansal = append-only · Katalog = last-write-wins + log · çözülemeyen = `conflict` | G2 |
| Buluta gitmeyen | Ham cihaz parmak izi, yerel yollar, şifre hash'leri | G3 |
| Audit saklama | Süresiz; **kademeli imzalı/hash-zincirli arşiv**; hiç silinmez | H1 |
| Audit görüntüleme | **Owner** | H2 |
| Mali | **Bilgi fişi** (mali/ÖKC entegrasyonu kapsam dışı) | I1 |
| Backend | **NestJS** | J1 |
| Kabuk | **Electron** (ince kabuk; backend ayrı süreç) | J2 |
| Dil | **Türkçe** birincil + i18n altyapısı hazır | J3 |
| ORM | **Prisma** (repository katmanıyla soyut) | J4 |
| Commit | **Conventional Commits**, mesaj dili **İngilizce** | K1 |
| Branch | `main` · `develop` · `feature/*` · `fix/*` · `release/*` | K2 |
| Review | PR + en az 1 onay (tek geliştiricide self-review + CI şartı) | K3 |
| Test | **Risk tabanlı**; kritik modüllerde CI kapısı (para/kasa/sync/lisans/audit) | K4 |
| Başlangıç sırası | Kimlik → Ürün → Masa → Sipariş → Ödeme → Yazdırma → (sonra) veresiye/rapor/sync/lisans/update | L1 |

---

## 2. Rol ve Yetki Modeli

Sistem **izin (permission) tabanlıdır**. Rol = izin kümesi. Başlangıçta 2 rol tanımlı:

### Owner (Sahip / Kasa)
- Ana terminalde (Electron) çalışır.
- **Tüm** yetkilere sahip: kasa aç/kapa, ödeme alma/silme, indirim/iptal/iade, ürün ve fiyat yönetimi, veresiye, raporlar, denetim kaydını görüntüleme, ayarlar, lisans, güncelleme, yedekleme.
- Giriş: **kullanıcı adı + şifre** (argon2).

### Waiter (Garson)
- LAN'daki tablet/telefon **tarayıcısından** çalışır (aynı yerel backend'e bağlanır).
- Yetkileri: masa görüntüleme, sipariş açma, ürün ekleme/çıkarma, adet değiştirme, not ekleme, siparişi mutfağa/kasaya iletme.
- **Yetkisi olmayanlar:** ödeme alma, kasa işlemleri, indirim (>%10), iptal onayı, ayarlar, raporlar, denetim kaydı.
- İndirim: yalnızca **≤%10**; üstü **Owner onayı** gerektirir.
- Giriş: **PIN** (hızlı).

> İleride "Müdür", "Kasiyer", "Mutfak" gibi roller eklemek **kod değil, veri** işidir (yeni rol + izin ataması).

---

## 3. Mimari İlkeler (Zorunlu)

- **Clean Architecture:** Domain → Application → Infrastructure → Presentation.
- **SOLID**, **DRY**, **Clean Code**.
- **Repository Pattern** + **Service Pattern**; veri erişimi soyut (SQLite → PostgreSQL = konfigürasyon değişikliği).
- **Dependency Injection** (NestJS IoC).
- **Modüler / plugin tabanlı**: her modül bağımsız, test edilebilir, devre dışı bırakılabilir.
- **Magic string / number YASAK** → sabitler, enum, config.
- **Soyut yazdırma:** çekirdek ESC/POS'a değil, soyut `PrintDocument` modeline yazar.
- **Backend ayrı süreç:** Electron sadece bir istemci; LAN'daki tarayıcılar da istemci.

---

## 4. Teknoloji Yığını

| Katman | Seçim | Not |
|---|---|---|
| Backend | Node.js + TypeScript + **NestJS** | Clean Arch / DI / modülerlik baştan |
| Frontend | React + Vite + TypeScript + TailwindCSS | Dokunmatik öncelikli |
| State/Data | TanStack Query · React Hook Form · **Zod** | Zod tek şema → backend + frontend |
| Kabuk | **Electron** | İnce kabuk; backend ayrı süreç |
| DB (Faz 1) | **SQLite** | Repository ile soyut |
| ORM | **Prisma** | Migration up/down; çoklu-DB |
| Auth | JWT (+ refresh, cihaz bazlı oturum) | Owner şifre / Waiter PIN |
| Logging | **Pino** | Düşük ek yük, yapısal JSON log |
| Yazdırma | ESC/POS + Windows Printer API | Soyut `PrintDocument` üzerinden |
| ID | **ULID** | Sıralı, global benzersiz, offline üretilir |

> Logging için **Pino** öneriliyor (Winston yerine): daha düşük performans maliyeti ve yapısal log. Bu bir ADR ile gerekçelenecek. İtirazın varsa değiştiririz.

---

## 5. Kod Kuralları

- **TypeScript strict mode** zorunlu.
- **ESLint + Prettier** (CI'da kontrol edilir).
- **Husky + Commitlint** (pre-commit lint + test, commit-msg format).
- Her dosya başında kısa amaç açıklaması.
- Fonksiyonlar küçük ve tek sorumluluklu.
- **Kod içi yorum ve tanımlayıcılar: İngilizce.** Kullanıcıya görünen metinler: **Türkçe (i18n dosyalarında)**.
- Kod tekrarı yok (DRY); ortak mantık paylaşılan katmanlarda.

---

## 6. Git Kuralları

- **Branch'ler:** `main` (prod), `develop` (entegrasyon), `feature/*`, `fix/*`, `release/*`.
- **Commit:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` … Mesaj dili **İngilizce**.
- **PR:** Şablon zorunlu; en az 1 onay; CI (lint + test + build) geçmeden merge yok.
- **Issue:** Şablon kullanılır.
- `.env` **asla** commit'lenmez; `.env.example` tutulur.

---

## 7. Test Stratejisi (Risk Tabanlı)

- Yüzde bir "hedef" değil, **kritik modüllerde CI kapısıdır** (testsiz merge engellenir).
- **Zorunlu yüksek kapsam (~%90+):** Ödeme, kasa oturumu, veresiye, senkronizasyon/outbox, lisans doğrulama, audit hash-zinciri.
- **Orta:** Sipariş/adisyon, yazdırma yönlendirme, raporlar.
- **Esnek:** UI/görsel bileşenler.
- Test türleri: birim (domain), entegrasyon (kritik akışlar), e2e (satış → ödeme → fiş).

---

## 8. Güvenlik Kuralları (özet — detay `SECURITY.md`)

- Şifre: **argon2** · PIN: hash'li, brute-force koruması (rate limit + gecikme).
- **Her endpoint'te yetki kontrolü** (frontend gizleme güvenlik değildir).
- Input validation: **Zod** (her sınırda).
- SQL injection: ORM + parametreli sorgu.
- **Sırlar kaynağa yazılmaz.** Örnek değerler: `[API_KEY]`, `[DATABASE_URL]`, `[LICENSE_PRIVATE_KEY]`.
- Lisans ve güncelleme paketleri: **imza doğrulaması zorunlu**.
- Yedekler: **şifreli**.

---

## 9. Dokümantasyon Kuralları

- **Analiz dosyaları (kod öncesi):** `SYSTEM_ANALYSIS.md`, `PROJECT_STRUCTURE.md`, `DATABASE_DESIGN.md`, `API_DESIGN.md`, `MODULES.md`, `SECURITY.md`, `PRINTING_SYSTEM.md`, `PLUGIN_SYSTEM.md`, `LICENSING.md`, `UPDATE_SYSTEM.md`, `SYNC_AND_OFFLINE.md`, `AUDIT_LOG.md`, `ROADMAP.md`.
- **Yaşayan dosyalar:** `CHANGELOG.md`, `DATABASE.md`, `API.md`, `SETUP.md`, `USER_GUIDE.md`, `DEVELOPER_GUIDE.md`, `PRINTING.md`, `REPORTS.md`, `CUSTOMER_DEBT.md`, `CONTRIBUTING.md`, `CONVENTIONS.md`.
- **Kararlar:** `docs/adr/` altında ADR (neden, alternatifler, sonuçlar).
- Her modül tamamlandığında ilgili `.md` güncellenir.

---

## 10. Çalışma Şekli (Süreç)

1. Her adımın başında **plan sun, onay bekle.**
2. Bir adım bitmeden sonrakine geçme.
3. Her adım sonunda: **ne yapıldı / ne eksik / sonraki adım** özeti.
4. Bilinmeyen varsa **sor**, uydurma.
5. Her önemli teknik kararda **ADR** yaz.
