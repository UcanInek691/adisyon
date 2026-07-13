# DATABASE_DESIGN.md — Veritabanı Tasarımı (TASLAK — onay bekliyor)

> Faz 1 (SQLite) için tam normalize şema. Her tablo Faz 2 senkronizasyonuna **baştan** hazırdır.
> Notasyon tasarım amaçlıdır; gerçek `schema.prisma` bir sonraki adımda bundan türetilir.

**Durum:** ✅ Kabul edildi (2026-07-13) · **Sürüm:** 1.0 · **Son güncelleme:** 2026-07-13

---

## 0. Genel Kurallar

1. **Birincil anahtar:** her tabloda `id` = **ULID** (string, 26 char). Auto-increment **yok** (offline + çakışmasız — `SYSTEM_ANALYSIS.md` §6).
2. **Senkron alanları (her tabloda zorunlu):** aşağıdaki `SyncBase` sütunları **istisnasız** bulunur.
3. **Para:** tüm parasal alanlar **integer minor unit** (kuruş) olarak saklanır — float **yasak** (yuvarlama hatası). Ör. `12.50 TL → 1250`.
4. **Zaman:** UTC, ISO-8601, `TEXT` (SQLite) / `timestamptz` (PostgreSQL). Uygulama katmanı tek biçim kullanır.
5. **Soft delete:** `deleted_at` doldurulur (tombstone); fiziksel silme yok.
6. **Finansal tablolar append-only:** `payments`, `cash_transactions`, `debt_transactions`, `audit_logs` **UPDATE/DELETE almaz**; düzeltme **ters kayıt** ile.
7. **Enum'lar** `packages/shared`'da; DB'de `TEXT` + uygulama-seviyesi doğrulama (SQLite native enum yok).
8. **Para birimi:** Faz 1 tek para birimi (TRY varsayılan); `currency` alanı ileriye dönük tutulur.

### 0.1 SyncBase — Her Tabloda Bulunan Sütunlar

| Sütun | Tip | Açıklama |
|---|---|---|
| `id` | TEXT (ULID) | Birincil anahtar, global benzersiz |
| `created_at` | TEXT (UTC) | Oluşturulma |
| `updated_at` | TEXT (UTC) | Son güncelleme (katalog için LWW temeli) |
| `deleted_at` | TEXT (UTC) NULL | Soft delete / tombstone |
| `version` | INTEGER | İyimser kilit + çakışma tespiti (her yazımda +1) |
| `device_id` | TEXT | Kaydı üreten cihaz (FK → `devices.id`) |
| `sync_state` | TEXT | `pending` \| `syncing` \| `synced` \| `conflict` |

> Aşağıdaki tablo tanımlarında `SyncBase` **tekrar yazılmaz**; "+ SyncBase" ile belirtilir.
> Append-only tablolarda `updated_at`/`version` yine bulunur ama uygulama bunları değiştirmez.

### 0.2 Ortak Enum'lar (`packages/shared`)

| Enum | Değerler |
|---|---|
| `SyncState` | pending, syncing, synced, conflict |
| `TableStatus` | empty, occupied, reserved, cleaning |
| `OrderStatus` | open, held, completed, cancelled |
| `OrderItemStatus` | pending, sent, preparing, served, cancelled |
| `PaymentMethod` | cash, card, transfer, qr, debt (veresiye) |
| `PaymentDirection` | charge, refund |
| `CashTxnType` | opening, sale, refund, payout, expense, income, adjustment, closing |
| `DebtTxnType` | debt_add, payment |
| `DiscountType` | percent, amount |
| `PrintJobStatus` | queued, printing, done, failed |
| `PrinterConnection` | usb, lan, bluetooth, windows_spooler |
| `LicenseStatus` | active, grace, restricted, invalid |
| `UpdateStatus` | available, downloading, ready, applied, rolled_back, failed |
| `AuditAction` | (bkz. AUDIT_LOG.md — login, order_cancel, discount_apply, …) |

---

