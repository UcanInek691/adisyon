import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAccess } from './api';

// Olay adi oneki -> tazelenecek sorgu anahtarlari (kismi eslesme: ['order'] -> ['order', id]).
const KEYS: Record<string, string[][]> = {
  order: [['orders'], ['order']],
  payment: [['orders'], ['order']],
  table: [['tables'], ['orders']],
};

/** SSE canli sinyal: olay gelince ilgili react-query sorgularini invalidate eder. */
export function useLiveEvents(): void {
  const qc = useQueryClient();
  useEffect(() => {
    let es: EventSource | null = null;
    let timer: number | undefined;
    const connect = () => {
      const token = getAccess();
      if (!token) return;
      es = new EventSource(`/api/v1/events/stream?token=${encodeURIComponent(token)}`);
      es.onmessage = (e) => {
        // Sunucu duz olay adi yollar; response zarfina sarilirsa data alanini ac.
        let name = String(e.data);
        try {
          const j: unknown = JSON.parse(name);
          if (j && typeof j === 'object') name = String((j as { data?: unknown }).data ?? name);
        } catch {
          /* duz metin */
        }
        const prefix = name.split('.')[0] ?? '';
        for (const key of KEYS[prefix] ?? []) qc.invalidateQueries({ queryKey: key });
      };
      es.onerror = () => {
        // Kopma veya suresi dolmus token: kapat, taze token ile 5 sn sonra yeniden dene.
        es?.close();
        timer = window.setTimeout(connect, 5000);
      };
    };
    connect();
    return () => {
      es?.close();
      window.clearTimeout(timer);
    };
  }, [qc]);
}
