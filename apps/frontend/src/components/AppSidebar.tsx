import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, clearSession, hasPerm } from '../lib/api';
import type { OfflineReview } from '../lib/types';

// Kalıcı sol ikon navigasyon çubuğu. İzin bazlı; aktif rota vurgulanır.
// Buton duvarını (eski üst şerit) tek noktadan yönetilen menüyle değiştirir.

interface NavItem {
  icon: string;
  label: string;
  path: string;
  perm?: string;
}

// perm yoksa herkese görünür (Masalar). Diğerleri hasPerm ile süzülür.
const ITEMS: NavItem[] = [
  { icon: '🏠', label: 'Masalar', path: '/' },
  { icon: '💵', label: 'Kasa', path: '/cash', perm: 'cash.manage' },
  { icon: '📒', label: 'Veresiye', path: '/customers', perm: 'debt.manage' },
  { icon: '💰', label: 'Gelir/Gider', path: '/finance', perm: 'finance.manage' },
  { icon: '📦', label: 'Ürünler', path: '/menu', perm: 'product.manage' },
  { icon: '🍽️', label: 'Masa Düzeni', path: '/tables-admin', perm: 'table.manage' },
  { icon: '📊', label: 'Raporlar', path: '/report', perm: 'report.view' },
  { icon: '👥', label: 'Kullanıcılar', path: '/users', perm: 'user.manage' },
  { icon: '⚙️', label: 'Ayarlar', path: '/settings', perm: 'settings.manage' },
];

export default function AppSidebar() {
  const nav = useNavigate();
  const loc = useLocation();

  const reviewCount = useQuery({
    queryKey: ['offline-reviews', 'count'],
    queryFn: async () => (await api<OfflineReview[]>('/offline-reviews')).length,
    refetchInterval: 20_000,
    enabled: hasPerm('order.cancel'),
  });

  const items = ITEMS.filter(
    (it) => !it.perm || hasPerm(it.perm) || (it.path === '/settings' && hasPerm('backup.manage')),
  );
  const active = (path: string) =>
    path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(path);

  return (
    <nav className="flex w-20 shrink-0 flex-col items-center gap-1 overflow-y-auto bg-slate-900 py-3 print:hidden">
      {items.map((it) => (
        <SideButton
          key={it.path}
          icon={it.icon}
          label={it.label}
          active={active(it.path)}
          onClick={() => nav(it.path)}
        />
      ))}
      {hasPerm('order.cancel') && (reviewCount.data ?? 0) > 0 && (
        <SideButton
          icon="⚠️"
          label={`Onay (${reviewCount.data})`}
          active={active('/offline-reviews')}
          onClick={() => nav('/offline-reviews')}
          highlight
        />
      )}
      <SideButton
        icon="🚪"
        label="Çıkış"
        onClick={() => {
          clearSession();
          nav('/login', { replace: true });
        }}
        className="mt-auto"
      />
    </nav>
  );
}

function SideButton({
  icon,
  label,
  active,
  highlight,
  onClick,
  className = '',
}: {
  icon: string;
  label: string;
  active?: boolean;
  highlight?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-16 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium leading-tight transition ${
        active
          ? 'bg-blue-600 text-white'
          : highlight
            ? 'bg-orange-500/90 text-white'
            : 'text-slate-300 hover:bg-slate-800'
      } ${className}`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="w-full truncate text-center">{label}</span>
    </button>
  );
}