## 1. Faz 2 Hazırlık: Tenant / Branch

Faz 1 tek şube; bu tablolar **tek satırla** başlar, tüm iş tabloları `branch_id` taşır (varsayılan tek şube).

**tenants** — işletme sahibi hesabı (Faz 2 çok işletme). + SyncBase
`name`, `license_id (FK→license_info)`, `status`

**branches** — şube. + SyncBase
`tenant_id (FK)`, `name`, `address`, `phone`, `is_default (bool)`

> Faz 1'de tüm kayıtlar tek `branch_id`'ye bağlanır; sorgular baştan şube filtreli yazılır → Faz 2'de kod değişmez.

---

## 2. Kimlik & Yetki

**users** + SyncBase
`branch_id`, `username (unique)`, `display_name`, `password_hash (argon2, Owner)`, `pin_hash (Waiter)`, `role_id (FK)`, `is_active`, `last_login_at`, `failed_login_count`, `locked_until`

**roles** + SyncBase
`name (owner|waiter|…)`, `is_system (bool)`, `description`

**permissions** + SyncBase
`key (ör. payment.take, order.cancel, discount.apply, report.view)`, `description`

**role_permissions** + SyncBase
`role_id (FK)`, `permission_id (FK)` — (unique çift)

**sessions** + SyncBase
`user_id (FK)`, `device_id (FK)`, `refresh_token_hash`, `issued_at`, `expires_at`, `revoked_at`, `ip`, `user_agent`

**devices** + SyncBase
`branch_id`, `name`, `fingerprint_hash (gizliliğe saygılı)`, `platform`, `first_seen_at`, `last_seen_at`, `is_trusted`

> Cihaz limiti **yok** (E2) ama her cihaz kaydedilir → audit + sync `device_id` + ileri lisanslama.

---

## 3. Katalog

**categories** + SyncBase
`branch_id`, `name`, `parent_id (FK self, NULL)`, `sort_order`, `color`, `is_active`

**brands** + SyncBase
`branch_id`, `name`, `is_active`

**units** + SyncBase
`branch_id`, `name (adet, kg, lt…)`, `abbreviation`

**taxes** + SyncBase
`branch_id`, `name (KDV %10)`, `rate_permille (INTEGER, ‰ — %10 = 100)`, `is_default`

> Oran **binde (permille) integer** tutulur (float yok). %10 → 100, %20 → 200.

**products** + SyncBase
`branch_id`, `category_id (FK)`, `brand_id (FK NULL)`, `unit_id (FK)`, `tax_id (FK)`,
`name`, `barcode (NULL, index)`, `sku (NULL)`,
`purchase_price (int, kuruş)`, `sale_price (int, kuruş)`,
`track_stock (bool)`, `min_stock (int NULL)`,
`image_path (NULL)`, `is_active`, `is_favorite`, `sort_order`

**discounts** + SyncBase — önceden tanımlı indirim şablonları
`branch_id`, `name`, `type (percent|amount)`, `value (int: ‰ veya kuruş)`, `max_percent_for_waiter`, `is_active`

---

## 4. Masa & Salon

**halls** + SyncBase
`branch_id`, `name (Bahçe, Salon…)`, `sort_order`, `is_active`

**tables** + SyncBase
`branch_id`, `hall_id (FK)`, `name/number`, `status (TableStatus)`, `seats (int)`,
`pos_x`, `pos_y` (harita yerleşimi), `merged_into_id (FK self NULL)`, `is_active`

> Masa **dinamik** eklenip çıkarılabilir (D2). Birleştirme: `merged_into_id`; taşıma/bölme sipariş seviyesinde.

---

## 5. Satış: Sipariş & Adisyon

**orders** (adisyon başlığı) + SyncBase
`branch_id`, `table_id (FK NULL — paket/hızlı satış için)`, `order_no (YYYYMMDD-#### insan-okur)`,
`status (OrderStatus)`, `opened_by (FK users)`, `opened_at`, `closed_by (FK NULL)`, `closed_at`,
`guest_count`, `note`,
`subtotal (int)`, `discount_total (int)`, `service_charge (int)`, `cover_charge (int)`, `tax_total (int)`, `grand_total (int)`,
`is_paid (bool)`, `parent_order_id (FK NULL — bölme/birleştirme izi)`

