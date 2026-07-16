# PROJECT_STATUS.md — Bütünsel Durum & Eksik Haritası

> Yaşayan belge. Tüm projenin (kim yazdığından bağımsız) tasarım dokümanlarına
> (`SYSTEM_ANALYSIS.md §5`, `API_DESIGN.md`, `DATABASE_DESIGN.md`, `ROADMAP.md`)
> karşı **ne yapıldı / kısmi / eksik** durumunu tek yerde tutar.

**Oluşturuldu:** 2026-07-16 · **Legend:** ✅ tam · 🟡 kısmi · ❌ yok

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
| Yedek (backup) | ✅ | Al/listele/sil + **restore** (çöz+doğrula+stage; atomik takas restart'ta) |
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
| **Frontend** (Electron + LAN tarayıcı) | ❌ Sıfırdan, kendi başına proje |
| **WebSocket — canlı masa** | ❌ Faz 2 |
| **Offline / Sync motoru** | ❌ Faz 2 (model alanları hazır) |
| Lisans yönetimi / Otomatik güncelleme | 🟡/❌ İleride |
| **Test / CI** | ❌ Proje geneli test yok (yalnız `payments.calc`) |
