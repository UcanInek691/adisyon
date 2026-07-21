// KasaScreen panel kararinin runnable self-check'i (kapanis akisi bug'i).
// Calistir: node --experimental-strip-types src/screens/KasaScreen.selfcheck.ts
import assert from 'node:assert';
import { pickKasaPanel } from './kasa-panel.ts';

// Acik oturum: veri var, hata yok -> aktif panel.
assert.equal(pickKasaPanel({ isError: false, hasData: true }), 'active');

// Kapanistan sonra: 404 gelir AMA react-query eski session.data'yi tutar.
// 404 bayat veriyi EZMELI -> acilis formu (bug: 'active' donerdi).
assert.equal(pickKasaPanel({ isError: true, errorStatus: 404, hasData: true }), 'open');

// Hic oturum yok, veri de yok -> acilis formu.
assert.equal(pickKasaPanel({ isError: true, errorStatus: 404, hasData: false }), 'open');

// 404 disi hata (or. ag/500), elde bayat veri varsa aktif kalir.
assert.equal(pickKasaPanel({ isError: true, errorStatus: 500, hasData: true }), 'active');

// Ilk yukleme: veri yok, hata yok -> hicbir panel (loading gosterilir).
assert.equal(pickKasaPanel({ isError: false, hasData: false }), null);

console.log('KasaScreen.selfcheck OK');