**order_items** + SyncBase
`order_id (FK)`, `product_id (FK)`, `product_name_snapshot`, `unit_price (int, snapshot)`,
`quantity (int veya ondalık için int×1000)`, `tax_rate_permille (snapshot)`,
`line_discount (int)`, `line_total (int)`, `status (OrderItemStatus)`,
`added_by (FK users)`, `sent_to_kitchen_at (NULL)`, `voided_by (FK NULL)`, `void_reason (NULL)`

> **Fiyat/vergi snapshot'ı:** satırda o anki fiyat saklanır → sonradan ürün fiyatı değişse geçmiş adisyon bozulmaz.

**order_item_notes** + SyncBase
`order_item_id (FK)`, `note`, `type (waiter|kitchen)`, `created_by (FK)`

**order_discounts** + SyncBase — adisyon seviyesi uygulanan indirimler (denetlenebilir)
`order_id (FK)`, `discount_id (FK NULL)`, `type`, `value`, `amount (int)`, `applied_by (FK)`, `reason`, `approved_by (FK NULL — Waiter >%10 ise Owner)`

---

## 6. Ödeme (Append-Only)

**payments** + SyncBase — **UPDATE/DELETE YOK**
`order_id (FK)`, `method (PaymentMethod)`, `direction (charge|refund)`,
`amount (int, kuruş)`, `received (int — nakit verilen)`, `change (int — para üstü)`,
`reference (kart/havale ref NULL)`, `taken_by (FK users)`, `paid_at`,
`reverses_payment_id (FK self NULL — iade hangi ödemeyi tersliyor)`, `idempotency_key (unique)`

> **Parçalı ödeme:** bir `order` için birden çok `payments` satırı. Toplam charge − refund = ödenen.
> **İade:** yeni satır, `direction=refund`, `reverses_payment_id` dolu. Orijinal asla değişmez (A6).

**receipts** + SyncBase — basılan fiş kaydı (yeniden yazdırma/denetim)
`order_id (FK)`, `receipt_no`, `type (customer|kitchen|bar)`, `printed_at`, `printer_id (FK NULL)`, `content_snapshot (JSON/text)`, `reprint_of (FK self NULL)`

---

## 7. Kasa & Finans (Append-Only akış)

**cash_sessions** + SyncBase — kasa oturumu (A4)
`branch_id`, `device_id`, `opened_by (FK)`, `opened_at`, `opening_float (int)`,
`closed_by (FK NULL)`, `closed_at (NULL)`, `counted_amount (int NULL)`, `expected_amount (int NULL)`,
`difference (int NULL — kasa farkı)`, `status (open|closed)`, `business_day (DATE — ayarlanabilir gün sonu)`

**cash_transactions** + SyncBase — **append-only**
`cash_session_id (FK)`, `type (CashTxnType)`, `amount (int, +/−)`, `method (PaymentMethod)`,
`related_payment_id (FK NULL)`, `related_expense_id (FK NULL)`, `created_by (FK)`, `note`

**expense_categories** + SyncBase
`branch_id`, `name`, `is_active`

**expenses** + SyncBase
`branch_id`, `category_id (FK)`, `amount (int)`, `description`, `spent_at`, `affects_cash (bool)`, `created_by (FK)`

**incomes** + SyncBase
`branch_id`, `category (TEXT/FK)`, `amount (int)`, `description`, `received_at`, `affects_cash (bool)`, `created_by (FK)`

---

## 8. Müşteri & Veresiye (Append-Only hareket)

**customers** + SyncBase
`branch_id`, `name`, `phone (NULL)`, `address (NULL)`, `tax_no (NULL)`, `national_id (NULL, opsiyonel)`, `note`, `is_active`

