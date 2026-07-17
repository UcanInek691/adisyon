import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, clearSession, getUser, hasPerm } from '../lib/api';
import { formatKurus } from '../lib/format';
import type { Hall, Order, Table } from '../lib/types';

export default function TablesScreen() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const user = getUser();

  const halls = useQuery({ queryKey: ['halls'], queryFn: () => api<Hall[]>('/halls') });
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api<Table[]>('/tables') });
  const openOrders = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => api<Order[]>('/orders?open=true'),
  });
  const heldOrders = useQuery({
    queryKey: ['orders', 'held'],
    queryFn: () => api<Order[]>('/orders?status=held'),
  });

  const openByTable = new Map<string, Order>();
  for (const o of openOrders.data ?? []) if (o.tableId) openByTable.set(o.tableId, o);
  const heldByTable = new Map<string, Order>();
  for (const o of heldOrders.data ?? []) if (o.tableId) heldByTable.set(o.tableId, o);

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

  function onTable(t: Table) {
    const open = openByTable.get(t.id);
    const held = heldByTable.get(t.id);
    if (open) nav(`/orders/${open.id}`);
    else if (held) resumeOrder.mutate(held.id);
    else createOrder.mutate(t.id);
  }

  function logout() {
    clearSession();
    nav('/login', { replace: true });
  }

  const loading = halls.isLoading || tables.isLoading || openOrders.isLoading;
  const busy = createOrder.isPending || resumeOrder.isPending;

  return (
    <div className="min-h-full bg-slate-100">
      <header className="flex items-center justify-between bg-white px-6 py-3 shadow">
        <h1 className="text-xl font-bold text-slate-800">Masalar</h1>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>{user?.displayName ?? user?.role ?? ''}</span>
          {hasPerm('cash.manage') && (
            <button
              onClick={() => nav('/cash')}
              className="rounded-lg bg-slate-200 px-3 py-1 font-medium"
            >
              Kasa
            </button>
          )}
          {hasPerm('debt.manage') && (
            <button
              onClick={() => nav('/customers')}
              className="rounded-lg bg-slate-200 px-3 py-1 font-medium"
            >
              Veresiye
            </button>
          )}
          {hasPerm('product.manage') && (
            <button
              onClick={() => nav('/menu')}
              className="rounded-lg bg-slate-200 px-3 py-1 font-medium"
            >
              Ürünler
            </button>
          )}
          {hasPerm('report.view') && (
            <button
              onClick={() => nav('/report')}
              className="rounded-lg bg-slate-200 px-3 py-1 font-medium"
            >
              Gün Sonu
            </button>
          )}
          <button onClick={logout} className="rounded-lg bg-slate-200 px-3 py-1 font-medium">
            Çıkış
          </button>
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
                  const held = !open ? heldByTable.get(t.id) : undefined;
                  const active = open ?? held;
                  return (
                    <button
                      key={t.id}
                      onClick={() => onTable(t)}
                      disabled={busy}
                      className={`flex aspect-square flex-col items-center justify-center rounded-xl p-2 text-center font-semibold shadow ${
                        open
                          ? 'bg-amber-500 text-white'
                          : held
                            ? 'bg-purple-500 text-white'
                            : 'bg-white text-slate-700'
                      }`}
                    >
                      <span className="text-lg">{t.name}</span>
                      {held && <span className="mt-0.5 text-[10px]">bekletiliyor</span>}
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
