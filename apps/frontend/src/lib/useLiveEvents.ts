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
    let stopped = false;
    let abort: AbortController | undefined;
    let timer: number | undefined;
    const handle = (raw: string) => {
      let name = raw;
      try {
        const json: unknown = JSON.parse(name);
        if (json && typeof json === 'object') {
          name = String((json as { data?: unknown }).data ?? name);
        }
      } catch {
        // duz metin
      }
      const prefix = name.split('.')[0] ?? '';
      for (const key of KEYS[prefix] ?? []) qc.invalidateQueries({ queryKey: key });
    };
    const connect = async () => {
      const token = getAccess();
      if (!token) return;
      abort = new AbortController();
      try {
        const response = await fetch('/api/v1/events/stream', {
          headers: { Authorization: `Bearer ${token}` },
          signal: abort.signal,
        });
        if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const data = frame
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n');
            if (data) handle(data);
          }
        }
      } catch {
        // Yeniden baglanma asagida.
      }
      if (!stopped) timer = window.setTimeout(() => void connect(), 5000);
    };
    void connect();
    return () => {
      stopped = true;
      abort?.abort();
      window.clearTimeout(timer);
    };
  }, [qc]);
}
