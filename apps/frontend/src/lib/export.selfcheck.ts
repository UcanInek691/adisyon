// CSV üretiminin runnable self-check'i (ayraç/tırnak kaçışı — parser yolu).
// Çalıştır: node --experimental-strip-types src/lib/export.selfcheck.ts
import assert from 'node:assert';
import { toCsv } from './export.ts';

const BOM = '﻿';

// Basit satır: BOM + başlık + veri, ';' ayraç, CRLF.
assert.equal(toCsv(['Ad', 'Tutar'], [['Çay', 1500]]), `${BOM}Ad;Tutar\r\nÇay;1500`);

// Ayraç içeren hücre tırnaklanır.
assert.equal(toCsv(['x'], [['a;b']]), `${BOM}x\r\n"a;b"`);

// Tırnak ikiye katlanır ve alan tırnaklanır.
assert.equal(toCsv(['x'], [['de"mo']]), `${BOM}x\r\n"de""mo"`);

// null -> boş hücre.
assert.equal(toCsv(['x', 'y'], [[null, 'z']]), `${BOM}x;y\r\n;z`);

// Yeni satır içeren hücre tırnaklanır (satır bölünmez).
assert.equal(toCsv(['x'], [['a\nb']]), `${BOM}x\r\n"a\nb"`);

console.log('export.selfcheck OK');
