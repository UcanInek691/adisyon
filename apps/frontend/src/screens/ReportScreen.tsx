import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatKurus } from '../lib/format';
import { ENTITY_LABEL, actionLabel, entryName } from './report-audit';

interface CashSession {
  id: string;
  status: string;
  openingFloatKurus: number;
  expectedKurus: number | null;
  countedKurus: number | null;
  differenceKurus: number | null;
}
interface EndOfDay {
  businessDay: string;
  sales: { count: number; grossKurus: number; discountKurus: number; netKurus: number };
  payments: { method: string; totalKurus: number }[];
  cash: { sessions: CashSession[]; differenceTotalKurus: number };
  expensesKurus: number;
  incomesKurus: number;
}
interface EodHistory {
  id: string;
  businessDay: string;
  closedAt: string | null;
  openingFloatKurus: number;
  expectedKurus: number;
  countedKurus: number;
  differenceKurus: number;
}
interface CustomerDebt {
  customerId: string;
  customerName: string;
  phone: string | null;
  balanceKurus: number;
}
interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  origin: string | null;
  createdAt: string;
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  qr: 'QR',
  debt: 'Veresiye',
};

const today = () => new Date().toISOString().slice(0, 10);

type Tab = 'eod' | 'history' | 'debt' | 'audit';
const TABS: { key: Tab; label: string }[] = [
  { key: 'eod', label: 'Gün Sonu (Z)' },
  { key: 'history', label: 'Gün Sonu Geçmişi' },
  { key: 'debt', label: 'Veresiye Borç' },
  { key: 'audit', label: 'Kayıt Geçmişi' },
];

export default function ReportScreen() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('eod');

  return (
    <div className="min-h-full bg-slate-100">
      <header className="bg-white px-6 py-3 shadow">
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav('/')}
            className="rounded-lg bg-slate-200 px-3 py-1 font-medium"
          >
            ← Masalar
          </button>
          <h1 className="text-xl font-bold text-slate-800">Raporlar</h1>
        </div>
        <nav className="mt-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-6">
        {tab === 'eod' && <EodTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'debt' && <DebtTab />}
        {tab === 'audit' && <AuditTab />}
      </main>
    </div>
  );
}

// --- Gün Sonu (Z): tek iş günü ---
function EodTab() {
  const [date, setDate] = useState(today());
  const report = useQuery({
    queryKey: ['eod', date],
    queryFn: () => api<EndOfDay>(`/reports/end-of-day?date=${date}`),
  });
  const r = report.data;
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{r ? `İş günü: ${r.businessDay}` : 'İş günü'}</p>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>
      {report.isLoading && <p className="text-slate-500">Yükleniyor…</p>}
      {report.isError && <p className="text-red-600">Rapor alınamadı.</p>}
      {r && (
        <>
          <Card title="Satış">
            <Line label="Fiş sayısı" value={String(r.sales.count)} />
            <Line label="Brüt" value={formatKurus(r.sales.grossKurus)} />
            <Line label="İndirim" value={`−${formatKurus(r.sales.discountKurus)}`} />
            <Line label="Net ciro" value={formatKurus(r.sales.netKurus)} bold />
          </Card>
          <Card title="Ödeme (yönteme göre)">
            {r.payments.length === 0 && <p className="text-slate-400">Ödeme yok</p>}
            {r.payments.map((p) => (
              <Line
                key={p.method}
                label={METHOD_LABEL[p.method] ?? p.method}
                value={formatKurus(p.totalKurus)}
              />
            ))}
          </Card>
          <Card title="Kasa oturumları">
            {r.cash.sessions.length === 0 && <p className="text-slate-400">Oturum yok</p>}
            {r.cash.sessions.map((s) => (
              <div key={s.id} className="mb-2 rounded-lg bg-slate-50 p-2 text-sm">
                <Line label="Açılış kasası" value={formatKurus(s.openingFloatKurus)} />
                <Line
                  label="Beklenen"
                  value={s.expectedKurus == null ? '—' : formatKurus(s.expectedKurus)}
                />
                <Line
                  label="Sayılan"
                  value={s.countedKurus == null ? '—' : formatKurus(s.countedKurus)}
                />
                <Line
                  label="Fark"
                  value={s.differenceKurus == null ? '—' : formatKurus(s.differenceKurus)}
                  bold
                />
                <span className="text-xs text-slate-400">{s.status}</span>
              </div>
            ))}
            {r.cash.sessions.length > 0 && (
              <Line label="Toplam fark" value={formatKurus(r.cash.differenceTotalKurus)} bold />
            )}
          </Card>
          <Card title="Gider / Gelir">
            <Line label="Gider" value={`−${formatKurus(r.expensesKurus)}`} />
            <Line label="Gelir" value={formatKurus(r.incomesKurus)} />
          </Card>
        </>
      )}
    </>
  );
}

