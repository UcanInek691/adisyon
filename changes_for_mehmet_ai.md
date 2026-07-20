# Handover Report — Platform & Support Modules (For Mehmet's AI Assistant)

This document contains a structured summary of all altyapı, platform, and support/business developments completed by **Çağrı**. It serves as an integration guide for the client/frontend development of the Sales pipeline (Orders, Payments, Offline sync).

---

## 1. Database Schema Additions
A new Prisma schema file has been added under [worker.prisma](file:///c:/Users/mhmmt/OneDrive/Desktop/adisyon-develop/prisma/schema/worker.prisma) containing the `BackgroundJob` model, which was mapped and migrated to the `background_jobs` SQLite table.

```prisma
model BackgroundJob {
  id          String    @id // ULID
  branchId    String    @map("branch_id")
  taskName    String    @map("task_name") // e.g., "print.job"
  payload     String // JSON parameters
  status      String    @default("pending") // pending | running | completed | failed
  attempts    Int       @default(0)
  maxAttempts Int       @default(3) @map("max_attempts")
  lastError   String?   @map("last_error")
  runAt       DateTime  @default(now()) @map("run_at")
  lockedAt    DateTime? @map("locked_at")
  completedAt DateTime? @map("completed_at")
  failedAt    DateTime? @map("failed_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
}
```

---

## 2. API Endpoints & Routes Reference

All endpoints enforce role-based permissions (`JwtAuthGuard` & `PermissionsGuard`).

### 2.1 Health Status
- **`GET /health`** (Public)
  - Checks database connection, heap memory usage (< 150MB), and local storage usage (< 95%).

### 2.2 Feature Flags
- **`GET /settings/feature-flags`** (Owner only — `settings.manage`)
  - Retrieves active system feature flags parsed from `LicenseInfo.features`.

### 2.3 Printing Configuration
- **`POST /printers`** (`printer.manage`) — Register a new printing device.
- **`PATCH /printers/:id`** (`printer.manage`) — Update configuration.
- **`DELETE /printers/:id`** (`printer.manage`) — Soft-delete printer.
- **`GET /printers`** (`printer.manage`) — List all active printers.
- **`POST /printers/routes`** (`printer.manage`) — Map document type (`customer` | `kitchen` | `bar`) to a printer.
- **`DELETE /printers/routes/:id`** (`printer.manage`) — Delete routing map.
- **`GET /printers/routes`** (`printer.manage`) — List active routings.
- **`POST /printers/test-print/:id`** (`printer.manage`) — Send a simulated test print job to the device.

### 2.4 Backups (SQLite & AES Encryption)
- **`POST /backups`** (`backup.manage`) — Trigger hot online database backup (`VACUUM INTO` + AES-256-GCM encryption).
- **`GET /backups`** (`backup.manage`) — List backup history.
- **`DELETE /backups/:id`** (`backup.manage`) — Delete backup entry and remove dump from local disk.

### 2.5 Kasa (Cash Register)
- **`POST /cash/sessions/open`** (`cash.manage`) — Start cash drawer session with starting float.
- **`POST /cash/sessions/close`** (`cash.manage`) — Close session with counted drawer amount. Calculates differences (expected vs. counted) and creates a closing entry.
- **`GET /cash/sessions/active`** (`cash.manage`) — Get current active session details and list of transactions.
- **`POST /cash/transactions`** (`cash.manage`) — Log manual cash drawer inflow/outflow (types: `income` | `expense` | `payout` | `adjustment`).

### 2.6 Customers & Veresiye (Customer Debt)
- **`POST /customers`** (`debt.manage`) — Create customer profile. Automatically registers a `DebtAccount` with starting balance of `0`.
- **`PATCH /customers/:id`** (`debt.manage`) — Edit profile.
- **`DELETE /customers/:id`** (`debt.manage`) — Soft-delete customer.
- **`GET /customers`** (`debt.manage`) — List all customers with veresiye balance caches.
- **`GET /customers/:id`** (`debt.manage`) — Retrieve profile and detailed veresiye transaction ledger.
- **`POST /customers/:id/debt`** (`debt.manage`) — Accrue manual debt (type: `debt_add`).
- **`POST /customers/:id/payment`** (`debt.manage`) — Record veresiye payment (type: `payment`). Reduces outstanding balance and logs `income` into the active Cash Drawer.

### 2.7 Stok (Inventory)
- **`POST /inventory/suppliers`** (`finance.manage`) — Create inventory supplier.
- **`PATCH /inventory/suppliers/:id`** (`finance.manage`) — Edit supplier.
- **`DELETE /inventory/suppliers/:id`** (`finance.manage`) — Soft-delete supplier.
- **`GET /inventory/suppliers`** (`finance.manage`) — List active suppliers.
- **`POST /inventory/purchases`** (`finance.manage`) — Record stock purchase. Creates `Purchase` and `PurchaseItem` records, automatically updates catalog `purchasePrice` to latest, and creates positive `StockMovement` logs.
- **`POST /inventory/movements`** (`finance.manage`) — Record manual stock adjustment (waste, return, adjustments).
- **`GET /inventory/movements/:productId`** (`finance.manage`) — List all movements for a specific product.

### 2.8 Analytical Reports
- **`GET /reports/sales/daily?start=ISO_DATE&end=ISO_DATE`** (`report.view`) — Total sales amount/count, discount total, payments breakdown, and sales category breakdown.
- **`GET /reports/sales/products?start=ISO_DATE&end=ISO_DATE`** (`report.view`) — Best-selling products ranked by revenue.
- **`GET /reports/customers/debt`** (`report.view`) — List of all debtors and outstanding balances.
- **`GET /reports/inventory/stock`** (`report.view`) — Stock quantity levels, unit costs, and warehouse valuations.

---

## 3. Background Job & Event-Driven Workflows (Contract-Free Integration)

We integrated processes using NestJS Event Bus (`@nestjs/event-emitter` / `EventBusService`) and SQLite job queues, requiring zero code modifications on your Sales module endpoints.

### 3.1 Cash Drawer Sales Tracking
- **Listens to**: `order.paid`
- **Behavior**: When an order is completed, `CashService` automatically intercepts the event and logs a `sale` type `CashTransaction` inside the active cash session for auditing.

### 3.2 Automated Printing
- **Listens to**: `order.paid`
- **Behavior**: Compiles a structure mapping a customer info receipt and automatically queues a print job (`print.job`) targeting the designated printer route (or fallback default printer).

### 3.3 Veresiye (Sipariş Cari Kaydı)
- **Listens to**: `order.paid`
- **Behavior**: If the payment method is `debt` (veresiye), `CustomerService` automatically intercept-creates a `debt_add` transaction matching the `customerId` and increases their outstanding balance.

### 3.4 Automatic Stock Deductions
- **Listens to**: `order.item.added`
  - **Behavior**: If `Product.trackStock` is enabled, creates a negative `StockMovement` of type `sale` with `-quantity`.
- **Listens to**: `order.item.voided`
  - **Behavior**: If voided, refunds the stock by creating a positive `StockMovement` of type `return` with `+quantity`.
