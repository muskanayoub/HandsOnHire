'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

process.env.HOH_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hoh-test-'));
process.env.OTP_MODE = 'demo';
const { start, server } = require('../server');

let base;
test.before(async () => {
  await start(0, '127.0.0.1');
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => {
  server.closeAllConnections();
  server.close();
});

async function call(method, url, body, token, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function otpLogin(phone, purpose) {
  const r = await call('POST', '/api/otp/request', { phone, purpose });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const v = await call('POST', '/api/otp/verify', { phone, purpose, code: r.body.demoOtp });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return v.body.token;
}

test('public list never exposes full phone numbers', async () => {
  const r = await call('GET', '/api/workers');
  assert.equal(r.status, 200);
  assert.ok(r.body.workers.length >= 60);
  for (const w of r.body.workers) {
    assert.equal(w.phone, undefined);
    assert.match(w.maskedPhone, /^\d{2}••••••\d{2}$/);
  }
});

test('filters and multilingual search work', async () => {
  const r = await call('GET', '/api/workers?trade=picker&available=1');
  assert.ok(r.body.workers.length > 0);
  assert.ok(r.body.workers.every((w) => w.trade === 'picker' && w.availableToday));
  const s = await call('GET', '/api/workers?q=' + encodeURIComponent('राजमिस्त्री'));
  assert.ok(s.body.workers.length > 0);
  assert.ok(s.body.workers.every((w) => w.trade === 'mason'));
});

test('reveal requires employer OTP', async () => {
  assert.equal((await call('POST', '/api/workers/s1/reveal')).status, 401);
  const token = await otpLogin('9111111111', 'employer');
  const ok = await call('POST', '/api/workers/s1/reveal', null, token);
  assert.equal(ok.status, 200);
  assert.match(ok.body.phone, /^\d{10}$/);
});

test('wrong OTP is rejected and locks after too many tries', async () => {
  const phone = '9222222222';
  await call('POST', '/api/otp/request', { phone, purpose: 'employer' });
  let last;
  for (let i = 0; i < 6; i++) last = await call('POST', '/api/otp/verify', { phone, purpose: 'employer', code: '000000' });
  assert.equal(last.status, 400);
  assert.equal(last.body.error, 'too_many_attempts');
});

test('OTP resend cooldown', async () => {
  const phone = '9333333333';
  assert.equal((await call('POST', '/api/otp/request', { phone, purpose: 'employer' })).status, 200);
  const again = await call('POST', '/api/otp/request', { phone, purpose: 'employer' });
  assert.equal(again.status, 429);
  assert.equal(again.body.error, 'cooldown');
});

test('invalid phone numbers are rejected', async () => {
  for (const phone of ['12345', '5876543210', 'abcdefghij', '']) {
    const r = await call('POST', '/api/otp/request', { phone, purpose: 'employer' });
    assert.equal(r.status, 400);
  }
});

test('full worker lifecycle: register, rate, manage, report, delete', async () => {
  const phone = '9444444444';
  const proof = await otpLogin(phone, 'register');
  const bad = await call('POST', '/api/workers', { otpToken: proof, name: 'Test 12345', trade: 'mason', district: 'budgam', village: 'Khag', rate: 700, languages: ['Hindi'], consent: true });
  assert.equal(bad.status, 400);
  const created = await call('POST', '/api/workers', { otpToken: proof, name: 'Test Worker', trade: 'mason', district: 'budgam', village: 'Khag', rate: 700, experience: 5, languages: ['Hindi', 'Urdu'], consent: true });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const id = created.body.worker.id;
  assert.equal(created.body.worker.availableToday, true);

  assert.equal((await call('POST', '/api/otp/request', { phone, purpose: 'register' })).status, 409);

  const emp = await otpLogin('9555555555', 'employer');
  assert.equal((await call('POST', `/api/workers/${id}/rate`, { stars: 5 }, emp)).status, 403);
  await call('POST', `/api/workers/${id}/reveal`, null, emp);
  const rated = await call('POST', `/api/workers/${id}/rate`, { stars: 4, comment: 'Good work' }, emp);
  assert.equal(rated.body.rating, 4);

  const wt = await otpLogin(phone, 'manage');
  const me = await call('GET', '/api/me', null, wt);
  assert.equal(me.body.contacts.length, 1);
  assert.match(me.body.contacts[0].employerMask, /^95••••••55$/);
  const busy = await call('PATCH', '/api/me', { availableToday: false }, wt);
  assert.equal(busy.body.worker.availableToday, false);

  for (const p of ['9666666661', '9666666662', '9666666663']) {
    const t = await otpLogin(p, 'employer');
    assert.equal((await call('POST', `/api/workers/${id}/report`, { reason: 'unsafe' }, t)).status, 200);
  }
  const list = await call('GET', '/api/workers?q=Test%20Worker');
  assert.equal(list.body.workers.length, 0);

  assert.equal((await call('DELETE', '/api/me', null, wt)).status, 200);
});

test('two workers reporting an employer blocks them', async () => {
  const emp = await otpLogin('9777777777', 'employer');
  const tokens = [];
  for (const [i, phone] of ['9888888881', '9888888882'].entries()) {
    const proof = await otpLogin(phone, 'register');
    const c = await call('POST', '/api/workers', { otpToken: proof, name: 'Worker ' + 'AB'[i], trade: 'farm', district: 'pulwama', village: 'Tral', rate: 500, languages: ['Urdu'], consent: true });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    await call('POST', `/api/workers/${c.body.worker.id}/reveal`, null, emp);
    tokens.push(await otpLogin(phone, 'manage'));
  }
  for (const t of tokens) {
    const me = await call('GET', '/api/me', null, t);
    assert.equal((await call('POST', '/api/me/report-contact', { contactId: me.body.contacts[0].id, reason: 'harassment' }, t)).status, 200);
  }
  const blocked = await call('POST', '/api/workers/s2/reveal', null, emp);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error, 'blocked');
});

test('admin endpoints need the key', async () => {
  assert.equal((await call('POST', '/api/admin/workers/s1/verify', { verified: true })).status, 403);
  const ok = await call('POST', '/api/admin/workers/s1/verify', { verified: true }, null, { 'x-admin-key': 'demo-admin-key' });
  assert.equal(ok.status, 200);
});

test('static files, traversal and security headers', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('content-security-policy'));
  const trav = await fetch(base + '/..%2fserver.js');
  assert.notEqual(trav.status, 200);
});

test('tampered tokens are rejected', async () => {
  const t = await otpLogin('9999999991', 'employer');
  const [body, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ role: 'employer', sub: '9000000000', exp: 9999999999 })).toString('base64url') + '.' + sig;
  assert.equal((await call('POST', '/api/workers/s1/reveal', null, forged)).status, 401);
  assert.equal((await call('POST', '/api/workers/s1/reveal', null, body + '.x')).status, 401);
});

test('Kashmiri trade names are searchable', async () => {
  const meta = await call('GET', '/api/meta');
  assert.ok(meta.body.trades.every((t) => t.ks), 'every trade has a Kashmiri label');
  const r = await call('GET', '/api/workers?q=' + encodeURIComponent('بجلی مستری'));
  assert.ok(r.body.workers.length > 0);
});
