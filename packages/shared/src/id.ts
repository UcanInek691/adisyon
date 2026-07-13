/**
 * Global benzersiz kimlik uretimi.
 *
 * ULID kullanilir (auto-increment DEGIL): sirali (zaman siralamasi korunur),
 * offline uretilebilir, cakismasiz. SYSTEM_ANALYSIS.md §6 / DATABASE_DESIGN.md §0.
 */
import { ulid } from 'ulid';

/** Yeni ULID uret. */
export function newId(): string {
  return ulid();
}

/** Idempotency anahtari da ULID formatindadir. */
export function newIdempotencyKey(): string {
  return ulid();
}
