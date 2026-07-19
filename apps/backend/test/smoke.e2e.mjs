// E2E smoke — calisan sunucuya karsi kritik para yollari.
// Kullanim: backend'i ayaga kaldir (npm run dev) + seed, sonra: node test/smoke.e2e.mjs
// Kapsam: merge, split, payment idempotency, reverse (iade), end-of-day, statement CSV.
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = process.env.API_PORT || process.env.PORT || 3001;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
let token = '';
const ok = [];
const bad = [];
function assert(cond, msg) {
  (cond ? ok : bad).push(msg);
  console.log((cond ? '  ✓ ' : '  ✗ ') + msg);
}
const uid = () => 'op-' + Math.random().toString(36).slice(2) + Date.now();

async function call(method, path, body, raw = false) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return { status: res.status, text: await res.text() };
  const json = await res.json().catch(() => ({}));
  if (!res.ok) console.error(`  HTTP ${res.status} ${method} ${path}:`, JSON.stringify(json));
  return { status: res.status, data: json.data ?? json };
}

async function openOrderWithItem(tableId, prodId, qty = 1000) {
  const { data: o } = await call('POST', '/orders', { tableId });
  await call('POST', `/orders/${o.id}/items`, { productId: prodId, quantity: qty });
  const { data: full } = await call('GET', `/orders/${o.id}`);
  return full;
}

