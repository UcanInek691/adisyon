import { Component, type ReactNode } from 'react';

// Render hatasi tum uygulamayi beyazlatmasin: hatayi yakala, kasiyerin
// anlayacagi bir ekran + yenile butonu goster. React'te hata sinirlari yalnizca
// sinif bilesenleriyle kurulabilir (hook karsiligi yok).
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
        <h1 className="text-xl font-bold text-slate-800">Bir şeyler ters gitti</h1>
        <p className="max-w-md text-sm text-slate-500">
          Ekran yüklenirken beklenmeyen bir hata oluştu. Verileriniz etkilenmedi.
        </p>
        <code className="max-w-md break-all rounded-lg bg-white p-2 text-xs text-red-600 shadow">
          {error.message}
        </code>
        <div className="flex gap-2">
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-lg bg-slate-200 px-4 py-2 font-semibold"
          >
            Tekrar dene
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
          >
            Uygulamayı yenile
          </button>
        </div>
      </div>
    );
  }
}
