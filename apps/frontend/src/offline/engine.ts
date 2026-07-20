// Sync Engine: baglanti durum makinesi + outbox drain. OFFLINE_DESIGN.md §7, §10
import type { QueryClient } from '@tanstack/react-query';
import { getAccess } from '../lib/api';
import { deviceId, outboxAll, outboxDelete, draftGet, draftPut, metaGet, metaSet } from './db';
import { applyResults, type MutationResult } from './sync-core';

const BASE = '/api/v1';

export type SyncMode = 'online' | 'offline' | 'syncing' | 'degraded';
export interface SyncState {
  mode: SyncMode;
  pending: number;
}

let state: SyncState = { mode: 'online', pending: 0 };
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function set(patch: Partial<SyncState>) {
  const next = { ...state, ...patch };
  if (next.mode === state.mode && next.pending === state.pending) return;
  state = next;
  emit();
}

// useSyncExternalStore icin
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function getState(): SyncState {
  return state;
}
export function isOffline(): boolean {
  return state.mode === 'offline';
}

let qc: QueryClient | null = null;
let draining = false;
let lastSnapshot = 0; // katalog cache tazelik damgasi (offline reboot icin sicak tut)

function authHeaders(): Record<string, string> {
  const t = getAccess();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function refreshPending(): Promise<void> {
  set({ pending: (await outboxAll()).length });
}

async function ping(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/sync/health`, { cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

// Aktif durum anlik goruntusu -> cache (offline gosterim icin). §7.2
export async function pullSnapshot(): Promise<void> {
  try {
    const r = await fetch(`${BASE}/sync/snapshot`, { headers: authHeaders() });
    if (r.ok) {
      const b = await r.json();
      await metaSet('snapshot', b?.data ?? b);
      lastSnapshot = Date.now();
    }
  } catch {
    /* offline: eski cache kalir */
  }
}

export async function cachedSnapshot<T = unknown>(): Promise<T | undefined> {
  return metaGet<T>('snapshot');
}

// Outbox'i sunucuya it, sonuclari uygula. §7.1
export async function drain(): Promise<void> {
  if (draining) return;
  const entries = await outboxAll();
  if (entries.length === 0) return;
  draining = true;
  set({ mode: 'syncing' });
  try {
    const dev = await deviceId();
    const res = await fetch(`${BASE}/sync/mutations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        deviceId: dev,
        mutations: entries.map((e) => ({
          clientOpId: e.clientOpId,
          type: e.type,
          payload: e.payload,
        })),
      }),
    });
    if (!res.ok) {
      set({ mode: 'offline' });
      return;
    }
    const body = await res.json();
    const results: MutationResult[] = (body?.data ?? body)?.results ?? [];
    const oc = applyResults(results);

    // OPEN_TABLE applied -> local drafta gercek server id yaz (OrderScreen yonlendirir)
    for (const e of entries) {
      const sid = oc.serverIdByOpId[e.clientOpId];
      if (sid && e.type === 'OPEN_TABLE') {
        const d = await draftGet(e.localOrderId);
        if (d) {
          d.serverId = sid;
          await draftPut(d);
        }
      }
    }
    await outboxDelete(oc.remove);
    await refreshPending();
    await pullSnapshot();
    qc?.invalidateQueries();
    set({ mode: oc.conflicts.length > 0 ? 'degraded' : 'online' });
  } catch {
    set({ mode: 'offline' });
  } finally {
    draining = false;
  }
}

// Aksiyonlar cagirir: outbox degisti -> sayaci tazele, hemen boslatmayi dene.
export async function kick(): Promise<void> {
  await refreshPending();
  void drain();
}

export function startEngine(client: QueryClient): () => void {
  qc = client;
  void refreshPending();

  const tick = async () => {
    const online = await ping();
    if (!online) {
      set({ mode: 'offline' });
      return;
    }
    const pending = (await outboxAll()).length;
    if (pending > 0) {
      await drain();
    } else if (state.mode === 'offline' || state.mode === 'syncing') {
      // Yeni online: cache tazele, sorgulari yenile. degraded'i koru (review acikligi).
      await pullSnapshot();
      qc?.invalidateQueries();
      set({ mode: 'online' });
    } else if (getAccess() && Date.now() - lastSnapshot > 60_000) {
      // Online + bekleyen yok: katalog snapshot'ini periyodik tazele -> offline reboot sicak.
      await pullSnapshot();
    }
  };

  void tick();
  const iv = window.setInterval(() => void tick(), 8000);
  const onOnline = () => void tick();
  const onOffline = () => set({ mode: 'offline' }); // navigator.onLine=false kesindir
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.clearInterval(iv);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
