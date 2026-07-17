import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { formatKurus } from '../lib/format';
import type { CashSession } from '../lib/types';

// TL metnini kurusa cevir (PaymentModal ile ayni kalip). Gecersizse NaN.
const toKurus = (tl: string) => Math.round(parseFloat(tl.replace(',', '.')) * 100);

const TXN_LABELS: Record<string, string> = {
  opening: 'Açılış',
  sale: 'Satış',
  refund: 'İade',
  payout: 'Para Çıkışı',
  income: 'Para Girişi',
  expense: 'Gider',
  adjustment: 'Düzeltme',
  closing: 'Kapanış',
};

export default function KasaScreen() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState('');

  const session = useQuery<CashSession>({
    queryKey: ['cash', 'active'],
    queryFn: () => api<CashSession>('/cash/sessions/active'),
    retry: false,
  });

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'İşlem başarısız.');
  const refresh = () => {
    setError('');
    qc.invalidateQueries({ queryKey: ['cash', 'active'] });
  };

  const noSession =
    session.isError && session.error instanceof ApiError && session.error.status === 404;

  return (
    <div className="flex h-full flex-col bg-slate-100">
      <header className="flex items-center gap-3 bg-white px-6 py-3 shadow">
        <button onClick={() => nav('/')} className="rounded-lg bg-slate-200 px-3 py-1 font-medium">
          ← Masalar
        </button>
        <h1 className="text-lg font-bold text-slate-800">Kasa</h1>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 overflow-auto p-4">
        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

        {session.isLoading && <p className="p-6 text-center text-slate-400">Yükleniyor…</p>}

        {noSession && <OpenForm onDone={refresh} onError={fail} />}

        {session.data && <ActiveSession session={session.data} onDone={refresh} onError={fail} />}
      </div>
    </div>
  );
}

function OpenForm({ onDone, onError }: { onDone: () => void; onError: (e: unknown) => void }) {
  const [floatTl, setFloatTl] = useState('');
  const open = useMutation({
    mutationFn: (openingFloat: number) =>
      api('/cash/sessions/open', { method: 'POST', body: { openingFloat } }),
    onSuccess: onDone,
    onError,
  });
  const kurus = toKurus(floatTl);
  const valid = floatTl.trim() !== '' && Number.isFinite(kurus) && kurus >= 0;

  return (
    <div className="rounded-2xl bg-white p-6 shadow">
      <h2 className="mb-1 text-lg font-bold text-slate-800">Kasa Kapalı</h2>
      <p className="mb-4 text-sm text-slate-500">Açılış bakiyesini girip kasayı açın.</p>
      <label className="mb-1 block text-sm font-medium text-slate-600">Açılış Bakiyesi (TL)</label>
      <input
        value={floatTl}
        onChange={(e) => setFloatTl(e.target.value)}
        inputMode="decimal"
        placeholder="0.00"
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-3 text-lg"
      />
      <button
        onClick={() => open.mutate(kurus)}
        disabled={open.isPending || !valid}
        className="w-full rounded-lg bg-green-600 py-3 text-lg font-semibold text-white disabled:opacity-40"
      >
        Kasa Aç
      </button>
    </div>
  );
}

function ActiveSession({
  session,
  onDone,
  onError,
}: {
  session: CashSession;
  onDone: () => void;
  onError: (e: unknown) => void;
}) {
  const [dir, setDir] = useState<'payout' | 'income'>('payout');
  const [amountTl, setAmountTl] = useState('');
  const [note, setNote] = useState('');
  const [countTl, setCountTl] = useState('');

  // Beklenen tutar = acilis + acilis/kapanis disi tum hareketler (backend ile ayni).
  const expected =
    session.openingFloat +
    session.transactions
      .filter((t) => t.type !== 'opening' && t.type !== 'closing')
      .reduce((s, t) => s + t.amount, 0);

  const txn = useMutation({
    mutationFn: (body: { type: string; amount: number; method: string; note?: string }) =>
      api('/cash/transactions', { method: 'POST', body }),
    onSuccess: () => {
      setAmountTl('');
      setNote('');
      onDone();
    },
    onError,
  });

  const close = useMutation({
    mutationFn: (countedAmount: number) =>
      api('/cash/sessions/close', { method: 'POST', body: { countedAmount } }),
    onSuccess: onDone,
    onError,
  });

  const moveKurus = toKurus(amountTl);
  const moveValid = amountTl.trim() !== '' && Number.isFinite(moveKurus) && moveKurus > 0;
  const submitMove = () =>
    // payout cekmeceden cikis -> negatif; income giris -> pozitif.
    txn.mutate({
      type: dir,
      amount: dir === 'payout' ? -moveKurus : moveKurus,
      method: 'cash',
      ...(note.trim() ? { note: note.trim() } : {}),
    });

  const countKurus = toKurus(countTl);
  const closeValid = countTl.trim() !== '' && Number.isFinite(countKurus) && countKurus >= 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Açılış Bakiyesi</span>
          <span>{formatKurus(session.openingFloat)}</span>
        </div>
        <div className="mt-1 flex justify-between text-lg font-bold text-slate-800">
          <span>Beklenen Nakit</span>
          <span>{formatKurus(expected)}</span>
        </div>
      </div>

      {/* Kasa hareketi ekle */}
      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 font-bold text-slate-800">Kasa Hareketi</h2>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setDir('payout')}
            className={`rounded-lg py-2 font-semibold ${dir === 'payout' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Para Çıkışı
          </button>
          <button
            onClick={() => setDir('income')}
            className={`rounded-lg py-2 font-semibold ${dir === 'income' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Para Girişi
          </button>
        </div>
        <input
          value={amountTl}
          onChange={(e) => setAmountTl(e.target.value)}
          inputMode="decimal"
          placeholder="Tutar (TL)"
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Açıklama (isteğe bağlı)"
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <button
          onClick={submitMove}
          disabled={txn.isPending || !moveValid}
          className="w-full rounded-lg bg-slate-700 py-2 font-semibold text-white disabled:opacity-40"
        >
          Ekle
        </button>
      </div>

      {/* Hareketler */}
      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-2 font-bold text-slate-800">Hareketler</h2>
        <ul className="divide-y">
          {session.transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-600">
                {TXN_LABELS[t.type] ?? t.type}
                {t.note ? <span className="text-slate-400"> · {t.note}</span> : null}
              </span>
              <span className={`font-semibold ${t.amount < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                {formatKurus(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Kasa kapat (Z) */}
      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-1 font-bold text-slate-800">Kasa Kapat (Z)</h2>
        <p className="mb-3 text-sm text-slate-500">Sayılan nakit tutarını girin.</p>
        <input
          value={countTl}
          onChange={(e) => setCountTl(e.target.value)}
          inputMode="decimal"
          placeholder="Sayılan Tutar (TL)"
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        {countValid(countKurus, countTl) && (
          <p className="mb-2 text-sm text-slate-600">
            Fark:{' '}
            <span className={countKurus - expected < 0 ? 'text-red-600' : 'text-green-600'}>
              {formatKurus(countKurus - expected)}
            </span>
          </p>
        )}
        <button
          onClick={() => close.mutate(countKurus)}
          disabled={close.isPending || !closeValid}
          className="w-full rounded-lg bg-red-600 py-3 font-semibold text-white disabled:opacity-40"
        >
          Kasayı Kapat
        </button>
      </div>
    </div>
  );
}

// Fark onizlemesi icin: gecerli sayi girildi mi.
function countValid(kurus: number, raw: string) {
  return raw.trim() !== '' && Number.isFinite(kurus) && kurus >= 0;
}
