// Saf sync-core mantiginin runnable self-check'i (CONVENTIONS.md §7 kritik modul kapisi).
// Calistir: node --experimental-strip-types src/offline/sync-core.selfcheck.ts
import assert from 'node:assert';
import { buildOpenTable, buildAddLine, buildSubmit, applyResults } from './sync-core.ts';

const { draft } = buildOpenTable({ orderId: 'local:1', clientOpId: 'op1' }, 't1', 'A1');
const add = buildAddLine(draft, 'op2', { id: 'p1', name: 'Cay', salePrice: 1500 });
assert.equal(add.draft.grandTotal, 1500);
assert.equal(add.entry.payload.orderClientOpId, 'op1');

const two = buildAddLine(add.draft, 'op3', { id: 'p1', name: 'Cay', salePrice: 1500 }, 2000);
assert.equal(two.draft.grandTotal, 1500 + 3000);

const sub = buildSubmit(two.draft, 'op4');
assert.ok(sub.draft.items.every((i) => i.status === 'sent'));

const oc = applyResults([
  { clientOpId: 'op1', status: 'applied', serverId: 'S1' },
  { clientOpId: 'op2', status: 'duplicate', serverId: 'I2' },
  { clientOpId: 'op3', status: 'conflict', reviewId: 'R1', reason: 'TABLE_CLOSED' },
  { clientOpId: 'op4', status: 'rejected', reason: 'PRODUCT_INACTIVE' },
]);
assert.deepEqual([...oc.remove].sort(), ['op1', 'op2', 'op3', 'op4']);
assert.equal(oc.serverIdByOpId.op1, 'S1');
assert.equal(oc.conflicts.length, 1);
assert.equal(oc.rejections.length, 1);

console.log('sync-core self-check OK');