**debt_accounts** + SyncBase — cari başlık
`customer_id (FK unique)`, `balance (int — türetilmiş, hareketlerden hesaplanır ve cache'lenir)`, `currency`

**debt_transactions** + SyncBase — **append-only**
`debt_account_id (FK)`, `type (debt_add|payment)`, `amount (int, +/−)`,
`related_order_id (FK NULL)`, `related_payment_id (FK NULL)`, `created_by (FK)`, `note`, `occurred_at`

> Bakiye **hareketlerden** doğar; `balance` yalnızca performans cache'i, hareket eklendikçe yeniden hesaplanır. Düzeltme = ters hareket.

---

## 9. Stok

**suppliers** + SyncBase
`branch_id`, `name`, `phone`, `note`, `is_active`

**purchases** + SyncBase
`branch_id`, `supplier_id (FK)`, `invoice_no`, `total (int)`, `purchased_at`, `created_by (FK)`

**purchase_items** + SyncBase
`purchase_id (FK)`, `product_id (FK)`, `quantity`, `unit_cost (int)`, `line_total (int)`

**stock_movements** + SyncBase — **append-only** (giriş/çıkış/fire/düzeltme)
`branch_id`, `product_id (FK)`, `type (purchase|sale|waste|adjustment|return)`,
`quantity (int, +/−)`, `related_order_item_id (FK NULL)`, `related_purchase_id (FK NULL)`, `created_by (FK)`, `occurred_at`

> Ürün stok miktarı = `stock_movements` toplamı (+ cache alanı ürün üstünde opsiyonel).

---

## 10. Yazdırma

**printers** + SyncBase
`branch_id`, `name`, `driver_id (eklenti id — TEXT)`, `connection (PrinterConnection)`,
`address (USB path / IP:port / spooler adı)`, `paper_width (58|80)`, `is_default`, `capabilities (JSON: cutter, drawer, qr…)`, `is_active`

**print_routes** + SyncBase — çıktı yönlendirme (şema hazır; Faz 1 UI basit — C2)
`branch_id`, `document_type (customer|kitchen|bar)`, `printer_id (FK)`, `category_id (FK NULL — kategoriye özel mutfak)`

**print_jobs** + SyncBase — kuyruk (yazıcı kapalıysa kaybolmaz)
`branch_id`, `printer_id (FK)`, `document_type`, `payload (soyut PrintDocument — JSON)`,
`status (PrintJobStatus)`, `attempts (int)`, `last_error (NULL)`, `created_by (FK)`, `printed_at (NULL)`

---

## 11. Sistem, Senkron, Denetim, Lisans, Güncelleme, Eklenti, Yedek

**application_settings** + SyncBase — anahtar/değer + tipli
`branch_id`, `key (unique)`, `value (JSON)`, `updated_by (FK)`
> Firma bilgisi, logo yolu, fiş ayarları, gün sonu saati, servis/kuver açık-kapalı, tema, dil vb.

