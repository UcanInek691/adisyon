import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, hasPerm } from '../lib/api';
import type { AppSetting, Backup } from '../lib/types';

// Girilen metni JSON olarak dene; olmazsa duz metin olarak kaydet.
const parseValue = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};
const showValue = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('tr-TR');
const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

const BACKUP_TYPE_LABELS: Record<string, string> = {
  auto: 'Otomatik',
  manual: 'Elle',
  pre_update: 'Güncelleme Öncesi',
};

export default function AyarlarScreen() {
  const nav = useNavigate();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const fail = (e: unknown) => {
    setInfo('');
    setError(e instanceof ApiError ? e.message : 'İşlem başarısız.');
  };

  return (
    <div className="flex h-full flex-col bg-slate-100">
      <header className="flex items-center gap-3 bg-white px-6 py-3 shadow">
        <button onClick={() => nav('/')} className="rounded-lg bg-slate-200 px-3 py-1 font-medium">
          ← Masalar
        </button>
        <h1 className="text-lg font-bold text-slate-800">Ayarlar</h1>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 space-y-4 overflow-auto p-4">
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
        {info && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{info}</p>}

        {hasPerm('settings.manage') && <SettingsCard onError={fail} />}
        {hasPerm('backup.manage') && (
          <BackupCard
            onError={fail}
            onInfo={(m) => {
              setError('');
              setInfo(m);
            }}
          />
        )}
      </div>
    </div>
  );
}

function SettingsCard({ onError }: { onError: (e: unknown) => void }) {
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  // Duzenlenen satirlar: key -> taslak metin
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<AppSetting[]>('/settings'),
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api(`/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: { value } }),
    onSuccess: (_d, { key }) => {
      setDrafts(({ [key]: _gone, ...rest }) => rest);
      setNewKey('');
      setNewValue('');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError,
  });

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <h2 className="mb-2 font-bold text-slate-800">Uygulama Ayarları</h2>
      {settings.isLoading && <p className="text-sm text-slate-400">Yükleniyor…</p>}
      <ul className="divide-y">
        {(settings.data ?? []).map((s) => {
          const draft = drafts[s.key];
          const editing = draft !== undefined;
          return (
            <li key={s.key} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-600">{s.key}</span>
              {editing ? (
                <>
                  <input
                    value={draft}
                    onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}
                    className="w-32 rounded-lg border border-slate-300 px-2 py-1"
                  />
                  <button
                    onClick={() => save.mutate({ key: s.key, value: parseValue(draft) })}
                    disabled={save.isPending}
                    className="rounded-lg bg-green-600 px-2 py-1 font-medium text-white disabled:opacity-40"
                  >
                    Kaydet
                  </button>
                  <button
                    onClick={() => setDrafts(({ [s.key]: _gone, ...rest }) => rest)}
                    className="rounded-lg bg-slate-200 px-2 py-1 font-medium"
                  >
                    Vazgeç
                  </button>
                </>
              ) : (
                <>
                  <span className="max-w-32 truncate text-slate-500">{showValue(s.value)}</span>
                  <button
                    onClick={() => setDrafts({ ...drafts, [s.key]: showValue(s.value) })}
                    className="rounded-lg bg-slate-200 px-2 py-1 font-medium"
                  >
                    Düzenle
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex gap-2">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Anahtar"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Değer"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          onClick={() => save.mutate({ key: newKey.trim(), value: parseValue(newValue) })}
          disabled={save.isPending || newKey.trim() === ''}
          className="rounded-lg bg-slate-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-40"
        >
          Ekle
        </button>
      </div>
    </div>
  );
}

function BackupCard({
  onError,
  onInfo,
}: {
  onError: (e: unknown) => void;
  onInfo: (m: string) => void;
}) {
  const qc = useQueryClient();

  const backups = useQuery({
    queryKey: ['backups'],
    queryFn: () => api<Backup[]>('/backups'),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['backups'] });

  const create = useMutation({
    mutationFn: () => api('/backups', { method: 'POST' }),
    onSuccess: () => {
      onInfo('Yedek alındı.');
      refresh();
    },
    onError,
  });
  const restore = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/backups/${id}/restore`, { method: 'POST' }),
    onSuccess: (r) => onInfo(r.message),
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/backups/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError,
  });

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold text-slate-800">Yedekler</h2>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="rounded-lg bg-slate-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-40"
        >
          {create.isPending ? 'Alınıyor…' : 'Yedek Al'}
        </button>
      </div>
      {backups.isLoading && <p className="text-sm text-slate-400">Yükleniyor…</p>}
      {backups.data?.length === 0 && <p className="text-sm text-slate-400">Henüz yedek yok.</p>}
      <ul className="divide-y">
        {(backups.data ?? []).map((b) => (
          <li key={b.id} className="flex items-center gap-2 py-2 text-sm">
            <span className="min-w-0 flex-1 text-slate-600">
              {fmtDateTime(b.createdAt)}
              <span className="text-slate-400">
                {' '}
                · {BACKUP_TYPE_LABELS[b.type] ?? b.type} · {fmtSize(b.sizeBytes)}
              </span>
            </span>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'Bu yedek geri yüklensin mi? Uygulanması için yeniden başlatma gerekir.',
                  )
                )
                  restore.mutate(b.id);
              }}
              disabled={restore.isPending}
              className="rounded-lg bg-amber-500 px-2 py-1 font-medium text-white disabled:opacity-40"
            >
              Geri Yükle
            </button>
            <button
              onClick={() => {
                if (window.confirm('Bu yedek silinsin mi?')) remove.mutate(b.id);
              }}
              disabled={remove.isPending}
              className="rounded-lg bg-red-600 px-2 py-1 font-medium text-white disabled:opacity-40"
            >
              Sil
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
