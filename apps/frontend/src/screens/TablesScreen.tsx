import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, getUser } from '../lib/api';
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
  });
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
  const busy = createOrder.isPending || resumeOrder.isPending;

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
