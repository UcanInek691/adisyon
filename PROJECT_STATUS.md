# PROJECT_STATUS.md — Bütünsel Durum & Eksik Haritası

> Yaşayan belge. Tüm projenin (kim yazdığından bağımsız) tasarım dokümanlarına
> (`SYSTEM_ANALYSIS.md §5`, `API_DESIGN.md`, `DATABASE_DESIGN.md`, `ROADMAP.md`)
> karşı **ne yapıldı / kısmi / eksik** durumunu tek yerde tutar.

**Oluşturuldu:** 2026-07-16 · **Güncellendi:** 2026-07-20 · **Legend:** ✅ tam · 🟡 kısmi · ❌ yok

---

## L1 — Çekirdek Happy Path (satış akışı)

| Alan | Durum | Not |
|------|-------|-----|
| Kimlik / Yetki | ✅ | — |
| Ürün / Kategori / Birim / Vergi | ✅ | — |
| Masa / Salon | ✅ | — |
| Sipariş / Adisyon | ✅ | Çekirdek + indirim + mutfağa iletme + held/resume + masa-taşı + **birleştir/böl (merge/split)** |
| Ödeme (payments) | ✅ | Temel + idempotency + split + **iade/reversal** |
| Yazdırma (printing) | ✅ | Müşteri + mutfak/**bar fişi (kategori ayrımı)** + Receipt kaydı |

**Bu oturumda tamamlananlar:**
1. ✅ İade / reversal — ters kayıt + `order.refunded` + geri-açma + kasa/veresiye dinleyicileri
2. ✅ Adisyon indirimi — %/tutar, >%10 Owner eşiği, uygula/kaldır, recompute
3. ✅ Mutfağa iletme — `order.item.sent` + mutfak fişi + kalem kilidi
4. ✅ Receipt kaydı — müşteri+mutfak fişleri kalıcı (reprint/audit)
5. ✅ Held / beklet–tekrar aç
6. ✅ Masa taşı + **birleştir/böl (merge/split)** — smoke ile doğrulandı (toplam korunuyor)

---

## Sonraki Dalga (Faz 1)

| Alan | Durum | Not |
|------|-------|-----|
| Veresiye (customer/debt) | ✅ | Bug'lar + iade dinleyicisi. Ekstre PDF sonraki iş |
| Kasa (cash) | ✅ | Bug düzeltildi. İdempotency → aşağıya bkz |
| **Gelir / Gider (finance)** | ✅ | **YENİ MODÜL** — kategori/gider/gelir + kasa entegrasyonu (doğrulandı) |
| **Ayarlar (settings)** | ✅ | **YENİ MODÜL** — key-value (doğrulandı) |
| **Cihaz (devices)** | ✅ | **YENİ MODÜL** — kayıt/liste/güven/sil (doğrulandı) |
| Raporlar | ✅ | Sabit uçlar + **gün sonu (Z) özeti** (satış+ödeme+kasa+gider/gelir). Plugin registry — bilinçli sadeleştirme |
| Veresiye ekstre | ✅ | **CSV indir** (`/customers/:id/statement.csv`, yürüyen bakiye). PDF render sunum/frontend katmanı |
| Stok (inventory) | 🟡 | Opt-in, varsayılan kapalı. Descope adayı |
| Denetim (audit) | ✅ | — |
| Yedek (backup) | ✅ | Al/listele/sil + **restore** (çöz+doğrula+stage; atomik takas restart'ta) + **günlük otomatik yedek (06:00)** + **isteğe bağlı bulut kopyası** (senkron klasörüne; OneDrive/Drive sağlayıcı bağımsız). Yedekler asla otomatik silinmez |
| Health / Worker / Scheduler / Feature-flags | ✅ | Bug'lar düzeltildi |

---

## Bilinçli Ertelenenler (gerekçeli)

| İş | Neden şimdi değil |
|----|-------------------|
| **Kasa/veresiye idempotency** | Tüketicisi offline-sync (Faz 2); şu an tek terminal online. Şema migration gerektirir → tüketici gelince. (Payments'ta zaten var) |
| **Ekstre PDF (pixel)** | Veri + CSV export hazır; PDF render için lib gerekir → frontend/print katmanıyla gelir |
| **Backup atomik takas** | Süreç açıkken canlı SQLite kilit riski; denetleyici restart akışı (Crash Recovery, Tier B) |

---

## Faz 2 / Büyük Bloklar (ayrı projeler — bloklamıyor)

| Alan | Durum |
|------|-------|
| **Frontend** (Electron + LAN tarayıcı) | ✅ MVP: 14 ekran + Electron/NSIS paketi (PR #5) + ilk-kurulum sihirbazı (PR #6) + kullanıcı yönetimi (PR #8) |
| **Canlı masa/adisyon** | ✅ SSE ile olay tabanlı tazeleme + 30 sn emniyet polling'i (PR #9). socket.io "belki" rafta: cihaza hedefli komut itme ihtiyacı doğarsa |
| **Offline / Sync motoru (Faz 1: tablet→yerel sunucu)** | ✅ **TAM (PR #11 + PR #12).** Sunucu: `/sync/mutations` (idempotent replay + akıllı birleştirme) + `/sync/snapshot` + `/sync/health` + `/offline-reviews`. İstemci (tablet PWA): IndexedDB outbox + Sync Engine (durum makinesi + health ping + reconnect drain) + service worker (offline app-shell) + optimistic UI + `SyncBadge` bağlantı rozeti; dikey dilim masa aç→kalem ekle→mutfağa gönder offline; Owner offline onay ekranı. E2E iki kritik hatayı yakaladı+düzeltti: react-query `networkMode:'always'` (yoksa offline'da tüm query/mutation duraklıyordu) ve SW `navigateFallback`+`clientsClaim` (offline reboot app-shell). Opsiyonel kalan: storage %80/%95 uyarısı, cache TTL "bayat" rozeti, degraded-clear |
| Lisans yönetimi / Otomatik güncelleme / Kod imzalama | 🟡/❌ İleride |
| **Test / CI** | ✅ Birim self-check (payments/orders/reports calc + offline `sync-core`) + backend e2e smoke (43 kontrol, `/sync/*` dahil) + **tarayıcı offline E2E (Playwright, CI `e2e-web` job: gerçek PWA + IndexedDB + SW + reconnect)** + CI kapısı (build/e2e/e2e-web/GitGuardian) |
