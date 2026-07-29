import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useLiveEvents } from '../lib/useLiveEvents';
import { formatQty } from '../lib/format';
import type { OfflineReview, Product, Table } from '../lib/types';
import { readProducts, readTables } from '../offline/read';

// Cakisan offline mutasyonlarin Owner onay ekrani. OFFLINE_DESIGN.md §8, §9.2
const REASON: Record<string, string> = {
  cash_closed: 'Kasa oturumu kapalı',
  table_closed: 'Masa kapatılmış',
  table_moved: 'Masa taşınmış / birleştirilmiş',
  product_inactive: 'Ürün pasif',
  other: 'Diğer',
};
const MUT: Record<string, string> = {
  OPEN_TABLE: 'Masa aç',
  ADD_LINE: 'Kalem ekle',
  UPDATE_LINE_QTY: 'Adet güncelle',
  ADD_NOTE: 'Not',
  SUBMIT_ORDER: 'Mutfağa gönder',
};

type Resolution = 'yeni_adisyon' | 'yeniden_ac' | 'reddet';

export default function OfflineReviewScreen() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  useLiveEvents();

  const reviews = useQuery({
    queryKey: ['offline-reviews'],
    queryFn: () => api<OfflineReview[]>('/offline-reviews'),
    refetchInterval: 15_000,
  });
  const products = useQuery({ queryKey: ['products', 'active'], queryFn: readProducts });
  const tables = useQuery({ queryKey: ['tables', 'active'], queryFn: readTables });

  const productName = (id: string) =>
    (products.data ?? []).find((p: Product) => p.id === id)?.name ?? id;
  const tableName = (id: string) => (tables.data ?? []).find((t: Table) => t.id === id)?.name ?? id;

  const resolve = useMutation({
    mutationFn: (v: { id: string; resolution: Resolution }) =>
      api(`/offline-reviews/${v.id}/resolve`, {
        method: 'POST',
        body: { resolution: v.resolution },
      }),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['offline-reviews'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'İşlem başarısız.'),
  });

  function summary(r: OfflineReview): string {
    let p: Record<string, unknown> = {};
    try {
      p = JSON.parse(r.mutationPayload) as Record<string, unknown>;
    } catch {
      /* bozuk payload */
    }
    if (r.mutationType === 'ADD_LINE' && p.productId)
      return `${productName(String(p.productId))} × ${formatQty(Number(p.quantity ?? 1000))}`;
    if (p.tableId) return `Masa: ${tableName(String(p.tableId))}`;
    return r.clientOpId;
  }

  const list = reviews.data ?? [];

  return (
    <div className="min-h-full bg-slate-100">
      <header className="flex items-center gap-3 bg-white px-6 py-3 shadow">
        <button onClick={() => nav('/')} className="rounded-lg bg-slate-200 px-3 py-1 font-medium">
          ← Masalar
        </button>
        <h1 className="text-xl font-bold text-slate-800">Offline Onay Kuyruğu</h1>
        {list.length > 0 && (
          <span className="rounded-full bg-orange-100 px-2 py-1 text-sm font-medium text-orange-700">
            {list.length} bekliyor
          </span>
        )}
      </header>

      <main className="p-6">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {reviews.isLoading && <p className="text-slate-500">Yükleniyor…</p>}
        {!reviews.isLoading && list.length === 0 && (
          <p className="text-slate-500">Bekleyen offline onay yok.</p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {list.map((r) => (
            <article key={r.id} className="rounded-xl bg-white p-4 shadow">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                  {REASON[r.reason] ?? r.reason}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(r.createdAt).toLocaleString('tr-TR')}
                </span>
              </div>
              <p className="font-medium text-slate-800">{MUT[r.mutationType] ?? r.mutationType}</p>
              <p className="text-sm text-slate-600">{summary(r)}</p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={() => resolve.mutate({ id: r.id, resolution: 'yeni_adisyon' })}
                  disabled={resolve.isPending}
                  className="rounded-lg bg-slate-700 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Yeni adisyon
                </button>
                <button
                  onClick={() => resolve.mutate({ id: r.id, resolution: 'yeniden_ac' })}
                  disabled={resolve.isPending}
                  className="rounded-lg bg-slate-200 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  Yeniden aç
                </button>
                <button
                  onClick={() => resolve.mutate({ id: r.id, resolution: 'reddet' })}
                  disabled={resolve.isPending}
                  className="rounded-lg py-2 text-sm font-semibold text-red-600 disabled:opacity-40"
                >
                  Reddet
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
