-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "table_id" TEXT,
    "order_no" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "type" TEXT NOT NULL DEFAULT 'dine_in',
    "opened_by" TEXT NOT NULL,
    "opened_at" DATETIME NOT NULL,
    "closed_by" TEXT,
    "closed_at" DATETIME,
    "guest_count" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discount_total" INTEGER NOT NULL DEFAULT 0,
    "service_charge" INTEGER NOT NULL DEFAULT 0,
    "cover_charge" INTEGER NOT NULL DEFAULT 0,
    "tax_total" INTEGER NOT NULL DEFAULT 0,
    "grand_total" INTEGER NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "parent_order_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    "client_op_id" TEXT,
    CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_parent_order_id_fkey" FOREIGN KEY ("parent_order_id") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_orders" ("branch_id", "client_op_id", "closed_at", "closed_by", "cover_charge", "created_at", "deleted_at", "device_id", "discount_total", "grand_total", "guest_count", "id", "is_paid", "note", "opened_at", "opened_by", "order_no", "parent_order_id", "service_charge", "status", "subtotal", "sync_state", "table_id", "tax_total", "updated_at", "version") SELECT "branch_id", "client_op_id", "closed_at", "closed_by", "cover_charge", "created_at", "deleted_at", "device_id", "discount_total", "grand_total", "guest_count", "id", "is_paid", "note", "opened_at", "opened_by", "order_no", "parent_order_id", "service_charge", "status", "subtotal", "sync_state", "table_id", "tax_total", "updated_at", "version" FROM "orders";
DROP TABLE "orders";
ALTER TABLE "new_orders" RENAME TO "orders";
CREATE UNIQUE INDEX "orders_client_op_id_key" ON "orders"("client_op_id");
CREATE INDEX "orders_branch_id_status_idx" ON "orders"("branch_id", "status");
CREATE INDEX "orders_table_id_idx" ON "orders"("table_id");
CREATE UNIQUE INDEX "orders_branch_id_order_no_key" ON "orders"("branch_id", "order_no");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
