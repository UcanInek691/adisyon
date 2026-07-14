# EVENT_BUS.md — Merkezi Event Bus

> Moduller birbirini **dogrudan cagirmaz**. Yan etkiler (yazdirma, denetim, dashboard, sync,
> bildirim...) merkezi bir event bus uzerinden publish/subscribe ile akar. Bu, modulleri
> gevsek-bagli tutar ve yeni tuketici eklemeyi (ornegin yeni bir rapor/bildirim) cekirdek
> kodu degistirmeden mumkun kilar.

**Durum:** Sürüm 1.0 · **Oluşturuldu:** 2026-07-15 · **Tür:** Yaşayan doküman
İlgili: `DOMAIN_EVENTS.md` (event katalogu), `ARCHITECTURE.md` §7, `ROADMAP.md` (Tier A).

---

## 1. Neden

`OrderPaid` gibi bir olay olunca birden fazla sey olmali: fis bas, audit yaz, dashboard guncelle,
kasaya isle, sync kuyruguna ekle, bildirim gonder. Bunlari sipariş servisinin icine tek tek
cagirmak (sabit-kablolama) modulleri birbirine kenetler ve test/degisimi zorlastirir.

```
                         ┌──────────► Printer
                         ├──────────► Audit
   OrderPaid ──► EventBus├──────────► Dashboard
                         ├──────────► CashRegister
                         ├──────────► SyncQueue
                         └──────────► Notification
```

Yayinci (sipariş servisi) **kim dinliyor bilmez**; sadece event yayinlar. Tuketiciler bagimsiz abone olur.

---

## 2. Mekanizma

- Altyapi: **`@nestjs/event-emitter`** (EventEmitter2) — surec-ici, elle yeniden icat yok.
- Ince sarmal: **`EventBusService`** (`common/events/event-bus.service.ts`). Yayincilar bunu enjekte eder.
- `EventBusModule` **@Global**: `wildcard: true`, `delimiter: '.'` -> `product.created` gibi ad-alanli
  event'ler ve `**` ile hepsini dinleme desteklenir.
- **`EventLoggerSubscriber`** tum event'leri (`@OnEvent('**')`) debug seviyesinde loglar (gozlemlenebilirlik + dogrulama).

> Not: Bu **surec-ici** bir bus'tir (tek makine, tek backend sureci — bkz. `SYSTEM_ANALYSIS.md` §3).
> Dagitik mesaj kuyrugu (RabbitMQ vb.) YAGNI; gerekirse EventBusService arkasi degistirilebilir.

---

## 3. Event Zarfi (Envelope)

Tum event'ler ayni zarfi tasir; yalnizca `payload` degisir. Tanim: `@ado/shared/events.ts`
(backend+frontend ortak — Faz 2 WebSocket/sync icin).

```ts
interface DomainEvent<TName, TPayload> {
  eventId: string;        // ULID — bu event ornegi (idempotent isleme + izleme)
  name: TName;            // 'entity.action'  (or. 'product.created')
  occurredAt: string;     // ISO 8601
  branchId: string;       // kiracı/sube izolasyonu
  actorId?: string;       // islemi yapan kullanici
  deviceId?: string;      // kaynak cihaz (Waiter tableti vb.)
  correlationId?: string; // iliskili islem zinciri (requestId / clientOpId)
  payload: TPayload;      // event'e ozel veri
}
```

Yayincilar zarfi **her zaman** `createDomainEvent(name, payload, meta)` ile uretir -> `eventId`/`occurredAt` otomatik.

---

## 4. Yayinlama (Publish)

Domain servisi, degisikligi **kalicilastirdiktan SONRA** (post-commit yan etki) yayinlar.
Ornek — katalog (ilk uretici):

```ts
await this.events.publish(
  createDomainEvent(
    DomainEventName.ProductCreated,
    { productId, name, categoryId, salePrice },
    { branchId: user.branchId, actorId: user.userId, deviceId: user.deviceId },
  ),
);
```

**Zamanlama kurali:** publish, veri yazildiktan sonra cagrilir; yayin hatasi asla yapilan yazmayi geri almaz.

---

## 5. Dinleme (Subscribe)

Tuketici modul, kendi icinde `@OnEvent` ile abone olur (yayinci degismez):

```ts
@Injectable()
export class ReceiptPrinterSubscriber {
  @OnEvent('order.paid', { async: true })
  async onOrderPaid(event: DomainEvent<'order.paid', OrderPaidPayload>) {
    // AGIR is: dogrudan yapma -> Background Worker'a kuyrukla (Tier A #3)
    await this.jobQueue.enqueue('print.receipt', { orderId: event.payload.orderId });
  }
}
```

---

## 6. Hata İzolasyonu ve Performans

- **İzolasyon:** `EventBusService.publish`, `emitAsync` cagrisini try/catch ile sarar. Bir
  dinleyicinin hatasi ne yayinciyi ne de diger dinleyicileri durdurur; hata loglanir.
- **Dinleyiciler asla `throw` etmemeli**; kendi hatasini yonetmeli.
- **Bloklama yok:** dinleyiciler **hizli** olmali. Agir is (yazdirma, sync, rapor) dogrudan
  yapilmaz -> **Background Worker** kuyruguna atilir (bkz. `BACKGROUND_WORKERS.md`). Event bus
  "ne oldu"yu duyurur; "uzun isi" worker yapar.

---

## 7. Yeni Event Ekleme (kontrol listesi)

1. `@ado/shared/events.ts` -> `DomainEventName`e `entity.action` ekle + payload arayuzu tanimla.
2. `shared` paketini yeniden derle (`pnpm build`).
3. Yayinci domain servisinde `createDomainEvent(...)` + `events.publish(...)` cagir (post-commit).
4. `DOMAIN_EVENTS.md`'ye event'i ekle: **amaci / yayinlandigi yer / dinleyen moduller**.
5. Tuketici(ler) `@OnEvent('entity.action')` ile abone olur.

> **Kural:** kod ve `DOMAIN_EVENTS.md` hicbir zaman ayrilmaz. Event eklendi ama belgelenmedi = eksik is.

---

## 8. Mevcut Durum (2026-07-15)

- ✅ EventBus altyapisi + zarf + logger abonesi kuruldu.
- ✅ İlk uretici: **Katalog** (`product.created` / `product.updated` / `product.deleted`).
- ⏳ Audit su an event'e degil **dogrudan cagriya** dayali (calisan hash-zinciri bozulmasin diye).
  Audit'in event-subscriber'a donusturulmesi ayri, kontrollu bir adim (yayin + dogrudan cagri
  gecici olarak birlikte).
- ⏭️ Sipariş/ödeme/kasa/yazdirma event'leri ilgili modul inşa edilirken eklenecek (`DOMAIN_EVENTS.md`).
