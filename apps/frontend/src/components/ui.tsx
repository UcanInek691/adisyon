import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Paylaşılan UI primitifleri — tutarlı görünüm + tablet dokunma hedefleri.
// Ekranlar bunları kullanır; her ekranın kendi buton/kart stilini yazması biter.

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink-900 text-white hover:bg-ink-800',
  secondary: 'border border-stone-200 bg-white text-ink-800 hover:bg-stone-50',
  success: 'bg-brand-600 text-white hover:bg-brand-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'bg-transparent text-stone-600 hover:bg-stone-100',
};

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/80 bg-white p-4 shadow-panel ${className}`}
    >
      {children}
    </div>
  );
}
