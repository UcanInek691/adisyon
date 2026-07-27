import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import ErrorBoundary from './ErrorBoundary';

// Kimlik doğrulanmış ekranların ortak kabuğu: kalıcı sol nav + içerik alanı.
// Ekranlar kendi başlıklarını içerik alanında render eder.
// ErrorBoundary yalnız içerik alanını sarar: bir ekran çökse de sol menü ayakta
// kalır, kullanıcı başka ekrana geçebilir. key=path -> rota değişince sıfırlanır.
export default function AppLayout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return (
    <div className="flex h-full">
      <AppSidebar />
      {/* Yazdirmada overflow-auto icerigi tek sayfaya kirpar -> print'te serbest. */}
      <div className="min-w-0 flex-1 overflow-auto print:overflow-visible">
        <ErrorBoundary key={loc.pathname}>{children}</ErrorBoundary>
      </div>
    </div>
  );
}
