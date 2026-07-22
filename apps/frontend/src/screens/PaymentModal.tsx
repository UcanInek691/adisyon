import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { formatKurus, parseTlToKurus } from '../lib/format';
import type { Customer, Order, Payment } from '../lib/types';

const METHODS: { key: string; label: string }[] = [
  { key: 'cash', label: 'Nakit' },
  { key: 'card', label: 'Kart' },
  { key: 'transfer', label: 'Havale' },
  { key: 'debt', label: 'Veresiye' },
];

// Parcali/split odeme: her odeme kalani azaltir; toplam >= grandTotal olunca
// backend adisyonu tamamlar (status: completed) -> modal kapanir.
export default function PaymentModal({
  orderId,
  grandTotal,
  onClose,
  onCompleted,
}: {
  orderId: string;
  grandTotal: number;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const qc = useQueryClient();
  const [method, setMethod] = useState('cash');
  const [amountTl, setAmountTl] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [error, setError] = useState('');
  const [overpayAck, setOverpayAck] = useState(false);

  const payments = useQuery({
    queryKey: ['payments', orderId],
    queryFn: () => api<Payment[]>(`/orders/${orderId}/payments`),
  });
  // Veresiye (debt) icin musteri secimi zorunlu — backend customerId ister.
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => api<Customer[]>('/customers'),
    enabled: method === 'debt',
  });

  const paid = (payments.data ?? []).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, grandTotal - paid);
  // Girilen tutar yoksa kalanin tamami varsayilir.
  const amountKurus = amountTl.trim()
    ? parseTlToKurus(amountTl)
    : remaining;
  const isOverpay = amountKurus > remaining;

  const pay = useMutation({
    mutationFn: () =>
      api<Order & { payments?: Payment[] }>(`/orders/${orderId}/payments`, {
        method: 'POST',
        body: {
          method,
          amount: amountKurus,
          idempotencyKey: crypto.randomUUID(),
          ...(isOverpay ? { allowOverpay: true } : {}),
          ...(method === 'debt' ? { customerId } : {}),
        },
      }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['payments', orderId] });
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      setAmountTl('');
      setOverpayAck(false);
      if (order.status === 'completed') {
        qc.invalidateQueries({ queryKey: ['orders', 'open'] });
        onCompleted();
      }
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Ödeme başarısız.'),
  });

  const valid =
    amountKurus > 0 && (method !== 'debt' || customerId !== '') && (!isOverpay || overpayAck);

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Ödeme</h2>
          <button onClick={onClose} className="rounded-lg bg-slate-200 px-3 py-1 font-medium">
            Kapat
          </button>
        </div>

        <div className="mb-4 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
          <Row label="Toplam" value={formatKurus(grandTotal)} />
          <Row label="Ödenen" value={formatKurus(paid)} />
          <Row label="Kalan" value={formatKurus(remaining)} bold />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              className={`rounded-lg py-2 font-semibold ${
                method === m.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {method === 'debt' && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-600">
              Müşteri (veresiye hesabına yazılır)
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-lg"
            >
              <option value="">— Müşteri seçin —</option>
              {(customers.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {(customers.data ?? []).length === 0 && !customers.isLoading && (
              <p className="mt-1 text-xs text-slate-400">
                Kayıtlı müşteri yok — Veresiye ekranından ekleyin.
              </p>
            )}
          </div>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-600">
          Tutar (TL) — boş bırakılırsa kalanın tamamı
        </label>
        <input
          value={amountTl}
          onChange={(e) => setAmountTl(e.target.value)}
          inputMode="decimal"
          placeholder={(remaining / 100).toFixed(2)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-3 text-lg"
        />

        {isOverpay && (
          <label className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <input
              type="checkbox"
              checked={overpayAck}
              onChange={(e) => setOverpayAck(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Kalandan <b>{formatKurus(amountKurus - remaining)}</b> fazla tahsilat yapılıyor.
              Onaylıyorum.
            </span>
          </label>
        )}

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={() => {
            setError('');
            pay.mutate();
          }}
          disabled={pay.isPending || !valid}
          className="w-full rounded-lg bg-green-600 py-3 text-lg font-semibold text-white disabled:opacity-40"
        >
          {formatKurus(amountKurus)} Öde
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
