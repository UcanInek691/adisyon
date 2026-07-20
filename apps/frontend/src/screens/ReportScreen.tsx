import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatKurus } from '../lib/format';

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

const METHOD_LABEL: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  qr: 'QR',
  debt: 'Veresiye',
};

const today = () => new Date().toISOString().slice(0, 10);

export default function ReportScreen() {
  const nav = useNavigate();
  const [date, setDate] = useState(today());

  const report = useQuery({
    queryKey: ['eod', date],
    queryFn: () => api<EndOfDay>(`/reports/end-of-day?date=${date}`),
  });
  const r = report.data;

  return (
    <div className="min-h-full bg-slate-100">
      <header className="flex items-center justify-between bg-white px-6 py-3 shadow">
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav('/')}
            className="rounded-lg bg-slate-200 px-3 py-1 font-medium"
          >
            ← Masalar
          </button>
          <h1 className="text-xl font-bold text-slate-800">Gün Sonu (Z)</h1>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-6">
        {report.isLoading && <p className="text-slate-500">Yükleniyor…</p>}
        {report.isError && <p className="text-red-600">Rapor alınamadı.</p>}
        {r && (
          <>
            <p className="text-sm text-slate-500">İş günü: {r.businessDay}</p>

            <Card title="Satış">
              <Line label={`Fiş sayısı`} value={String(r.sales.count)} />
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
      </main>
    </div>
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