(async () => {
  // login
  const { data: login } = await call('POST', '/auth/login', {
    username: 'owner',
    password: 'owner1234',
  });
  token = login.accessToken || login.token || login.access_token;
  assert(!!token, 'login -> token');

  // katalog + salon + masalar (tek sefer)
  const { data: unit } = await call('POST', '/units', { name: 'Adet', abbreviation: 'ad' });
  const { data: cat } = await call('POST', '/categories', { name: 'Yemek ' + Date.now() });
  const { data: tax } = await call('POST', '/taxes', { name: 'KDV10', ratePermille: 100 });
  const { data: prod } = await call('POST', '/products', {
    name: 'Kofte',
    categoryId: cat.id,
    unitId: unit.id,
    taxId: tax.id,
    salePrice: 10000,
  });
  const { data: hall } = await call('POST', '/halls', { name: 'Salon ' + Date.now() });
  const mk = async (n) => (await call('POST', '/tables', { hallId: hall.id, name: n })).data;
  const t1 = await mk('M1'),
    t2 = await mk('M2'),
    t3 = await mk('M3'),
    t4 = await mk('M4');
  assert(!!prod.id && !!t1.id, 'katalog + masalar hazir');

  // --- MERGE: iki adisyon (10000 + 10000) -> 20000, kaynak iptal ---
  const A = await openOrderWithItem(t1.id, prod.id);
  const B = await openOrderWithItem(t2.id, prod.id);
  assert(A.grandTotal === 10000, `A grandTotal=10000 (${A.grandTotal})`);
  const { data: merged } = await call('POST', `/orders/${A.id}/merge`, { sourceOrderId: B.id });
  assert(merged.grandTotal === 20000, `MERGE 20000 (${merged.grandTotal})`);
  assert(merged.items.length === 2, `MERGE 2 kalem (${merged.items.length})`);
  const { data: Bx } = await call('GET', `/orders/${B.id}`);
  assert(Bx.status === 'cancelled', `MERGE kaynak iptal (${Bx.status})`);

  // --- SPLIT: A'dan bir kalem t2'ye -> yeni 10000, A 10000 ---
  const { data: split } = await call('POST', `/orders/${A.id}/split`, {
    itemIds: [merged.items[0].id],
    targetTableId: t2.id,
  });
  assert(split.created.grandTotal === 10000, `SPLIT yeni 10000 (${split.created?.grandTotal})`);
  assert(split.source.grandTotal === 10000, `SPLIT kaynak 10000 (${split.source?.grandTotal})`);
  assert(split.created.parentOrderId === A.id, 'SPLIT parentOrderId=A');
  const bothIds = split.source.items.map((i) => i.id);
  const { status: splitAllStatus } = await call('POST', `/orders/${A.id}/split`, {
    itemIds: bothIds,
  });
  assert(splitAllStatus === 400, `SPLIT tum kalemler reddedildi (${splitAllStatus})`);

  // --- PAYMENT idempotency + REVERSE --- (record -> order-with-payments doner)
  const C = await openOrderWithItem(t3.id, prod.id);
  const idem = uid();
  const body = { method: 'cash', amount: C.grandTotal, idempotencyKey: idem };
  const { data: pay1 } = await call('POST', `/orders/${C.id}/payments`, body);
  const payId = (pay1.payments || []).find((p) => p.amount > 0)?.id || pay1.payments?.[0]?.id;
  assert(!!payId, 'PAY kaydedildi (payments[].id)');
  assert(pay1.status === 'completed', `PAY -> completed (${pay1.status})`);
  // ayni idempotencyKey -> ikinci cagri yeni odeme yaratmamali
  const { data: pay2 } = await call('POST', `/orders/${C.id}/payments`, body);
  const active = (pay2.payments || []).filter((p) => !p.deletedAt);
  assert(active.length === 1, `IDEMPOTENCY: tek odeme (${active.length})`);

  const { status: revStatus, data: rev } = await call(
    'POST',
    `/orders/${C.id}/payments/${payId}/reverse`,
    { reason: 'test iade', idempotencyKey: uid() },
  );
  assert(revStatus < 400, `REVERSE 2xx (${revStatus})`);
  assert(
    rev.status === 'refunded' || rev.status === 'open',
    `REVERSE -> refunded/open (${rev.status})`,
  );

  // --- END-OF-DAY ---
  const today = new Date().toISOString().slice(0, 10);
  const { data: eod } = await call('GET', `/reports/end-of-day?date=${today}`);
  assert(!!eod.sales && Array.isArray(eod.payments) && !!eod.cash, 'END-OF-DAY yapisi');

  // --- STATEMENT CSV ---
  const { data: cust } = await call('POST', '/customers', { name: 'Ahmet Veresiye' });
  await call('POST', `/customers/${cust.id}/debt`, { amount: 5000, note: 'Test' });
  const stmt = await call('GET', `/customers/${cust.id}/statement.csv`, null, true);
  assert(stmt.status === 200 && stmt.text.includes('Bakiye'), `STATEMENT CSV 200 (${stmt.status})`);
  assert(stmt.text.includes('50.00'), 'STATEMENT 5000kr -> 50.00 TL');

  // --- USERS: olustur/listele/pasiflestir/sil + kendi hesabini silme korumasi ---
  const uname = 'garson' + Date.now();
  const { data: nu } = await call('POST', '/users', {
    username: uname,
    displayName: 'Test Garson',
    role: 'waiter',
    pin: '1234',
  });
  assert(!!nu.id, 'USER create (waiter)');
  const { data: ulist } = await call('GET', '/users');
  assert(
    ulist.some((u) => u.id === nu.id),
    'USER listede',
  );
  const { status: deact } = await call('PATCH', `/users/${nu.id}`, { isActive: false });
  assert(deact < 400, `USER pasiflestir (${deact})`);
  const self = ulist.find((u) => u.username === 'owner');
  const { status: selfDel } = await call('DELETE', `/users/${self.id}`);
  assert(selfDel === 403, `USER self-delete 403 (${selfDel})`);
  const { status: udel } = await call('DELETE', `/users/${nu.id}`);
  assert(udel < 400, `USER sil (${udel})`);

  // --- CLOUD YEDEK: cloudDir doluysa sifreli dosya kopyalanir, bossa kopya yok ---
  const cloudDir = join(tmpdir(), 'ado-cloud-' + Date.now());
  await call('PUT', '/settings/' + encodeURIComponent('backup.cloudDir'), { value: cloudDir });
  const { data: bk } = await call('POST', '/backups');
  assert(bk.cloudCopied === true, `cloud yedek kopyalandi (${bk.cloudCopied})`);
  assert(readdirSync(cloudDir).length === 1, 'cloud klasorunde 1 dosya var');
  await call('PUT', '/settings/' + encodeURIComponent('backup.cloudDir'), { value: '' });
  const { data: bk2 } = await call('POST', '/backups');
  assert(bk2.cloudCopied === false, `cloudDir bos -> kopya yok (${bk2.cloudCopied})`);

  // --- SSE: canli sinyal akisi (200 + order.* olayi + tokensiz 401) ---
  const sse = await fetch(`${BASE}/events/stream?token=${encodeURIComponent(token)}`, {
    headers: { Accept: 'text/event-stream' },
  });
  assert(sse.status === 200, `SSE baglanti 200 (${sse.status})`);
  assert((sse.headers.get('content-type') || '').includes('text/event-stream'), 'SSE content-type');
  const reader = sse.body.getReader();
  const firstEvent = (async () => {
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return buf;
      buf += dec.decode(value, { stream: true });
      if (buf.includes('order.')) return buf;
    }
  })();
  const t5 = await mk('M5');
  await call('POST', '/orders', { tableId: t5.id }); // order.* olayi tetikler
  const msg = await Promise.race([firstEvent, new Promise((r) => setTimeout(() => r(''), 5000))]);
  assert(msg.includes('order.'), `SSE order.* olayi alindi (${JSON.stringify(msg.slice(0, 80))})`);
  await reader.cancel().catch(() => {});
  const noTok = await fetch(`${BASE}/events/stream`);
  noTok.body?.cancel?.();
  assert(noTok.status === 401, `SSE tokensiz 401 (${noTok.status})`);

  console.log(`\nE2E SONUC: ${ok.length} gecti, ${bad.length} kaldi`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
