import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, getUser } from '../lib/api';
import { useLiveEvents } from '../lib/useLiveEvents';
import { formatKurus } from '../lib/format';
import type { Order, Table } from '../lib/types';
import SyncBadge from '../offline/SyncBadge';
import { offlineOpenTable } from '../offline/actions';
import { isOffline } from '../offline/engine';
import { draftAll } from '../offline/db';
import { readHalls, readTables, readOpenOrders, readHeldOrders } from '../offline/read';
import type { DraftOrder } from '../offline/sync-core';

export default function TablesScreen() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const user = getUser();

  const halls = useQuery({ queryKey: ['halls'], queryFn: readHalls });
  const tables = useQuery({ queryKey: ['tables', 'active'], queryFn: readTables });
  // Canli tazeleme SSE'den gelir; 30 sn polling SSE koparsa emniyet kemeri.
  useLiveEvents();
  const openOrders = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: readOpenOrders,
    refetchInterval: 30_000,
  });
  const heldOrders = useQuery({
    queryKey: ['orders', 'held'],
    queryFn: readHeldOrders,
    refetchInterval: 30_000,
  });
  // Offline acilan (henuz sync olmamis) taslak adisyonlar. OFFLINE_DESIGN.md §4.2
  const localDrafts = useQuery({
    queryKey: ['local-drafts'],
    queryFn: () => draftAll(),
    refetchInterval: 2000,
  });
  const openByTable = new Map<string, Order>();
  for (const o of openOrders.data ?? []) if (o.tableId) openByTable.set(o.tableId, o);
  // Masasiz acik adisyonlar = paket (kurye) + gel-al.
  const openTakeaway = (openOrders.data ?? []).filter((o) => !o.tableId);
  const heldByTable = new Map<string, Order>();
  for (const o of heldOrders.data ?? []) if (o.tableId) heldByTable.set(o.tableId, o);
  const localByTable = new Map<string, DraftOrder>();
  for (const d of localDrafts.data ?? [])
    if (d.tableId && !d.serverId) localByTable.set(d.tableId, d);

  const createOrder = useMutation({
    mutationFn: (tableId: string) => api<Order>('/orders', { method: 'POST', body: { tableId } }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['orders', 'open'] });
      nav(`/orders/${order.id}`);
    },
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Adisyon açılamadı.'),
  });
  // Masasiz adisyon: paket (delivery) / gel-al (takeaway). Cevrimici gerekir.
  const createTakeaway = useMutation({
    mutationFn: (type: 'takeaway' | 'delivery') =>
      api<Order>('/orders', { method: 'POST', body: { type } }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['orders', 'open'] });
      nav(`/orders/${order.id}`);
    },
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Adisyon açılamadı.'),
  });
  // Paket/gel-al adisyonunu iptal (sil). Yanlış açılanlar temizlenebilsin.
  const cancelOrder = useMutation({
    mutationFn: (orderId: string) =>
      api(`/orders/${orderId}/cancel`, { method: 'POST', body: { reason: 'İptal' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', 'open'] }),
    onError: (e) => alert(e instanceof ApiError ? e.message : 'İptal edilemedi.'),
  });
  const askCancel = (o: Order) => {
    const what = o.type === 'delivery' ? 'paket' : 'gel-al';
    if (confirm(`Bu ${what} adisyonunu iptal etmek istiyor musunuz?`)) cancelOrder.mutate(o.id);
  };
  const resumeOrder = useMutation({
    mutationFn: (orderId: string) => api<Order>(`/orders/${orderId}/resume`, { method: 'POST' }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      nav(`/orders/${order.id}`);
    },
  });

  async function onTable(t: Table) {
    const open = openByTable.get(t.id);
    const local = localByTable.get(t.id);
    const held = heldByTable.get(t.id);
    if (open) return nav(`/orders/${open.id}`);
    if (local) return nav(`/orders/${local.id}`);
    if (held) return resumeOrder.mutate(held.id);
    if (isOffline()) {
      const id = await offlineOpenTable(t.id, t.name);
      qc.invalidateQueries({ queryKey: ['local-drafts'] });
      return nav(`/orders/${id}`);
    }
    createOrder.mutate(t.id);
  }

  const loading = halls.isLoading || tables.isLoading || openOrders.isLoading;
  const busy = createOrder.isPending || resumeOrder.isPending || createTakeaway.isPending;
  const offline = isOffline();

  return (
    <div className="min-h-full bg-slate-100">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <h1 className="text-xl font-bold text-slate-800">Masalar</h1>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <SyncBadge />
          <span className="font-medium text-slate-600">
            {user?.displayName ?? user?.role ?? ''}
          </span>
        </div>
      </header>

      <main className="p-6">
        {/* Paket (kurye) / Gel-Al — masasiz adisyonlar */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-700">Paket / Gel-Al</h2>
            <button
              onClick={() => createTakeaway.mutate('delivery')}
              disabled={busy || offline}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow disabled:opacity-40"
            >
              + Paket (Kurye)
            </button>
            <button
              onClick={() => createTakeaway.mutate('takeaway')}
              disabled={busy || offline}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white shadow disabled:opacity-40"
            >
              + Gel-Al
            </button>
            {offline && (
              <span className="text-xs text-slate-400">çevrimdışıyken paket/gel-al açılamaz</span>
            )}
          </div>
          {openTakeaway.length === 0 ? (
            <p className="text-sm text-slate-400">Açık paket/gel-al adisyonu yok</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {openTakeaway.map((o) => (
                <div key={o.id} className="relative">
                  <button
                    data-testid={`takeaway-${o.id}`}
                    onClick={() => nav(`/orders/${o.id}`)}
                    disabled={busy}
                    className={`flex aspect-square w-full flex-col items-center justify-center rounded-xl p-2 text-center font-semibold text-white shadow ${
                      o.type === 'delivery' ? 'bg-sky-500' : 'bg-teal-500'
                    }`}
                  >
                    <span className="text-2xl">{o.type === 'delivery' ? '🛵' : '🥡'}</span>
                    <span className="mt-0.5 text-xs">
                      {o.type === 'delivery' ? 'Paket' : 'Gel-Al'} #{o.orderNo.split('-')[1] ?? ''}
                    </span>
                    <span className="mt-1 text-xs">{formatKurus(o.grandTotal)}</span>
                  </button>
                  <button
                    onClick={() => askCancel(o)}
                    disabled={busy || cancelOrder.isPending}
                    title="İptal et"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-sm font-bold text-white hover:bg-black/60 disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {loading && <p className="text-slate-500">Yükleniyor…</p>}
        {(halls.data ?? []).map((hall) => {
          const hallTables = (tables.data ?? []).filter((t) => t.hallId === hall.id);
          return (
            <section key={hall.id} className="mb-8">
              <h2 className="mb-3 text-lg font-semibold text-slate-700">{hall.name}</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {hallTables.map((t) => {
                  const open = openByTable.get(t.id);
                  const local = !open ? localByTable.get(t.id) : undefined;
                  const held = !open && !local ? heldByTable.get(t.id) : undefined;
                  const active = open ?? local ?? held;
                  return (
                    <button
                      key={t.id}
                      data-testid={`table-${t.id}`}
                      onClick={() => void onTable(t)}
                      disabled={busy}
                      className={`flex aspect-square flex-col items-center justify-center rounded-xl p-2 text-center font-semibold shadow ${
                        open || local
                          ? 'bg-amber-500 text-white'
                          : held
                            ? 'bg-purple-500 text-white'
                            : 'bg-white text-slate-700'
                      }`}
                    >
                      <span className="text-lg">{t.name}</span>
                      {held && <span className="mt-0.5 text-[10px]">bekletiliyor</span>}
                      {local && <span className="mt-0.5 text-[10px]">⏳ senkron bekliyor</span>}
                      {active && (
                        <span className="mt-1 text-xs">{formatKurus(active.grandTotal)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
