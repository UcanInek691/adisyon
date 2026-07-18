# ROADMAP.md — Platform Mimarisi Yol Haritası

> Sistemi "yıllarca geliştirilebilir ticari ürün" seviyesine taşıyacak altyapı katmanlarının
> **ne zaman** ekleneceğini kaydeder. Amaç: ne aşırı-mühendislik (ürünü geciktiren erken altyapı),
> ne eksik-mühendislik. Her madde: **neden ertelendi + hangi tetikleyici geldiğinde eklenir.**

**Durum:** Sürüm 1.0 · **Oluşturuldu:** 2026-07-15 · **Tür:** Yaşayan doküman
İlgili: `ARCHITECTURE.md` (bütünsel harita), `SYSTEM_ANALYSIS.md`.

---

## Karar Özeti (2026-07-15)

CTO değerlendirmesi sonrası: **önce sonradan-eklemesi-pahalı dikişler, gerisi ertelensin.**
Ürün çekirdeği (masa/sipariş/ödeme/yazdırma/frontend) henüz yok; platform sistemlerinin topluca
inşası "architecture astronaut" riski taşır. Bu yüzden kademeli yaklaşım seçildi.

---

## Tier A — ŞİMDİ inşa ediliyor (sipariş modülünden önce)

Sipariş/ödeme/yazdırma bunların ilk tüketicisi; sonradan araya sokmak pahalı olduğu için önce kurulur.
Tümü **framework primitifleriyle** (elle yeniden icat yok), mevcut mimariyi bozmadan, additive.

| Sistem | Yaklaşım | Doküman |
|--------|----------|---------|
| Event Bus | `@nestjs/event-emitter` üzerine ince `EventBusService` sarmalı | `EVENT_BUS.md` |
| Domain Events | Ortak zarf + `entity.action` isim kuralı; event'ler modül geldikçe eklenir | `DOMAIN_EVENTS.md` |
| Background Worker / Queue | **SQLite-kalıcı** iş kuyruğu + pluggable handler'lı worker; RabbitMQ arayüzü YAGNI ama arayüz temiz | `BACKGROUND_WORKERS.md` |
| Scheduler | `@nestjs/schedule` (cron); cron'lar çoğunlukla worker'a iş atar (ince kalır) | `BACKGROUND_WORKERS.md` (Scheduler bölümü) |
| Health Check | `@nestjs/terminus`; `/health/*` (Electron denetçisi backend'i izler) | `HEALTH_SYSTEM.md` |
| Feature Flags | `FeatureFlag` modeli + cache'li servis + Owner toggle endpoint | `FEATURE_FLAGS.md` |

> Not: `PrintJob`, `SyncQueue`, `ApplicationSetting`, `Backup`, `AuditLog` modelleri şemada **zaten var**;
> bu sistemler onları hayata geçirir / genelleştirir, sıfırdan icat etmez.

---

## Tier B — YAKINDA (ilgili modülle birlikte)

| Sistem | Neden şimdi değil | Tetikleyici (ne zaman eklenir) |
|--------|-------------------|-------------------------------|
| **Backup + Snapshot** (birleşik) | SQLite'ta snapshot = backup (`VACUUM INTO`); Scheduler + worker hazır olmalı | Tier A biter bitmez; veri kaybı riski kritik |
| **Crash Recovery** | Kalıcı kuyruk (#3) + sipariş durum makinesi + transaction üstüne kurulur | Sipariş + ödeme modülleri inince (açılışta uzlaştırma rutini) |
| **Memory Cache (minimal)** | SQLite yerel okuma zaten sub-ms; cache = invalidasyon bug riski | Yalnız `ApplicationSetting`/config için, event ile invalidasyon; ölçülen darboğaz çıkınca genişletilir |

---

## Tier C — ERTELENDİ (ürün ayağa kalkınca)

| Sistem | Neden ertelendi | Tetikleyici |
|--------|-----------------|-------------|
| **Monitoring / Metrics panosu** | Tam metrik gözlemlenebilirliği ürün yokken erken | Frontend + Faz 2 phone-home; şimdilik hafif health + sayaç yeter |
| **Time Machine** | Altyapı değil, **audit üzerine okuma/UI**; hash-zincirli audit veriyi zaten tutuyor | Frontend gelince timeline endpoint + ekran |
| **Undo (dar kapsam)** | Genel undo tehlikeli; finansal kayıt asla geri alınmaz (ters-kayıt var) | Sadece commit-öncesi UI aksiyonları (sipariş iletmeden kalem silme) — sipariş UI'ında |
| **Cloud yedekleme** | Yedekler zaten şifreli tek dosya (`.db.enc`); yükleme hedefi (S3/Drive) seçimi ürün kararı | MVP sonrası ilk adaylardan — yedek alma akışına "buluta yükle" adımı eklemek yeter |
| **İnternet üzerinden erişim** | Veri tek makinede; güvenli uzak erişim Faz 2 offline/sync motoruna dayanır (`sync_state`/`device_id` alanları hazır) | Faz 2 sync motoru + barındırma kararı |

---

## Reddedildi (bilerek yapılmayacak)

| Sistem | Gerekçe |
|--------|---------|
| **Workflow Engine (ayrı motor)** | Event Bus'ın verdiği şeyin aynısı. "Ödeme→yazdır→audit→kasa→sync→bildirim" = event fan-out, karmaşık durumlu iş süreci değil. Ayrı workflow engine = gereksiz karmaşıklık. **Event Bus + iyi tanımlı handler'lar = workflow.** İleride gerçekten çok-adımlı, telafili (saga) süreç çıkarsa yeniden değerlendirilir. |

---

## Listede olmayan ama daha kritik iki boşluk (CTO notu)

| Boşluk | Neden önemli | Plan |
|--------|--------------|------|
| **Test / CI** | "Yıllarca sürecek ticari ürün" için bu 14 sistemin çoğundan büyük risk. Şu an test yok. | Kritik modüllere (para, sipariş, sync) risk-tabanlı test + CI kapısı — sipariş modülüyle başlar (`CONVENTIONS.md` §7) |
| **Hata izleme / telemetri** | Müşteri PC'sinde çalışan üründe sahadaki çökmeleri görmek şart | Faz 2 phone-home; şimdilik yapısal log (pino) + crash recovery |
