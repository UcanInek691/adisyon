/**
 * Izin (permission) anahtarlari ve baslangic rol->izin haritasi.
 * Yetki her endpoint'te bu anahtarlarla kontrol edilir (API_DESIGN.md §7).
 */

export const Permission = {
  // Katalog
  ProductManage: 'product.manage',
  PriceChange: 'price.change',
  // Masa & siparis
  TableView: 'table.view',
  TableManage: 'table.manage', // salon/masa tanimi + kat plani (Owner)
  OrderCreate: 'order.create',
  OrderItemEdit: 'order.item.edit',
  OrderSendKitchen: 'order.send_kitchen',
  OrderCancel: 'order.cancel',
  // Indirim
  DiscountApplyLimited: 'discount.apply_limited', // <= %10
  DiscountApplyFull: 'discount.apply_full', // > %10
  // Odeme & kasa
  PaymentTake: 'payment.take',
  PaymentRefund: 'payment.refund',
  CashManage: 'cash.manage',
  // Veresiye & finans
  DebtManage: 'debt.manage',
  FinanceManage: 'finance.manage',
  // Raporlar & denetim
  ReportView: 'report.view',
  AuditView: 'audit.view',
  // Sistem
  SettingsManage: 'settings.manage',
  PrinterManage: 'printer.manage',
  LicenseManage: 'license.manage',
  UpdateManage: 'update.manage',
  BackupManage: 'backup.manage',
  PluginManage: 'plugin.manage',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

/** Waiter'in indirim ust limiti (binde). %10 = 100. A7 karari. */
export const WAITER_MAX_DISCOUNT_PERMILLE = 100;

/**
 * Baslangic rol -> izin atamalari. Owner tam yetki; Waiter yalniz hizli satis.
 * CONVENTIONS.md §2 rol modeli.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<'owner' | 'waiter', Permission[]> = {
  owner: Object.values(Permission),
  waiter: [
    Permission.TableView,
    Permission.OrderCreate,
    Permission.OrderItemEdit,
    Permission.OrderSendKitchen,
    Permission.DiscountApplyLimited,
  ],
};
