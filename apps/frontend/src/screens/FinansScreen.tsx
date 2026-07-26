import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { formatKurus, parseTlToKurus as toKurus } from '../lib/format';
import type { Expense, ExpenseCategory, Income } from '../lib/types';

// TL metnini kurusa cevir (KasaScreen ile ayni kalip). Gecersizse NaN.
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR');

export default function FinansScreen() {
  const nav = useNavigate();
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [error, setError] = useState('');
  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'İşlem başarısız.');

  return (
    <div className="flex h-full flex-col bg-slate-100">
      <header className="flex items-center gap-3 bg-white px-6 py-3 shadow">
        <button onClick={() => nav('/')} className="rounded-lg bg-slate-200 px-3 py-1 font-medium">
          ← Masalar
        </button>
        <h1 className="text-lg font-bold text-slate-800">Gelir / Gider</h1>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 overflow-auto p-4">
        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab('expense')}
            className={`rounded-lg py-2 font-semibold ${tab === 'expense' ? 'bg-red-600 text-white' : 'bg-white text-slate-600'}`}
          >
            Gider
          </button>
          <button
            onClick={() => setTab('income')}
            className={`rounded-lg py-2 font-semibold ${tab === 'income' ? 'bg-green-600 text-white' : 'bg-white text-slate-600'}`}
          >
            Gelir
          </button>
        </div>

        {tab === 'expense' ? <ExpenseTab onError={fail} /> : <IncomeTab onError={fail} />}
      </div>
    </div>
  );
}

function ExpenseTab({ onError }: { onError: (e: unknown) => void }) {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState('');
  const [newCat, setNewCat] = useState('');
  const [amountTl, setAmountTl] = useState('');
  const [desc, setDesc] = useState('');
  const [affectsCash, setAffectsCash] = useState(true);

  const categories = useQuery({
    queryKey: ['finance', 'categories'],
    queryFn: () => api<ExpenseCategory[]>('/finance/categories'),
  });
  const expenses = useQuery({
    queryKey: ['finance', 'expenses'],
    queryFn: () => api<Expense[]>('/finance/expenses'),
  });
  const catName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));

  const createCat = useMutation({
    mutationFn: (name: string) =>
      api<ExpenseCategory>('/finance/categories', { method: 'POST', body: { name } }),
    onSuccess: (cat) => {
      setNewCat('');
      setCategoryId(cat.id);
      qc.invalidateQueries({ queryKey: ['finance', 'categories'] });
    },
    onError,
  });

  const create = useMutation({
    mutationFn: (body: {
      categoryId: string;
      amount: number;
      description?: string;
      affectsCash: boolean;
    }) => api('/finance/expenses', { method: 'POST', body }),
    onSuccess: () => {
      setAmountTl('');
      setDesc('');
      qc.invalidateQueries({ queryKey: ['finance', 'expenses'] });
    },
    onError,
  });

  const kurus = toKurus(amountTl);
  const valid = categoryId !== '' && amountTl.trim() !== '' && Number.isFinite(kurus) && kurus > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 font-bold text-slate-800">Gider Ekle</h2>
        <div className="mb-2 flex gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">Kategori seçin…</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-2 flex gap-2">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Yeni kategori adı"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
          />
          <button
            onClick={() => createCat.mutate(newCat.trim())}
            disabled={createCat.isPending || newCat.trim() === ''}
            className="rounded-lg bg-slate-200 px-3 py-2 font-medium disabled:opacity-40"
          >
            Ekle
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
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Açıklama (isteğe bağlı)"
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={affectsCash}
            onChange={(e) => setAffectsCash(e.target.checked)}
          />
          Açık kasadan düşülsün
        </label>
        <button
          onClick={() =>
            create.mutate({
              categoryId,
              amount: kurus,
              ...(desc.trim() ? { description: desc.trim() } : {}),
              affectsCash,
            })
          }
          disabled={create.isPending || !valid}
          className="w-full rounded-lg bg-red-600 py-2 font-semibold text-white disabled:opacity-40"
        >
          Gider Kaydet
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-2 font-bold text-slate-800">Giderler</h2>
        {expenses.isLoading && <p className="text-sm text-slate-400">Yükleniyor…</p>}
        <ul className="divide-y">
          {(expenses.data ?? []).map((x) => (
            <li key={x.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-600">
                {fmtDate(x.spentAt)} · {catName.get(x.categoryId) ?? '—'}
                {x.description ? <span className="text-slate-400"> · {x.description}</span> : null}
              </span>
              <span className="font-semibold text-red-600">{formatKurus(x.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function IncomeTab({ onError }: { onError: (e: unknown) => void }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState('');
  const [amountTl, setAmountTl] = useState('');
  const [desc, setDesc] = useState('');
  const [affectsCash, setAffectsCash] = useState(true);

  const incomes = useQuery({
    queryKey: ['finance', 'incomes'],
    queryFn: () => api<Income[]>('/finance/incomes'),
  });

  const create = useMutation({
    mutationFn: (body: {
      category?: string;
      amount: number;
      description?: string;
      affectsCash: boolean;
    }) => api('/finance/incomes', { method: 'POST', body }),
    onSuccess: () => {
      setAmountTl('');
      setDesc('');
      qc.invalidateQueries({ queryKey: ['finance', 'incomes'] });
    },
    onError,
  });

  const kurus = toKurus(amountTl);
  const valid = amountTl.trim() !== '' && Number.isFinite(kurus) && kurus > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 font-bold text-slate-800">Gelir Ekle</h2>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Kategori (isteğe bağlı)"
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          value={amountTl}
          onChange={(e) => setAmountTl(e.target.value)}
          inputMode="decimal"
          placeholder="Tutar (TL)"
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Açıklama (isteğe bağlı)"
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={affectsCash}
            onChange={(e) => setAffectsCash(e.target.checked)}
          />
          Açık kasaya eklensin
        </label>
        <button
          onClick={() =>
            create.mutate({
              ...(category.trim() ? { category: category.trim() } : {}),
              amount: kurus,
              ...(desc.trim() ? { description: desc.trim() } : {}),
              affectsCash,
            })
          }
          disabled={create.isPending || !valid}
          className="w-full rounded-lg bg-green-600 py-2 font-semibold text-white disabled:opacity-40"
        >
          Gelir Kaydet
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-2 font-bold text-slate-800">Gelirler</h2>
        {incomes.isLoading && <p className="text-sm text-slate-400">Yükleniyor…</p>}
        <ul className="divide-y">
          {(incomes.data ?? []).map((x) => (
            <li key={x.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-600">
                {fmtDate(x.receivedAt)} · {x.category ?? '—'}
                {x.description ? <span className="text-slate-400"> · {x.description}</span> : null}
              </span>
              <span className="font-semibold text-green-600">{formatKurus(x.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
