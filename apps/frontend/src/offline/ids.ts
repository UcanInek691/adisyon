import { monotonicFactory } from 'ulid';

// Monotonic ULID: ayni ms icinde bile artan -> outbox FIFO sirasi bozulmaz. OFFLINE_DESIGN.md §6
export const ulid = monotonicFactory();
