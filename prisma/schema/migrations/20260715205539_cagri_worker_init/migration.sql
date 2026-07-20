-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "prev_hash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    "origin" TEXT NOT NULL DEFAULT 'online',
    "client_op_id" TEXT,
    "client_created_at" DATETIME
);

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "checksum" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "session_device" TEXT NOT NULL,
    "opened_by" TEXT NOT NULL,
    "opened_at" DATETIME NOT NULL,
    "opening_float" INTEGER NOT NULL,
    "closed_by" TEXT,
    "closed_at" DATETIME,
    "counted_amount" INTEGER,
    "expected_amount" INTEGER,
    "difference" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "business_day" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "cash_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cash_session_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "related_payment_id" TEXT,
    "related_expense_id" TEXT,
    "created_by" TEXT NOT NULL,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "cash_transactions_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "taxes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate_permille" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "brand_id" TEXT,
    "unit_id" TEXT NOT NULL,
    "tax_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "sku" TEXT,
    "purchase_price" INTEGER NOT NULL DEFAULT 0,
    "sale_price" INTEGER NOT NULL,
    "track_stock" BOOLEAN NOT NULL DEFAULT false,
    "min_stock" INTEGER,
    "image_path" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "products_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "taxes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "max_percent_for_waiter" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "tax_no" TEXT,
    "national_id" TEXT,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "debt_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "debt_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "debt_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debt_account_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "related_order_id" TEXT,
    "related_payment_id" TEXT,
    "created_by" TEXT NOT NULL,
    "note" TEXT,
    "occurred_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "debt_transactions_debt_account_id_fkey" FOREIGN KEY ("debt_account_id") REFERENCES "debt_accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "spent_at" DATETIME NOT NULL,
    "affects_cash" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "incomes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "category" TEXT,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "received_at" DATETIME NOT NULL,
    "affects_cash" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "license_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "pin_hash" TEXT,
    "role_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" DATETIME,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "session_device_id" TEXT,
    "refresh_token_hash" TEXT NOT NULL,
    "issued_at" DATETIME NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fingerprint_hash" TEXT NOT NULL,
    "platform" TEXT,
    "first_seen_at" DATETIME NOT NULL,
    "last_seen_at" DATETIME NOT NULL,
    "is_trusted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "invoice_no" TEXT,
    "total" INTEGER NOT NULL,
    "purchased_at" DATETIME NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchase_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" INTEGER NOT NULL,
    "line_total" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "related_order_item_id" TEXT,
    "related_purchase_id" TEXT,
    "created_by" TEXT NOT NULL,
    "occurred_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "license_info" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "license_key" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "plan" TEXT,
    "features" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "valid_until" DATETIME,
    "activated_at" DATETIME,
    "last_verified_at" DATETIME,
    "grace_until" DATETIME,
    "signature_valid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "update_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from_version" TEXT NOT NULL,
    "to_version" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "applied_at" DATETIME,
    "backup_id" TEXT,
    "rolled_back_at" DATETIME,
    "initiated_by" TEXT NOT NULL,
    "error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "processed_client_ops" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_op_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "mutation_type" TEXT NOT NULL,
    "result_status" TEXT NOT NULL,
    "result_ref" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "pending_offline_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "waiter_id" TEXT NOT NULL,
    "client_op_id" TEXT NOT NULL,
    "mutation_type" TEXT NOT NULL,
    "mutation_payload" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolved_by" TEXT,
    "resolved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "table_id" TEXT,
    "order_no" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
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

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "tax_rate_permille" INTEGER NOT NULL,
    "line_discount" INTEGER NOT NULL DEFAULT 0,
    "line_total" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "added_by" TEXT NOT NULL,
    "sent_to_kitchen_at" DATETIME,
    "voided_by" TEXT,
    "void_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    "client_op_id" TEXT,
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_item_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_item_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "order_item_notes_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_discounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "discount_id" TEXT,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "applied_by" TEXT NOT NULL,
    "reason" TEXT,
    "approved_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "order_discounts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'charge',
    "amount" INTEGER NOT NULL,
    "received" INTEGER NOT NULL DEFAULT 0,
    "change" INTEGER NOT NULL DEFAULT 0,
    "reference" TEXT,
    "taken_by" TEXT NOT NULL,
    "paid_at" DATETIME NOT NULL,
    "reverses_payment_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_reverses_payment_id_fkey" FOREIGN KEY ("reverses_payment_id") REFERENCES "payments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "receipt_no" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "printed_at" DATETIME NOT NULL,
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

-- CreateTable
CREATE TABLE "plugins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plugin_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plugin_version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "manifest" TEXT NOT NULL,
    "compatible_core" TEXT NOT NULL,
    "installed_at" DATETIME NOT NULL,
    "installed_by" TEXT NOT NULL,
    "load_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "printers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "connection" TEXT NOT NULL,
    "address" TEXT,
    "paper_width" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "capabilities" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "print_routes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "printer_id" TEXT NOT NULL,
    "category_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "print_routes_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "printer_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_by" TEXT NOT NULL,
    "printed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "print_jobs_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "report_definitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "report_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "report_version" TEXT NOT NULL,
    "required_permissions" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "application_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "sync_queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device_id" TEXT
);

