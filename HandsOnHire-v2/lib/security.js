'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./store');

// ---------- signing secret ----------
function getSecret() {
  if (process.env.HOH_SECRET) return process.env.HOH_SECRET;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const f = path.join(DATA_DIR, '.secret');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
const SECRET = getSecret();

// ---------- signed tokens (HMAC-SHA256, stateless) ----------
function signToken(payload, ttlSec) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}

function verifyToken(token, role) {
  if (typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
  if (!p.exp || p.exp < Date.now() / 1000) return null;
  if (role && p.role !== role) return null;
  return p;
}

const hashPhone = (phone) => crypto.createHmac('sha256', SECRET).update(String(phone)).digest('hex').slice(0, 16);

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- phone helpers ----------
/** Accepts 9876543210, 09876543210, +91 98765 43210. Returns a 10-digit string or null. */
function normPhone(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  let d = String(input).replace(/[\s\-()]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  else if (d.startsWith('0091')) d = d.slice(4);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

const maskPhone = (p) => p.slice(0, 2) + '••••••' + p.slice(-2);

// ---------- sliding-window rate limiter ----------
const buckets = new Map();
function hit(key, limit, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of buckets) {
    if (!arr.length || now - arr[arr.length - 1] > 3600e3) buckets.delete(k);
  }
  for (const [k, rec] of otps) if (rec.exp < now) otps.delete(k);
}, 60e3).unref();

// ---------- OTP manager ----------
const OTP_TTL_MS = 5 * 60e3;
const OTP_COOLDOWN_MS = 30e3;
const OTP_MAX_ATTEMPTS = 5;
const otps = new Map(); // `${purpose}:${phone}` -> record

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function requestOtp(phone, purpose, ip) {
  const key = purpose + ':' + phone;
  const now = Date.now();
  const prev = otps.get(key);
  if (prev && now - prev.sentAt < OTP_COOLDOWN_MS) {
    return { ok: false, error: 'cooldown', retryAfter: Math.ceil((OTP_COOLDOWN_MS - (now - prev.sentAt)) / 1000) };
  }
  const byPhone = hit('otp-phone:' + phone, 5, 3600e3);
  if (!byPhone.ok) return { ok: false, error: 'rate_limited', retryAfter: byPhone.retryAfter };
  const byIp = hit('otp-ip:' + ip, 20, 3600e3);
  if (!byIp.ok) return { ok: false, error: 'rate_limited', retryAfter: byIp.retryAfter };

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const salt = crypto.randomBytes(8).toString('hex');
  otps.set(key, { hash: sha(salt + code), salt, exp: now + OTP_TTL_MS, attempts: 0, sentAt: now });
  return { ok: true, code };
}

function verifyOtp(phone, purpose, code) {
  const key = purpose + ':' + phone;
  const rec = otps.get(key);
  if (!rec) return { ok: false, error: 'no_otp' };
  if (rec.exp < Date.now()) { otps.delete(key); return { ok: false, error: 'otp_expired' }; }
  rec.attempts += 1;
  if (rec.attempts > OTP_MAX_ATTEMPTS) { otps.delete(key); return { ok: false, error: 'too_many_attempts' }; }
  if (!/^\d{6}$/.test(code) || !safeEqual(sha(rec.salt + code), rec.hash)) return { ok: false, error: 'otp_wrong' };
  otps.delete(key); // single use
  return { ok: true };
}

module.exports = {
  signToken, verifyToken, hashPhone, safeEqual, normPhone, maskPhone, hit, requestOtp, verifyOtp,
};
