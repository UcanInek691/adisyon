# SYSTEM_ANALYSIS.md — Sistem Analizi (TASLAK — onay bekliyor)

> Kod öncesi zorunlu analiz dokümanı. Ürünün **ne olduğu, nasıl çalıştığı, hangi kısıtlarla
> tasarlandığı** ve **Faz 2'ye nasıl hazırlandığı** burada tanımlanır.

**Durum:** ✅ Kabul edildi (2026-07-13) · **Sürüm:** 1.0 · **Son güncelleme:** 2026-07-13

---

## 1. Ürün Tanımı

Kafe, restoran, fast food, büfe, çay ocağı, lokanta, pastane ve nargile cafe gibi işletmeler için
**ticari seviye, offline-first Adisyon / POS otomasyonu.**

**Temel kısıtlar:**
- Özel POS donanımı gerektirmez; normal Windows bilgisayarda çalışır.
- Termal fiş yazıcıları (58mm / 80mm).
- **İnternetsiz tam fonksiyonel** çalışır; bağlantı gelince buluta senkron olur (Faz 2).
- Veriler güvenli, kurtarılabilir, denetlenebilir.

**Hedef:** Çalışan bir program değil; **satılabilir, bakımı kolay, ölçeklenebilir, hızlı, az hatalı ürün.**

---

## 2. Faz Stratejisi

### Faz 1 — Local-First Web Uygulaması
- Backend + frontend aynı makinede; Electron kabuğundan **ve** LAN'daki tarayıcılardan erişilir.
- Veritabanı lokal (SQLite). İnternet gerekmez.
- Lisans doğrulaması **offline** (gömülü public key ile imza kontrolü).
- Yazdırma, raporlama, veresiye, kasa — hepsi lokal.

### Faz 2 — Bulut Bağlantılı Sürüm
- Aynı kod tabanı + Cloud API.
- Lokal veri offline için kaynak-doğru; bağlantı gelince **outbox** buluta işlenir.
- Merkezi yönetim: çok şube, uzaktan rapor, uzaktan güncelleme, lisans yönetimi.

> **Kural:** Faz 1'deki her tablo, senkron için gereken alanları (`id (ulid)`, `created_at`,
> `updated_at`, `deleted_at`, `version`, `device_id`, `sync_state`) **baştan** içerir. Faz 2 için yeniden yazım yok.

---

## 3. Dağıtım ve Süreç Mimarisi (Kritik)

Owner ve Waiter aynı anda farklı istemcilerden çalışacağı için mimari şu şekildedir:

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
   [ Waiter tablet ]   [ Waiter telefon ]   ← tarayıcıdan bağlanır
