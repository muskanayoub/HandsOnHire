'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['i18n.js', 'i18n-ks.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8'), ctx);
}
const I = ctx.window.I18N;

test('every language has exactly the same keys as English', () => {
  const en = Object.keys(I.en).sort();
  for (const lang of ['hi', 'ur', 'ks']) {
    const keys = Object.keys(I[lang]).sort();
    assert.deepEqual(en.filter((k) => !keys.includes(k)), [], lang + ' is missing keys');
    assert.deepEqual(keys.filter((k) => !en.includes(k)), [], lang + ' has extra keys');
  }
});

test('placeholders match across languages', () => {
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const k of Object.keys(I.en)) {
    for (const lang of ['hi', 'ur', 'ks']) assert.equal(ph(I[lang][k]), ph(I.en[k]), `${lang}.${k}`);
  }
});
