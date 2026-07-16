import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { formatKurus, formatQty } from '../lib/format';
import type { Category, Order, Product } from '../lib/types';
import PaymentModal from './PaymentModal';

export default function OrderScreen() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [activeCat, setActiveCat] = useState<string>('');
  const [error, setError] = useState('');
  const [payOpen, setPayOpen] = useState(false);

  const order = useQuery({ queryKey: ['order', id], queryFn: () => api<Order>(`/orders/${id}`) });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('/categories'),
  });
  const products = useQuery({ queryKey: ['products'], queryFn: () => api<Product[]>('/products') });

  const refresh = () => qc.invalidateQueries({ queryKey: ['order', id] });
  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'İşlem başarısız.');

  const addItem = useMutation({
    mutationFn: (productId: string) =>
      api(`/orders/${id}/items`, { method: 'POST', body: { productId, quantity: 1000 } }),
    onSuccess: refresh,
    onError: fail,
  });
  const sendKitchen = useMutation({
    mutationFn: () => api(`/orders/${id}/send-kitchen`, { method: 'POST' }),
    onSuccess: refresh,
    onError: fail,
  });
  const updateQty = useMutation({
    mutationFn: (v: { itemId: string; quantity: number }) =>
      api(`/orders/${id}/items/${v.itemId}`, { method: 'PATCH', body: { quantity: v.quantity } }),
    onSuccess: refresh,
    onError: fail,
  });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => api(`/orders/${id}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: fail,
  });
  const voidItem = useMutation({
    mutationFn: (itemId: string) =>
      api(`/orders/${id}/items/${itemId}/void`, { method: 'POST', body: { reason: 'düzeltme' } }),
    onSuccess: refresh,
    onError: fail,
  });
  const o = order.data;
  const cats = categories.data ?? [];
  const cat = activeCat || cats[0]?.id || '';
  const catProducts = (products.data ?? []).filter((p) => p.categoryId === cat);
  const hasPending = (o?.items ?? []).some((i) => i.status === 'pending');
  const busy =
    addItem.isPending ||
    sendKitchen.isPending ||
    updateQty.isPending ||
    removeItem.isPending ||
    voidItem.isPending;

  return (
    <div className="flex h-full flex-col bg-slate-100 md:flex-row">
      {/* Sol: adisyon */}
      <aside className="flex w-full flex-col bg-white shadow md:w-80">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <button
            onClick={() => nav('/')}
            className="rounded-lg bg-slate-200 px-3 py-1 font-medium"
          >
            ← Masalar
          </button>
          <span className="font-semibold text-slate-700">Adisyon {o?.orderNo ?? ''}</span>
        </header>

        <ul className="flex-1 overflow-auto p-2">
          {(o?.items ?? []).length === 0 && (
            <li className="p-4 text-center text-slate-400">Henüz kalem yok</li>
          )}
          {(o?.items ?? []).map((it) => {
            const pending = it.status === 'pending';
            return (
              <li key={it.id} className="border-b px-2 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{it.productNameSnapshot}</span>
                  <span className="font-semibold text-slate-700">{formatKurus(it.lineTotal)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {pending ? (
                    <>
                      <button
                        onClick={() =>
                          it.quantity <= 1000
                            ? removeItem.mutate(it.id)
                            : updateQty.mutate({ itemId: it.id, quantity: it.quantity - 1000 })
                        }
                        disabled={busy}
                        className="h-8 w-8 rounded-lg bg-slate-200 text-lg font-bold text-slate-700"
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center font-medium">
                        {formatQty(it.quantity)}
                      </span>
                      <button
                        onClick={() =>
                          updateQty.mutate({ itemId: it.id, quantity: it.quantity + 1000 })
                        }
                        disabled={busy}
                        className="h-8 w-8 rounded-lg bg-slate-200 text-lg font-bold text-slate-700"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem.mutate(it.id)}
                        disabled={busy}
                        className="ml-auto rounded-lg px-2 text-sm font-medium text-red-600"
                      >
                        Sil
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-slate-400">
                        {formatQty(it.quantity)} • gönderildi
                      </span>
                      <button
                        onClick={() => voidItem.mutate(it.id)}
                        disabled={busy}
                        className="ml-auto rounded-lg px-2 text-sm font-medium text-red-600"
                      >
                        İptal
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="border-t p-4">
          <div className="mb-3 flex items-center justify-between text-lg font-bold text-slate-800">
            <span>Toplam</span>
            <span>{formatKurus(o?.grandTotal ?? 0)}</span>
          </div>
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => sendKitchen.mutate()}
              disabled={busy || !hasPending}
              className="rounded-lg bg-slate-700 py-3 font-semibold text-white disabled:opacity-40"
            >
              Mutfağa Gönder
            </button>
            <button
              onClick={() => setPayOpen(true)}
              disabled={busy || !o || o.grandTotal <= 0}
              className="rounded-lg bg-green-600 py-3 font-semibold text-white disabled:opacity-40"
            >
              Öde
            </button>
          </div>
        </div>
      </aside>

      {/* Sag: urun grid */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex gap-2 overflow-x-auto border-b bg-white px-4 py-2">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 font-medium ${
                c.id === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-auto p-4 sm:grid-cols-3 lg:grid-cols-4">
          {catProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addItem.mutate(p.id)}
              disabled={busy}
              className="flex aspect-square flex-col items-center justify-center rounded-xl bg-white p-2 text-center shadow disabled:opacity-50"
            >
              <span className="font-medium text-slate-800">{p.name}</span>
              <span className="mt-1 text-sm text-slate-500">{formatKurus(p.salePrice)}</span>
            </button>
          ))}
        </div>
      </main>

      {payOpen && o && (
        <PaymentModal
          orderId={id}
          grandTotal={o.grandTotal}
          onClose={() => setPayOpen(false)}
          onCompleted={() => nav('/', { replace: true })}
        />
      )}
    </div>
  );
}
