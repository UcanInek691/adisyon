/**
 * Merkezi enum tanimlari.
 *
 * SQLite native enum desteklemedigi icin bu degerler veritabaninda TEXT olarak
 * saklanir; dogrulama uygulama katmaninda bu sabitlerle yapilir (magic string yasak).
 * Kaynak: DATABASE_DESIGN.md §0.2
 *
 * `as const` + tur turetme kalibi: hem calisma-zamani deger listesi hem de
 * birebir string literal tipi tek yerden gelir.
 */

export const SyncState = {
  Pending: 'pending',
  Syncing: 'syncing',
  Synced: 'synced',
  Conflict: 'conflict',
} as const;
export type SyncState = (typeof SyncState)[keyof typeof SyncState];

export const TableStatus = {
  Empty: 'empty',
  Occupied: 'occupied',
  Reserved: 'reserved',
  Cleaning: 'cleaning',
} as const;
export type TableStatus = (typeof TableStatus)[keyof typeof TableStatus];

export const OrderStatus = {
  Open: 'open',
  Held: 'held',
  Completed: 'completed',
  Cancelled: 'cancelled',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderType = {
  DineIn: 'dine_in', // salon (masa)
  Takeaway: 'takeaway', // gel-al
  Delivery: 'delivery', // paket / kurye
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderItemStatus = {
  Pending: 'pending',
  Sent: 'sent',
  Preparing: 'preparing',
  Served: 'served',
  Cancelled: 'cancelled',
} as const;
export type OrderItemStatus = (typeof OrderItemStatus)[keyof typeof OrderItemStatus];

export const PaymentMethod = {
  Cash: 'cash',
  Card: 'card',
  Transfer: 'transfer',
  Qr: 'qr',
  Debt: 'debt', // veresiye
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentDirection = {
  Charge: 'charge',
  Refund: 'refund',
} as const;
export type PaymentDirection = (typeof PaymentDirection)[keyof typeof PaymentDirection];

export const CashTxnType = {
  Opening: 'opening',
  Sale: 'sale',
  Refund: 'refund',
  Payout: 'payout',
  Expense: 'expense',
  Income: 'income',
  Adjustment: 'adjustment',
  Closing: 'closing',
} as const;
export type CashTxnType = (typeof CashTxnType)[keyof typeof CashTxnType];

export const DebtTxnType = {
  DebtAdd: 'debt_add',
  Payment: 'payment',
} as const;
export type DebtTxnType = (typeof DebtTxnType)[keyof typeof DebtTxnType];

export const DiscountType = {
  Percent: 'percent',
  Amount: 'amount',
} as const;
export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];

export const PrintJobStatus = {
  Queued: 'queued',
  Printing: 'printing',
  Done: 'done',
  Failed: 'failed',
} as const;
export type PrintJobStatus = (typeof PrintJobStatus)[keyof typeof PrintJobStatus];

export const PrinterConnection = {
  Usb: 'usb',
  Lan: 'lan',
  Bluetooth: 'bluetooth',
  WindowsSpooler: 'windows_spooler',
} as const;
export type PrinterConnection = (typeof PrinterConnection)[keyof typeof PrinterConnection];

export const DocumentType = {
  Customer: 'customer',
  Kitchen: 'kitchen',
  Bar: 'bar',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const StockMovementType = {
  Purchase: 'purchase',
  Sale: 'sale',
  Waste: 'waste',
  Adjustment: 'adjustment',
  Return: 'return',
} as const;
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const LicenseStatus = {
  Active: 'active',
  Grace: 'grace',
  Restricted: 'restricted',
  Invalid: 'invalid',
} as const;
export type LicenseStatus = (typeof LicenseStatus)[keyof typeof LicenseStatus];

export const UpdateStatus = {
  Available: 'available',
  Downloading: 'downloading',
  Ready: 'ready',
  Applied: 'applied',
  RolledBack: 'rolled_back',
  Failed: 'failed',
} as const;
export type UpdateStatus = (typeof UpdateStatus)[keyof typeof UpdateStatus];

export const UpdateChannel = {
  Stable: 'stable',
  Beta: 'beta',
} as const;
export type UpdateChannel = (typeof UpdateChannel)[keyof typeof UpdateChannel];

export const PluginType = {
  Report: 'report',
  Printer: 'printer',
} as const;
export type PluginType = (typeof PluginType)[keyof typeof PluginType];

/** Sistem rolleri (baslangic). Roller veridir; ileride eklenebilir. CONVENTIONS.md §2 */
export const SystemRole = {
  Owner: 'owner',
  Waiter: 'waiter',
} as const;
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];

// -----------------------------------------------------------------------------
// ISTEMCI-OFFLINE (Faz 1). Waiter tablet -> yerel sunucu. Bkz. OFFLINE_DESIGN.md
// -----------------------------------------------------------------------------

/** Offline istemci mutasyon turleri. OFFLINE_DESIGN.md §5.1 */
export const OfflineMutationType = {
  OpenTable: 'OPEN_TABLE',
  AddLine: 'ADD_LINE',
  UpdateLineQty: 'UPDATE_LINE_QTY',
  AddNote: 'ADD_NOTE',
  SubmitOrder: 'SUBMIT_ORDER',
} as const;
export type OfflineMutationType = (typeof OfflineMutationType)[keyof typeof OfflineMutationType];

/** Sunucunun bir offline mutasyona verdigi sonuc. OFFLINE_DESIGN.md §7.1 */
export const OfflineMutationResult = {
  Applied: 'applied',
  Duplicate: 'duplicate',
  Conflict: 'conflict',
  Rejected: 'rejected',
} as const;
export type OfflineMutationResult =
  (typeof OfflineMutationResult)[keyof typeof OfflineMutationResult];

/** Offline cakisma review nedeni. OFFLINE_DESIGN.md §8 */
export const OfflineReviewReason = {
  CashClosed: 'cash_closed',
  TableClosed: 'table_closed',
  TableMoved: 'table_moved',
  ProductInactive: 'product_inactive',
  Other: 'other',
} as const;
export type OfflineReviewReason = (typeof OfflineReviewReason)[keyof typeof OfflineReviewReason];

/** Offline review durumu. OFFLINE_DESIGN.md §9.2 */
export const OfflineReviewStatus = {
  Open: 'open',
  Resolved: 'resolved',
  Rejected: 'rejected',
} as const;
export type OfflineReviewStatus = (typeof OfflineReviewStatus)[keyof typeof OfflineReviewStatus];

/** Audit kaydinin kaynagi (online mi offline replay mi). OFFLINE_DESIGN.md §12 */
export const AuditOrigin = {
  Online: 'online',
  Offline: 'offline',
} as const;
export type AuditOrigin = (typeof AuditOrigin)[keyof typeof AuditOrigin];
