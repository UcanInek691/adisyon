ALTER TABLE "payments" ADD COLUMN "customer_id" TEXT;

CREATE UNIQUE INDEX "payments_reverses_payment_id_key"
ON "payments"("reverses_payment_id");

CREATE INDEX "payments_customer_id_idx"
ON "payments"("customer_id");

CREATE UNIQUE INDEX "cash_transactions_related_payment_id_key"
ON "cash_transactions"("related_payment_id");

CREATE UNIQUE INDEX "debt_transactions_related_payment_id_key"
ON "debt_transactions"("related_payment_id");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_cash_sessions_one_open"
ON "cash_sessions"("branch_id")
WHERE "status" = 'open' AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "stock_movements_related_order_item_id_type_key"
ON "stock_movements"("related_order_item_id", "type");

ALTER TABLE "processed_client_ops" ADD COLUMN "branch_id" TEXT;
CREATE INDEX "processed_client_ops_branch_id_created_at_idx"
ON "processed_client_ops"("branch_id", "created_at");

ALTER TABLE "order_item_notes" ADD COLUMN "client_op_id" TEXT;
CREATE UNIQUE INDEX "order_item_notes_client_op_id_key"
ON "order_item_notes"("client_op_id");

ALTER TABLE "orders" ADD COLUMN "completed_at" DATETIME;
UPDATE "orders"
SET "completed_at" = "closed_at"
WHERE "status" = 'completed' AND "closed_at" IS NOT NULL;
CREATE INDEX "orders_branch_id_completed_at_idx"
ON "orders"("branch_id", "completed_at");

CREATE UNIQUE INDEX "uq_orders_one_active_per_table"
ON "orders"("branch_id", "table_id")
WHERE "table_id" IS NOT NULL
  AND "status" IN ('open', 'held')
  AND "deleted_at" IS NULL;

ALTER TABLE "audit_logs" ADD COLUMN "sequence" INTEGER;
UPDATE "audit_logs" AS "current"
SET "sequence" = (
  SELECT COUNT(*)
  FROM "audit_logs" AS "prior"
  WHERE "prior"."branch_id" = "current"."branch_id"
    AND "prior"."id" <= "current"."id"
);
CREATE UNIQUE INDEX "audit_logs_branch_id_sequence_key"
ON "audit_logs"("branch_id", "sequence");

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_receipts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "order_id" TEXT NOT NULL,
  "receipt_no" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "printed_at" DATETIME,
  "print_job_id" TEXT,
  "printer_id" TEXT,
  "content_snapshot" TEXT NOT NULL,
  "reprint_of" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  "deleted_at" DATETIME,
  "version" INTEGER NOT NULL DEFAULT 1,
  "device_id" TEXT,
  "sync_state" TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT "receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "receipts_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "receipts_reprint_of_fkey" FOREIGN KEY ("reprint_of") REFERENCES "receipts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_receipts" (
  "id", "order_id", "receipt_no", "type", "printed_at", "printer_id",
  "content_snapshot", "reprint_of", "created_at", "updated_at", "deleted_at",
  "version", "device_id", "sync_state"
)
SELECT
  "id", "order_id", "receipt_no", "type", "printed_at", "printer_id",
  "content_snapshot", "reprint_of", "created_at", "updated_at", "deleted_at",
  "version", "device_id", "sync_state"
FROM "receipts";
DROP TABLE "receipts";
ALTER TABLE "new_receipts" RENAME TO "receipts";
CREATE UNIQUE INDEX "receipts_print_job_id_key" ON "receipts"("print_job_id");
CREATE INDEX "receipts_order_id_idx" ON "receipts"("order_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

ALTER TABLE "print_jobs" ADD COLUMN "source_event_id" TEXT;
CREATE UNIQUE INDEX "print_jobs_source_event_id_printer_id_document_type_key"
ON "print_jobs"("source_event_id", "printer_id", "document_type");
