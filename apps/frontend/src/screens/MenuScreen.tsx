import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { formatKurus } from '../lib/format';
import type { Category, Product, Tax, Unit } from '../lib/types';

const toKurus = (tl: string) => Math.round(parseFloat(tl.replace(',', '.')) * 100);

export default function MenuScreen() {
  const nav = useNavigate();
  const [cat, setCat] = useState<string | null>(null); // null = tümü
  const [catModal, setCatModal] = useState<Category | 'new' | null>(null);
  const [prodModal, setProdModal] = useState<Product | 'new' | null>(null);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('/categories'),
  });
  const products = useQuery({ queryKey: ['products'], queryFn: () => api<Product[]>('/products') });
  const units = useQuery({ queryKey: ['units'], queryFn: () => api<Unit[]>('/units') });
  const taxes = useQuery({ queryKey: ['taxes'], queryFn: () => api<Tax[]>('/taxes') });

  const shown = (products.data ?? []).filter((p) => cat === null || p.categoryId === cat);

  return (
    <div className="flex h-full flex-col bg-slate-100 md:flex-row">
      <aside className="flex w-full flex-col bg-white shadow md:w-72">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <button
            onClick={() => nav('/')}
            className="rounded-lg bg-slate-200 px-3 py-1 font-medium"
          >
            ← Masalar
          </button>
          <h1 className="font-bold text-slate-800">Ürünler</h1>
          <button
            onClick={() => setCatModal('new')}
            className="ml-auto rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white"
          >
            + Kategori
          </button>
        </header>
        <ul className="flex-1 overflow-auto">
          <li>
            <button
              onClick={() => setCat(null)}
              className={`w-full border-b px-4 py-3 text-left font-medium ${cat === null ? 'bg-blue-50' : ''}`}
            >
              Tümü
            </button>
          </li>
          {(categories.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center border-b">
              <button
                onClick={() => setCat(c.id)}
                className={`flex-1 px-4 py-3 text-left font-medium ${cat === c.id ? 'bg-blue-50' : ''}`}
              >
                {c.name}
              </button>
              <button
                onClick={() => setCatModal(c)}
                className="px-3 py-3 text-sm text-slate-400 hover:text-slate-700"
              >
                ✎
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b bg-white px-4 py-3">
          <h2 className="font-bold text-slate-800">
            {cat === null ? 'Tüm Ürünler' : (categories.data ?? []).find((c) => c.id === cat)?.name}
          </h2>
          <button
            onClick={() => setProdModal('new')}
            className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            + Ürün
          </button>
        </header>
        <ul className="flex-1 overflow-auto p-2">
          {shown.length === 0 && <li className="p-6 text-center text-slate-400">Ürün yok</li>}
          {shown.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setProdModal(p)}
                className="flex w-full items-center justify-between border-b px-3 py-3 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{p.name}</span>
                  {p.isFavorite && <span className="text-amber-500">★</span>}
                  {p.isActive === false && (
                    <span className="rounded bg-slate-200 px-1.5 text-xs text-slate-500">
                      pasif
                    </span>
                  )}
                </span>
                <span className="font-semibold text-slate-700">{formatKurus(p.salePrice)}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>

      {catModal && (
        <CategoryModal
          category={catModal === 'new' ? null : catModal}
          onClose={() => setCatModal(null)}
        />
      )}
      {prodModal && (
        <ProductModal
          product={prodModal === 'new' ? null : prodModal}
          categories={categories.data ?? []}
          units={units.data ?? []}
          taxes={taxes.data ?? []}
          defaultCategoryId={cat}
          onClose={() => setProdModal(null)}
        />
      )}
    </div>
  );
}

function CategoryModal({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(category?.name ?? '');
  const [error, setError] = useState('');
  const done = () => {
    qc.invalidateQueries({ queryKey: ['categories'] });
    onClose();
  };
  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'İşlem başarısız.');

  const save = useMutation({
    mutationFn: () =>
      category
        ? api(`/categories/${category.id}`, { method: 'PATCH', body: { name: name.trim() } })
        : api('/categories', { method: 'POST', body: { name: name.trim() } }),
    onSuccess: done,
    onError: fail,
  });
  const del = useMutation({
    mutationFn: () => api(`/categories/${category!.id}`, { method: 'DELETE' }),
    onSuccess: done,
    onError: fail,
  });

  return (
    <Modal title={category ? 'Kategori Düzenle' : 'Yeni Kategori'} onClose={onClose}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Kategori adı"
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        {category && (
          <button
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="rounded-lg bg-red-100 px-4 py-2 font-medium text-red-700 disabled:opacity-40"
          >
            Sil
          </button>
        )}
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || name.trim() === ''}
          className="flex-1 rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:opacity-40"
        >
          Kaydet
        </button>
      </div>
    </Modal>
  );
}

function ProductModal({
  product,
  categories,
  units,
  taxes,
  defaultCategoryId,
  onClose,
}: {
  product: Product | null;
  categories: Category[];
  units: Unit[];
  taxes: Tax[];
  defaultCategoryId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const defTax = taxes.find((t) => t.isDefault)?.id ?? taxes[0]?.id ?? '';
  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(
    product?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? '',
  );
  const [priceTl, setPriceTl] = useState(product ? (product.salePrice / 100).toFixed(2) : '');
  const [unitId, setUnitId] = useState(product?.unitId ?? units[0]?.id ?? '');
  const [taxId, setTaxId] = useState(product?.taxId ?? defTax);
  const [isFavorite, setIsFavorite] = useState(product?.isFavorite ?? false);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [error, setError] = useState('');

  const done = () => {
    qc.invalidateQueries({ queryKey: ['products'] });
    onClose();
  };
  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'İşlem başarısız.');

  const salePrice = toKurus(priceTl);
  const valid =
    name.trim() !== '' &&
    categoryId !== '' &&
    unitId !== '' &&
    taxId !== '' &&
    priceTl.trim() !== '' &&
    Number.isFinite(salePrice) &&
    salePrice >= 0;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        categoryId,
        unitId,
        taxId,
        salePrice,
        isFavorite,
        isActive,
      };
      return product
        ? api(`/products/${product.id}`, { method: 'PATCH', body })
        : api('/products', { method: 'POST', body });
    },
    onSuccess: done,
    onError: fail,
  });
  const del = useMutation({
    mutationFn: () => api(`/products/${product!.id}`, { method: 'DELETE' }),
    onSuccess: done,
    onError: fail,
  });

  return (
    <Modal title={product ? 'Ürün Düzenle' : 'Yeni Ürün'} onClose={onClose}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ürün adı"
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      <div className="mb-2 grid grid-cols-2 gap-2">
        <Select label="Kategori" value={categoryId} onChange={setCategoryId} options={categories} />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Satış Fiyatı (TL)</label>
          <input
            value={priceTl}
            onChange={(e) => setPriceTl(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <Select label="Birim" value={unitId} onChange={setUnitId} options={units} />
        <Select label="Vergi" value={taxId} onChange={setTaxId} options={taxes} />
      </div>
      <div className="mb-3 flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(e) => setIsFavorite(e.target.checked)}
          />
          Favori
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Aktif
        </label>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        {product && (
          <button
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="rounded-lg bg-red-100 px-4 py-2 font-medium text-red-700 disabled:opacity-40"
          >
            Sil
          </button>
        )}
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !valid}
          className="flex-1 rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:opacity-40"
        >
          Kaydet
        </button>
      </div>
    </Modal>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="rounded-lg bg-slate-200 px-3 py-1 font-medium">
            Kapat
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
