import type { ReactNode } from 'react';
import AppSidebar from './AppSidebar';

// Kimlik doğrulanmış ekranların ortak kabuğu: kalıcı sol nav + içerik alanı.
// Ekranlar kendi başlıklarını içerik alanında render eder.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full">
      <AppSidebar />
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
