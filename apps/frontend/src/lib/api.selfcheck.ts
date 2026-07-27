import assert from 'node:assert/strict';
import { unwrapEnvelope } from './api.ts';

// Regresyon: data=null iken zarfin kendisi donerse (eski `?? ` davranisi)
// "acik kasa oturumu yok" ekranlari beyaz ekrana duser.
assert.equal(unwrapEnvelope({ success: true, data: null }), null);
assert.deepEqual(unwrapEnvelope({ success: true, data: { a: 1 } }), { a: 1 });
assert.deepEqual(unwrapEnvelope({ success: true, data: [] }), []);
// Zarfsiz yanit aynen gecer.
assert.deepEqual(unwrapEnvelope({ a: 1 }), { a: 1 });
assert.deepEqual(unwrapEnvelope({}), {});

console.log('api self-check OK');
