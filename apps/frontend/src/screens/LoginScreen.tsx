import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, login, loginPin, ApiError } from '../lib/api';

type Mode = 'owner' | 'waiter';

export default function LoginScreen() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const setup = useQuery({
    queryKey: ['auth', 'setup-status'],
    queryFn: () => api<{ required: boolean }>('/auth/setup-status'),
  });
  const [mode, setMode] = useState<Mode>('owner');
  const [username, setUsername] = useState('owner');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'owner') await login(username, secret);
      else await loginPin(username, secret);
      nav('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Giriş başarısız.');
    } finally {
      setBusy(false);
    }
  }

  if (setup.data?.required) {
    return (
      <SetupForm onDone={() => qc.invalidateQueries({ queryKey: ['auth', 'setup-status'] })} />
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">Adisyon POS</h1>

        <div className="mb-6 flex rounded-lg bg-slate-100 p-1">
          {(['owner', 'waiter'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setUsername(m === 'owner' ? 'owner' : 'garson');
                setSecret('');
              }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold ${
                mode === m ? 'bg-white text-slate-900 shadow' : 'text-slate-500'
              }`}
            >
              {m === 'owner' ? 'Yönetici' : 'Garson'}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-600">Kullanıcı</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-3 text-lg"
          autoCapitalize="none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-600">
          {mode === 'owner' ? 'Şifre' : 'PIN'}
        </label>
        <input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          type="password"
          inputMode={mode === 'waiter' ? 'numeric' : 'text'}
          className="mb-6 w-full rounded-lg border border-slate-300 px-3 py-3 text-lg"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || !secret}
          className="w-full rounded-lg bg-blue-600 py-3 text-lg font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Giriş yapılıyor…' : 'Giriş'}
        </button>
      </form>
    </div>
  );
}

// Ilk kurulum: sistemde hic kullanici yok -> owner (+istege bagli garson PIN) belirle.
function SetupForm({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('owner');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const valid =
    username.trim().length >= 3 && pw.length >= 6 && pw === pw2 && (pin === '' || pin.length >= 3);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/setup', {
        method: 'POST',
        body: {
          ownerUsername: username.trim(),
          ownerPassword: pw,
          ...(pin ? { waiterPin: pin } : {}),
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kurulum başarısız.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-bold text-slate-800">İlk Kurulum</h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          Yönetici hesabınızı oluşturun. Garson PIN'i isteğe bağlıdır.
        </p>

        <label className="mb-1 block text-sm font-medium text-slate-600">Yönetici Kullanıcı</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-3 text-lg"
          autoCapitalize="none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-600">Şifre (en az 6)</label>
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          type="password"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-3 text-lg"
        />

        <label className="mb-1 block text-sm font-medium text-slate-600">Şifre (tekrar)</label>
        <input
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          type="password"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-3 text-lg"
        />
        {pw2 !== '' && pw !== pw2 && (
          <p className="-mt-2 mb-3 text-sm text-red-600">Şifreler eşleşmiyor.</p>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-600">
          Garson PIN (isteğe bağlı, en az 3)
        </label>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode="numeric"
          className="mb-6 w-full rounded-lg border border-slate-300 px-3 py-3 text-lg"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || !valid}
          className="w-full rounded-lg bg-blue-600 py-3 text-lg font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Kuruluyor…' : 'Kurulumu Tamamla'}
        </button>
      </form>
    </div>
  );
}
