// Istemci-offline saf mantik (tarayici bagimsiz -> node ile self-check edilebilir).
// OFFLINE_DESIGN.md §5-§8. Self-check: sync-core.selfcheck.ts
export type MutationType =
  'OPEN_TABLE' | 'ADD_LINE' | 'UPDATE_LINE_QTY' | 'ADD_NOTE' | 'SUBMIT_ORDER';

export interface OutboxEntry {
  clientOpId: string; // ULID -> PK + dogal FIFO sirasi
  type: MutationType;
  payload: Record<string, unknown>;
  localOrderId: string; // ait oldugu local draft ('local:<ulid>')
  status: 'pending' | 'inflight';
  retryCount: number;
  createdAt: number;
}

export interface DraftItem {
  id: string; // ADD_LINE clientOpId'si = local satir id'si
  productId: string;
  productNameSnapshot: string;
  quantity: number; // milis (1000 = 1 adet)
  lineTotal: number; // kurus
  status: 'pending' | 'sent';
}

export interface DraftOrder {
  id: string; // 'local:<ulid>'
  clientOpId: string; // OPEN_TABLE clientOpId (mutasyon referansi)
  orderNo: string;
  tableId: string | null;
  status: 'open';
  items: DraftItem[];
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  serverId?: string; // sync sonrasi gercek order id
}

// POST /sync/mutations yanit satiri. OFFLINE_DESIGN.md §7.1
export interface MutationResult {
  clientOpId: string;
  status: 'applied' | 'duplicate' | 'conflict' | 'rejected';
  serverId?: string;
  reviewId?: string;
  reason?: string;
}

export function lineTotal(salePrice: number, qtyMilis: number): number {
  return Math.round((salePrice * qtyMilis) / 1000);
}

type Totals = Pick<DraftOrder, 'subtotal' | 'discountTotal' | 'grandTotal'>;
// Offline draft toplamlari yaklasiktir (KDV/indirim sunucuda kesinlesir). §5.2
export function recompute(items: DraftItem[]): Totals {
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  return { subtotal, discountTotal: 0, grandTotal: subtotal };
}

export function buildOpenTable(
  ids: { orderId: string; clientOpId: string },
  tableId: string | null,
  orderNo: string,
): { draft: DraftOrder; entry: OutboxEntry } {
  const draft: DraftOrder = {
    id: ids.orderId,
    clientOpId: ids.clientOpId,
    orderNo,
    tableId,
    status: 'open',
    items: [],
    subtotal: 0,
    discountTotal: 0,
    grandTotal: 0,
  };
  const entry: OutboxEntry = {
    clientOpId: ids.clientOpId,
    type: 'OPEN_TABLE',
    payload: { tableId },
    localOrderId: ids.orderId,
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
  };
  return { draft, entry };
}

export function buildAddLine(
  draft: DraftOrder,
  lineId: string,
  product: { id: string; name: string; salePrice: number },
  qtyMilis = 1000,
): { draft: DraftOrder; entry: OutboxEntry } {
  const item: DraftItem = {
    id: lineId,
    productId: product.id,
    productNameSnapshot: product.name,
    quantity: qtyMilis,
    lineTotal: lineTotal(product.salePrice, qtyMilis),
    status: 'pending',
  };
  const items = [...draft.items, item];
  const entry: OutboxEntry = {
    clientOpId: lineId,
    type: 'ADD_LINE',
    payload: { orderClientOpId: draft.clientOpId, productId: product.id, quantity: qtyMilis },
    localOrderId: draft.id,
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
  };
  return { draft: { ...draft, items, ...recompute(items) }, entry };
}

export function buildSubmit(
  draft: DraftOrder,
  opId: string,
): { draft: DraftOrder; entry: OutboxEntry } {
  const items = draft.items.map((i) => ({ ...i, status: 'sent' as const }));
  const entry: OutboxEntry = {
    clientOpId: opId,
    type: 'SUBMIT_ORDER',
    payload: { orderClientOpId: draft.clientOpId },
    localOrderId: draft.id,
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
  };
  return { draft: { ...draft, items }, entry };
}

export interface DrainOutcome {
  remove: string[]; // outbox'tan silinecek clientOpId'ler
  serverIdByOpId: Record<string, string>; // applied -> gercek server id
  conflicts: MutationResult[];
  rejections: MutationResult[];
}

// Sunucu sonuclarini outbox aksiyonlarina cevir. applied/duplicate -> sil;
// conflict -> sil (sunucu Owner review kuyruguna aldi); rejected -> sil + garsona bildir.
export function applyResults(results: MutationResult[]): DrainOutcome {
  const out: DrainOutcome = { remove: [], serverIdByOpId: {}, conflicts: [], rejections: [] };
  for (const r of results) {
    out.remove.push(r.clientOpId);
    if (r.status === 'applied' || r.status === 'duplicate') {
      if (r.serverId) out.serverIdByOpId[r.clientOpId] = r.serverId;
    } else if (r.status === 'conflict') {
      out.conflicts.push(r);
    } else {
      out.rejections.push(r);
    }
  }
  return out;
}
