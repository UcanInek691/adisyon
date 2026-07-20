// IndexedDB kalici katmani (ado-offline). OFFLINE_DESIGN.md §4
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { ulid } from './ids';
import type { DraftOrder, OutboxEntry } from './sync-core';

interface AdoDB extends DBSchema {
  outbox: { key: string; value: OutboxEntry };
  drafts: { key: string; value: DraftOrder };
  meta: { key: string; value: { key: string; data: unknown } };
}

let dbp: Promise<IDBPDatabase<AdoDB>> | null = null;
function db(): Promise<IDBPDatabase<AdoDB>> {
  if (!dbp) {
    dbp = openDB<AdoDB>('ado-offline', 1, {
      upgrade(d) {
        d.createObjectStore('outbox', { keyPath: 'clientOpId' });
        d.createObjectStore('drafts', { keyPath: 'id' });
        d.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }
  return dbp;
}

export async function metaGet<T>(key: string): Promise<T | undefined> {
  const row = await (await db()).get('meta', key);
  return row?.data as T | undefined;
}
export async function metaSet(key: string, data: unknown): Promise<void> {
  await (await db()).put('meta', { key, data });
}

// Cihaz kimligi: ilk kayitta uretilir, kalici. OFFLINE_DESIGN.md §4.4
export async function deviceId(): Promise<string> {
  let id = await metaGet<string>('deviceId');
  if (!id) {
    id = ulid();
    await metaSet('deviceId', id);
  }
  return id;
}

export async function outboxAll(): Promise<OutboxEntry[]> {
  const all = await (await db()).getAll('outbox');
  // ULID monotonic -> string sirasi = FIFO
  return all.sort((a, b) => (a.clientOpId < b.clientOpId ? -1 : 1));
}
export async function outboxGet(id: string): Promise<OutboxEntry | undefined> {
  return (await db()).get('outbox', id);
}
export async function outboxPut(e: OutboxEntry): Promise<void> {
  await (await db()).put('outbox', e);
}
export async function outboxDelete(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const d = await db();
  const tx = d.transaction('outbox', 'readwrite');
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

export async function draftGet(id: string): Promise<DraftOrder | undefined> {
  return (await db()).get('drafts', id);
}
export async function draftAll(): Promise<DraftOrder[]> {
  return (await db()).getAll('drafts');
}
export async function draftPut(o: DraftOrder): Promise<void> {
  await (await db()).put('drafts', o);
}
export async function draftDelete(id: string): Promise<void> {
  await (await db()).delete('drafts', id);
}
