// Ekranlarin cagirdigi offline aksiyonlar: draft yaz + outbox'a kuyrukla + drain tetikle.
import { ulid } from './ids';
import { buildOpenTable, buildAddLine, buildSubmit, recompute, type DraftOrder } from './sync-core';
import { draftGet, draftPut, outboxPut, outboxGet, outboxDelete } from './db';
import { kick } from './engine';

export const LOCAL_PREFIX = 'local:';
export function isLocalId(id: string): boolean {
  return id.startsWith(LOCAL_PREFIX);
}

async function commit(draft: DraftOrder, entry: Parameters<typeof outboxPut>[0]): Promise<void> {
  await draftPut(draft);
  await outboxPut(entry);
  void kick();
}

// Masa ac (offline) -> local draft id doner. UI bu id ile OrderScreen'e gider.
export async function offlineOpenTable(tableId: string, tableName: string): Promise<string> {
  const op = ulid();
  const orderId = LOCAL_PREFIX + op;
  const { draft, entry } = buildOpenTable({ orderId, clientOpId: op }, tableId, `⏳ ${tableName}`);
  await commit(draft, entry);
  return orderId;
}

export async function offlineAddLine(
  orderId: string,
  product: { id: string; name: string; salePrice: number },
): Promise<void> {
  const d = await draftGet(orderId);
  if (!d) throw new Error('Taslak adisyon bulunamadi');
  const { draft, entry } = buildAddLine(d, ulid(), product);
  await commit(draft, entry);
}

export async function offlineSubmit(orderId: string): Promise<void> {
  const d = await draftGet(orderId);
  if (!d) throw new Error('Taslak adisyon bulunamadi');
  const { draft, entry } = buildSubmit(d, ulid());
  await commit(draft, entry);
}

// Gonderilmemis draft satir duzenleme = lokal, mutasyon degil. OFFLINE_DESIGN.md §5.3
export async function offlineUpdateQty(
  orderId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  const d = await draftGet(orderId);
  if (!d) return;
  const items = d.items.map((i) =>
    i.id === itemId
      ? { ...i, quantity, lineTotal: Math.round((i.lineTotal / i.quantity) * quantity) }
      : i,
  );
  await draftPut({ ...d, items, ...recompute(items) });
  const e = await outboxGet(itemId);
  if (e) {
    e.payload = { ...e.payload, quantity };
    await outboxPut(e);
  }
}

export async function offlineRemoveLine(orderId: string, itemId: string): Promise<void> {
  const d = await draftGet(orderId);
  if (!d) return;
  const items = d.items.filter((i) => i.id !== itemId);
  await draftPut({ ...d, items, ...recompute(items) });
  await outboxDelete([itemId]); // gonderilmemis satir -> outbox'tan da cikar
  void kick();
}

export async function readLocalOrder(orderId: string): Promise<DraftOrder> {
  const d = await draftGet(orderId);
  if (!d) throw new Error('Taslak adisyon bulunamadi');
  return d;
}