**audit_logs** — **append-only + hash zinciri** (özel; SyncBase'in bir alt kümesi + zincir alanları)
`id (ULID)`, `branch_id`, `device_id`, `created_at`, `sync_state`,
`user_id (FK NULL)`, `action (AuditAction)`, `entity_type`, `entity_id`,
`old_value (JSON NULL)`, `new_value (JSON NULL)`, `reason (NULL)`,
`prev_hash (TEXT)`, `hash (TEXT = H(prev_hash + kayıt alanları))`
> UPDATE/DELETE **yok**. `version`/`updated_at`/`deleted_at` **taşımaz** (değişmezlik için). Detay `AUDIT_LOG.md`.

**sync_queue** (Outbox) + SyncBase(kısmi) — Faz 2 gönderim kuyruğu
`id (ULID)`, `entity_type`, `entity_id`, `operation (create|update|delete)`, `payload (JSON)`,
`idempotency_key (unique)`, `status (pending|syncing|synced|failed)`, `attempts`, `last_error`, `created_at`, `sent_at`

**sync_state** — global senkron durumu (tekil/az satır)
`id`, `entity_type`, `last_pulled_at`, `last_pushed_at`, `cursor`

**conflicts** + SyncBase
`entity_type`, `entity_id`, `local_payload (JSON)`, `remote_payload (JSON)`, `resolution (NULL|local|remote|manual)`, `resolved_by (FK NULL)`, `resolved_at (NULL)`

**license_info** + SyncBase — tekil
`license_key (imzalı)`, `customer_name`, `plan (NULL — Faz 1 planlar yok)`, `features (JSON feature-flags)`,
`status (LicenseStatus)`, `valid_until (NULL)`, `activated_at`, `last_verified_at`, `grace_until (NULL)`, `signature_valid (bool)`

**update_history** + SyncBase
`from_version`, `to_version`, `channel (stable|beta)`, `status (UpdateStatus)`,
`applied_at`, `backup_id (FK→backups NULL)`, `rolled_back_at (NULL)`, `initiated_by (FK)`, `error (NULL)`

**plugins** + SyncBase
`plugin_id (manifest id)`, `name`, `version`, `type (report|printer)`, `enabled (bool)`,
`manifest (JSON)`, `compatible_core`, `installed_at`, `installed_by (FK)`, `load_error (NULL)`

**backups** + SyncBase
`branch_id`, `path`, `size_bytes`, `type (auto|manual|pre_update)`, `encrypted (bool)`, `checksum`, `created_at`, `created_by (FK NULL)`

**report_definitions** + SyncBase — eklenti raporlarının kayıt/keşif izi
`report_id (eklenti id)`, `name`, `version`, `required_permissions (JSON)`, `is_enabled`

---

## 12. Ana İlişki Haritası (özet)

```
tenants ─< branches ─< (tüm iş tabloları: branch_id)
users >── roles ─< role_permissions >── permissions
users ─< sessions >── devices
halls ─< tables ─< orders ─< order_items ─< order_item_notes
orders ─< order_discounts
orders ─< payments (append-only) ─< receipts
cash_sessions ─< cash_transactions
customers ─ debt_accounts ─< debt_transactions (append-only)
suppliers ─< purchases ─< purchase_items
products ─< stock_movements
printers ─< print_jobs ;  print_routes >── printers
(bağımsız) audit_logs, sync_queue, conflicts, license_info, update_history, plugins, backups
```

---

## 13. İndeksler (ilk tur)

- `orders(branch_id, business_day, status)`, `orders(order_no)`, `orders(table_id)`
- `order_items(order_id)`, `payments(order_id)`, `payments(idempotency_key unique)`
- `products(barcode)`, `products(branch_id, category_id, is_active)`
- `cash_transactions(cash_session_id)`, `debt_transactions(debt_account_id)`
- `stock_movements(product_id)`, `audit_logs(created_at)`, `audit_logs(entity_type, entity_id)`
- `sync_queue(status, created_at)`, `print_jobs(status)`

---

## 14. Karara Bağlanan Noktalar (✅ onaylandı 2026-07-13)

1. **Miktar ondalık desteği:** `quantity` **int × 1000** olarak saklanır (tartıyla satış — pastane/büfe/lokanta). 0,75 kg → `750`. Float yasak.
2. **Fiş içeriği:** `receipts.content_snapshot` **yapısal JSON** (yeniden render + PDF + denetim).
3. **Veresiye bakiyesi:** `debt_accounts.balance` **cache** tutulur, her harekette yeniden hesaplanır (kaynak = hareketler).

---

## 15. Sonraki Adım

Bu tasarım onaylanınca sıra (§18): **5) API tasarımı (`API_DESIGN.md`)** — REST/WebSocket
endpoint sözleşmeleri, DTO'lar (Zod), yetki matrisi (Owner/Waiter), hata modelleri.
Ardından bu dokümandan **`schema.prisma`** türetilir (kod adımı — ayrıca onaylanacak).