-- CreateTable
CREATE TABLE "sync_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "last_pulled_at" DATETIME,
    "last_pushed_at" DATETIME,
    "cursor" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "conflicts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "local_payload" TEXT NOT NULL,
    "remote_payload" TEXT NOT NULL,
    "resolution" TEXT,
    "resolved_by" TEXT,
    "resolved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "halls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "hall_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'empty',
    "seats" INTEGER NOT NULL DEFAULT 4,
    "pos_x" INTEGER,
    "pos_y" INTEGER,
    "merged_into_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "tables_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "halls" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tables_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "tables" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "run_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" DATETIME,
    "completed_at" DATETIME,
    "failed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "backups_branch_id_idx" ON "backups"("branch_id");

-- CreateIndex
CREATE INDEX "cash_sessions_branch_id_business_day_status_idx" ON "cash_sessions"("branch_id", "business_day", "status");

-- CreateIndex
CREATE INDEX "cash_transactions_cash_session_id_idx" ON "cash_transactions"("cash_session_id");

-- CreateIndex
CREATE INDEX "categories_branch_id_idx" ON "categories"("branch_id");

-- CreateIndex
CREATE INDEX "brands_branch_id_idx" ON "brands"("branch_id");

-- CreateIndex
CREATE INDEX "units_branch_id_idx" ON "units"("branch_id");

-- CreateIndex
CREATE INDEX "taxes_branch_id_idx" ON "taxes"("branch_id");

-- CreateIndex
CREATE INDEX "products_branch_id_category_id_is_active_idx" ON "products"("branch_id", "category_id", "is_active");

-- CreateIndex
CREATE INDEX "products_barcode_idx" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "discounts_branch_id_idx" ON "discounts"("branch_id");

-- CreateIndex
CREATE INDEX "customers_branch_id_idx" ON "customers"("branch_id");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "debt_accounts_customer_id_key" ON "debt_accounts"("customer_id");

-- CreateIndex
CREATE INDEX "debt_transactions_debt_account_id_idx" ON "debt_transactions"("debt_account_id");

-- CreateIndex
CREATE INDEX "expense_categories_branch_id_idx" ON "expense_categories"("branch_id");

-- CreateIndex
CREATE INDEX "expenses_branch_id_category_id_idx" ON "expenses"("branch_id", "category_id");

-- CreateIndex
CREATE INDEX "incomes_branch_id_idx" ON "incomes"("branch_id");

-- CreateIndex
CREATE INDEX "branches_tenant_id_idx" ON "branches"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_branch_id_idx" ON "users"("branch_id");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "devices_branch_id_idx" ON "devices"("branch_id");

-- CreateIndex
CREATE INDEX "suppliers_branch_id_idx" ON "suppliers"("branch_id");

-- CreateIndex
CREATE INDEX "purchases_branch_id_supplier_id_idx" ON "purchases"("branch_id", "supplier_id");

-- CreateIndex
CREATE INDEX "purchase_items_purchase_id_idx" ON "purchase_items"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_items_product_id_idx" ON "purchase_items"("product_id");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_idx" ON "stock_movements"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "processed_client_ops_client_op_id_key" ON "processed_client_ops"("client_op_id");

-- CreateIndex
CREATE INDEX "processed_client_ops_device_id_created_at_idx" ON "processed_client_ops"("device_id", "created_at");

-- CreateIndex
CREATE INDEX "pending_offline_reviews_branch_id_status_idx" ON "pending_offline_reviews"("branch_id", "status");

-- CreateIndex
CREATE INDEX "pending_offline_reviews_client_op_id_idx" ON "pending_offline_reviews"("client_op_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_client_op_id_key" ON "orders"("client_op_id");

-- CreateIndex
CREATE INDEX "orders_branch_id_status_idx" ON "orders"("branch_id", "status");

-- CreateIndex
CREATE INDEX "orders_table_id_idx" ON "orders"("table_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_branch_id_order_no_key" ON "orders"("branch_id", "order_no");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_client_op_id_key" ON "order_items"("client_op_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_item_notes_order_item_id_idx" ON "order_item_notes"("order_item_id");

-- CreateIndex
CREATE INDEX "order_discounts_order_id_idx" ON "order_discounts"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "receipts_order_id_idx" ON "receipts"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "plugins_plugin_id_key" ON "plugins"("plugin_id");

-- CreateIndex
CREATE INDEX "printers_branch_id_idx" ON "printers"("branch_id");

-- CreateIndex
CREATE INDEX "print_routes_branch_id_document_type_idx" ON "print_routes"("branch_id", "document_type");

-- CreateIndex
CREATE INDEX "print_jobs_status_idx" ON "print_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "report_definitions_report_id_key" ON "report_definitions"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_settings_branch_id_key_key" ON "application_settings"("branch_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "sync_queue_idempotency_key_key" ON "sync_queue"("idempotency_key");

-- CreateIndex
CREATE INDEX "sync_queue_status_created_at_idx" ON "sync_queue"("status", "created_at");

-- CreateIndex
CREATE INDEX "halls_branch_id_idx" ON "halls"("branch_id");

-- CreateIndex
CREATE INDEX "tables_branch_id_hall_id_idx" ON "tables"("branch_id", "hall_id");

-- CreateIndex
CREATE INDEX "background_jobs_status_run_at_idx" ON "background_jobs"("status", "run_at");