```

- **Backend, kabuktan bağımsız bir süreçtir.** Electron sadece bir istemci penceresidir.
- LAN'daki tabletler/telefonlar aynı backend'e tarayıcıdan bağlanan **ek terminallerdir**.
- Bu yapı, ileride kabuğu değiştirmeyi (ör. Tauri) veya mobil uygulama eklemeyi backend'i hiç değiştirmeden mümkün kılar.
- **Canlı güncelleme:** masa/sipariş durumları WebSocket ile tüm istemcilere anlık yansır (garson ekler → kasa görür).

---

## 4. Roller ve Ana İş Akışı

- **Owner:** kasa terminali, tam yetki (ödeme, kasa, indirim/iptal/iade, ayar, rapor, lisans, güncelleme).
- **Waiter:** LAN tarayıcısından hızlı sipariş girişi; ödeme/kasa/ayar yetkisi yok.

**Happy path (satış):**
1. Waiter masayı açar → ürünleri ekler → siparişi iletir (mutfak/kasa fişi).
2. Owner kasada adisyonu görür → indirim/servis (varsa) uygular → **ödeme alır** (nakit/kart/parçalı).
3. Müşteri fişi yazdırılır → masa kapanır → kasa hareketi + audit kaydı oluşur.

**Alternatif akışlar:** masa birleştirme/taşıma/bölme, beklemeye alma/tekrar açma, kısmi/parçalı ödeme, iade (ters kayıt), veresiye (borç ekleme/tahsilat).

---

## 5. Fonksiyonel Kapsam (Faz 1)

**Çekirdek (öncelik sırası — L1):**
Kimlik/Yetki → Ürün/Kategori → Masa/Salon → Sipariş/Adisyon → Ödeme → Yazdırma.

**Sonraki dalga:** Veresiye · Gelir/Gider · Raporlar (eklenti) · Offline/Sync katmanı · Denetim kaydı · Lisans · Otomatik güncelleme + rollback.

Modül detayları için: `MODULES.md` (yazılacak).

---

## 6. Veri Mimarisi Prensipleri

- **Her tabloda** senkron alanları (§2 kuralı).
- **Global ID: ULID** (auto-increment değil) → offline üretim + çakışmasız.
- **Finansal kayıtlar append-only:** ödeme, kasa hareketi, veresiye asla üzerine yazılmaz; düzeltme **ters kayıt**la.
- **Soft delete / tombstone:** `deleted_at`.
- **Denetim kaydı:** append-only + **hash zinciri** (oynanamaz) + kademeli imzalı arşiv.
- Detay: `DATABASE_DESIGN.md`, `AUDIT_LOG.md`, `SYNC_AND_OFFLINE.md` (yazılacak).

---

## 7. Eklenti (Plugin) Mimarisi

Çekirdek kod değiştirilmeden genişletilebilecek iki alan:

- **Rapor eklentileri:** `id/name/version/requiredPermissions`, `getParametersSchema()` (Zod), `execute(params, context)`, `getRenderers()` (tablo/grafik/PDF/Excel/CSV/termal). Açılışta **Report Registry** keşfeder, menüye ekler. Veriye yalnızca read-only query context ile erişir.
- **Yazıcı sürücüsü eklentileri:** `PrinterDriver` kontratı (`discover/testPrint/print/getCapabilities`). Çekirdek soyut `PrintDocument`'a yazar; ESC/POS yalnızca bir sürücüdür.
- **Ortak:** manifest (id, sürüm, uyumlu çekirdek aralığı, izinler); sürüm uyumsuzsa yüklenmez; bir eklentinin çökmesi uygulamayı çökertmez (izole hata sınırı); yükleme/kaldırma **audit**'e yazılır.
- Detay: `PLUGIN_SYSTEM.md` (yazılacak).

---

## 8. Lisans, Güncelleme, Senkronizasyon (Özet)

- **Lisans:** asimetrik imzalı, offline doğrulanır (gömülü public key). **Aylık abonelik** + grace period (mesai ortasında kilitleme yok → süre dolunca veri kaybısız kısıtlı mod). **Cihaz limiti yok** (işletmeye bağlı); `Devices` yine kaydedilir. Detay: `LICENSING.md`.
- **Güncelleme:** imzalı + atomik paketler; öncesinde otomatik yedek; migration up/down; rollback; açık adisyon/mesaide zorlanmaz; `stable`/`beta` kanal. Detay: `UPDATE_SYSTEM.md`.
- **Senkron (Faz 2):** önce lokale yaz → outbox → bağlantı gelince sıralı+idempotent gönder. Çakışma: finansal append-only / katalog last-write-wins+log / çözülemeyen `conflict`. Bağlantı durumu her zaman görünür. Detay: `SYNC_AND_OFFLINE.md`.

---

## 9. Güvenlik Özeti

argon2 şifre · PIN brute-force koruması · JWT (+refresh, cihaz oturumu) · her endpoint'te yetki · Zod validation · ORM parametreli sorgu · XSS/CSRF değerlendirmesi · imza doğrulama (lisans + güncelleme) · şifreli yedek · sırlar kaynağa yazılmaz. Detay: `SECURITY.md`.

---

## 10. Kalite ve Performans Hedefleri

- Kasa akışı (ürün ekleme → ödeme) **algılanabilir gecikmesiz** olmalı (yerel DB avantajı).
- 10-40 masa, 3-5 eşzamanlı kullanıcı, günde birkaç yüz adisyon yükü SQLite ile rahat karşılanır.
- Yazıcı kapalıysa iş **kuyruğa alınır, kaybolmaz**, tekrar denenir.
- Risk tabanlı test + CI kapıları (bkz. `CONVENTIONS.md` §7).

---

## 11. Kapsam Dışı (Faz 1)

- **Resmi mali / ÖKC / GİB entegrasyonu** (çıktı "bilgi fişi"; fiş modeli sonradan mali alan eklenebilir tasarlanır).
- Çıktı yönlendirme UI'ı (şema hazır, UI basit).
- Lisans planları/feature-flag kırılımı (altyapı hazır, UI ileride).
- Bulut API'si (Faz 2).

---

## 12. Açık Riskler / İzlenecekler

- Termal yazıcı marka/model çeşitliliği → soyut `PrintDocument` + sürücü eklentisiyle yönetilir.
- LAN çoklu-istemci eşzamanlılığı → WebSocket + iyimser değil gerçek lokal yazma + kayıt kilitleme stratejisi netleştirilecek (`API_DESIGN.md`).
- Grace period suistimali vs. adil kullanım dengesi → `LICENSING.md`'de sayısal değerler netleştirilecek.

---

## 13. Sonraki Adım

Bu taslak ve `CONVENTIONS.md` onaylanınca sıra (§18):
**2) Analiz derinleştirme → 3) Mimari → 4) Veritabanı → 5) API tasarımı → 6) Backend çekirdeği …**

Her adımda önce plan sunulur, onay beklenir. Onaysız kod yazılmaz.