// --- Gün Sonu Geçmişi: kapanmış kasa oturumları ---
function HistoryTab() {
  const q = useQuery({
    queryKey: ['eod-history'],
    queryFn: () => api<EodHistory[]>('/reports/end-of-day/history'),
  });
  if (q.isLoading) return <p className="text-slate-500">Yükleniyor…</p>;
  if (q.isError) return <p className="text-red-600">Geçmiş alınamadı.</p>;
  const rows = q.data ?? [];
  if (rows.length === 0) return <p className="text-slate-400">Henüz kapatılmış gün sonu yok.</p>;
  return (
    <Card title={`Gün Sonu Geçmişi (${rows.length})`}>
      {rows.map((s) => (
        <div key={s.id} className="mb-2 rounded-lg bg-slate-50 p-2 text-sm">
          <div className="mb-1 flex justify-between font-semibold text-slate-800">
            <span>{s.businessDay}</span>
            <span
              className={
                s.differenceKurus === 0
                  ? 'text-slate-500'
                  : s.differenceKurus < 0
                    ? 'text-red-600'
                    : 'text-green-600'
              }
            >
              Fark: {formatKurus(s.differenceKurus)}
            </span>
          </div>
          <Line label="Açılış kasası" value={formatKurus(s.openingFloatKurus)} />
          <Line label="Beklenen" value={formatKurus(s.expectedKurus)} />
          <Line label="Sayılan" value={formatKurus(s.countedKurus)} />
        </div>
      ))}
    </Card>
  );
}

// --- Veresiye Borç: müşteri bazlı ---
function DebtTab() {
  const q = useQuery({
    queryKey: ['customer-debt'],
    queryFn: () => api<CustomerDebt[]>('/reports/customers/debt'),
  });
  if (q.isLoading) return <p className="text-slate-500">Yükleniyor…</p>;
  if (q.isError) return <p className="text-red-600">Borç raporu alınamadı.</p>;
  const rows = q.data ?? [];
  const total = rows.reduce((s, r) => s + r.balanceKurus, 0);
  if (rows.length === 0) return <p className="text-slate-400">Borçlu müşteri yok.</p>;
  return (
    <Card title={`Veresiye Borçlar (${rows.length})`}>
      {rows.map((c) => (
        <div key={c.customerId} className="flex justify-between border-b py-1.5 last:border-0">
          <span className="text-slate-700">
            {c.customerName}
            {c.phone && <span className="ml-1 text-xs text-slate-400">{c.phone}</span>}
          </span>
          <span className="font-semibold text-red-600">{formatKurus(c.balanceKurus)}</span>
        </div>
      ))}
      <Line label="Toplam borç" value={formatKurus(total)} bold />
    </Card>
  );
}

// --- Kayıt Geçmişi (Denetim): eklenen/silinen/değişen her şey ---
function AuditTab() {
  const [entityType, setEntityType] = useState('');
  const q = useQuery({
    queryKey: ['audit', entityType],
    queryFn: () => api<AuditRow[]>(`/audit${entityType ? `?entityType=${entityType}` : ''}`),
  });
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {['', 'product', 'category', 'unit', 'tax', 'order', 'customer'].map((et) => (
          <button
            key={et || 'all'}
            onClick={() => setEntityType(et)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              entityType === et ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {et === '' ? 'Tümü' : (ENTITY_LABEL[et] ?? et)}
          </button>
        ))}
      </div>
      {q.isLoading && <p className="text-slate-500">Yükleniyor…</p>}
      {q.isError && <p className="text-red-600">Kayıtlar alınamadı.</p>}
      {q.data && q.data.length === 0 && <p className="text-slate-400">Kayıt yok.</p>}
      {q.data && q.data.length > 0 && (
        <Card title={`Kayıt Geçmişi (${q.data.length})`}>
          {q.data.map((row) => {
            const name = entryName(row);
            return (
              <div key={row.id} className="border-b py-1.5 last:border-0">
                <div className="flex justify-between">
                  <span className="text-slate-700">
                    {actionLabel(row)}
                    {name && <span className="ml-1 font-medium text-slate-900">“{name}”</span>}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(row.createdAt).toLocaleString('tr-TR')}
                  </span>
                </div>
                {row.reason && <p className="text-xs text-slate-400">{row.reason}</p>}
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow">
      <h2 className="mb-2 font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  );
}
function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between py-0.5 ${bold ? 'font-bold text-slate-800' : 'text-slate-600'}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
