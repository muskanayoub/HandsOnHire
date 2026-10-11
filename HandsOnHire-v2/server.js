'use strict';
/**
 * HandsOnHire backend: zero dependencies, Node 18+.
 *   npm start   ->  http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sec = require('./lib/security');
const { load, save } = require('./lib/store');
const { TRADES, DISTRICTS, LANGUAGES, buildSeed } = require('./lib/seed');
const { seasonalFor } = require('./lib/seasonal');
const { sendOtpSms } = require('./lib/sms');

const HOST = process.env.HOST || '0.0.0.0';
const OTP_MODE = process.env.OTP_MODE === 'production' ? 'production' : 'demo';
const ADMIN_KEY = process.env.ADMIN_KEY || (OTP_MODE === 'production' ? null : 'demo-admin-key');
const WHATSAPP_NUMBER = (process.env.HOH_WHATSAPP || '').replace(/\D/g, '');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const PUBLIC_DIR = path.join(__dirname, 'public');

const TRADE_IDS = new Set(TRADES.map((t) => t.id));
const DISTRICT_MAP = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
const REPORT_REASONS = ['harassment', 'fake_profile', 'overcharging', 'no_show', 'unsafe', 'other'];
const REVIEW_THRESHOLD = 3;   // distinct reporters before a profile is hidden for review
const EMPLOYER_BLOCK_THRESHOLD = 2; // distinct workers reporting an employer before they are blocked

// ---------- database ----------
const db = load();
if (!db.workers.length) {
  db.workers = buildSeed();
  save(db);
  console.log(`Seeded ${db.workers.length} demo workers (fictional, placeholder phone numbers).`);
}

// ---------- helpers ----------
class ApiError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status; this.code = code; this.extra = extra;
  }
}

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
const todayIST = () => dayFmt.format(new Date()); // YYYY-MM-DD

function hashInt(s) {
  return parseInt(crypto.createHash('md5').update(s).digest('hex').slice(0, 8), 16);
}

/** Availability resets every day. Demo workers get a stable pseudo-random daily status. */
function isAvailable(w, today) {
  return w.demo ? hashInt(w.id + today) % 100 < 68 : w.availableOn === today;
}

function ratingOf(w) {
  const mine = db.ratings.filter((r) => r.workerId === w.id);
  const count = (w.baseCount || 0) + mine.length;
  if (!count) return { avg: 0, count: 0 };
  const sum = (w.baseRating || 0) * (w.baseCount || 0) + mine.reduce((s, r) => s + r.stars, 0);
  return { avg: Math.round((sum / count) * 10) / 10, count };
}

function publicWorker(w, today) {
  const r = ratingOf(w);
  const d = DISTRICT_MAP[w.district];
  return {
    id: w.id, name: w.name, trade: w.trade,
    district: w.district, districtName: d ? d.name : w.district, state: d ? d.state : '',
    village: w.village, rate: w.rate, experience: w.experience, languages: w.languages,
    verified: !!w.verified, availableToday: isAvailable(w, today),
    rating: r.avg, ratingCount: r.count,
    maskedPhone: sec.maskPhone(w.phone), demo: !!w.demo,
  };
}

const findByPhone = (phone) => db.workers.find((w) => w.phone === phone);
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function authed(ctx, role) {
  const h = ctx.req.headers.authorization || '';
  const p = sec.verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '', role);
  if (!p) throw new ApiError(401, 'unauthorized', 'Please verify your phone number first.');
  return p;
}

function requireEmployer(ctx) {
  const p = authed(ctx, 'employer');
  const h = sec.hashPhone(p.sub);
  if (db.blockedEmployers.includes(h)) throw new ApiError(403, 'blocked', 'This number has been blocked after safety reports.');
  return { phone: p.sub, hash: h };
}

function requireWorker(ctx) {
  const p = authed(ctx, 'worker');
  const w = db.workers.find((x) => x.id === p.sub);
  if (!w) throw new ApiError(404, 'no_listing', 'Listing not found.');
  return w;
}

function requireAdmin(ctx) {
  if (!ADMIN_KEY || !sec.safeEqual(ctx.req.headers['x-admin-key'] || '', ADMIN_KEY)) throw new ApiError(403, 'forbidden', 'Admin key required.');
}

// ---------- routes ----------
const routes = [];
const add = (method, pattern, handler) =>
  routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler });

add('GET', '/api/meta', () => {
  const month = parseInt(todayIST().slice(5, 7), 10);
  return {
    trades: TRADES, districts: DISTRICTS.map(({ id, name, state }) => ({ id, name, state })),
    languages: LANGUAGES, seasonal: seasonalFor(month), otpMode: OTP_MODE,
    whatsappNumber: WHATSAPP_NUMBER || null, reportReasons: REPORT_REASONS,
  };
});

add('GET', '/api/stats', () => {
  const today = todayIST();
  const byTrade = Object.fromEntries(TRADES.map((t) => [t.id, 0]));
  let totalAvailable = 0;
  const visible = db.workers.filter((w) => !w.underReview);
  for (const w of visible) if (isAvailable(w, today)) { byTrade[w.trade]++; totalAvailable++; }
  return {
    byTrade, totalAvailable, totalWorkers: visible.length,
    verified: visible.filter((w) => w.verified).length,
    villages: new Set(visible.map((w) => w.district + w.village)).size,
  };
});

add('GET', '/api/workers', ({ query }) => {
  const today = todayIST();
  const q = clean(query.q, 60).toLowerCase();
  const trades = String(query.trade || '').split(',').filter((t) => TRADE_IDS.has(t));
  const district = DISTRICT_MAP[query.district] ? query.district : '';
  const onlyAvail = query.available === '1';
  const onlyVerified = query.verified === '1';

  let list = db.workers.filter((w) => !w.underReview).map((w) => ({ w, p: publicWorker(w, today) }));
  list = list.filter(({ w, p }) => {
    if (trades.length && !trades.includes(w.trade)) return false;
    if (district && w.district !== district) return false;
    if (onlyAvail && !p.availableToday) return false;
    if (onlyVerified && !w.verified) return false;
    if (q) {
      const t = TRADES.find((x) => x.id === w.trade);
      const hay = [w.name, w.village, p.districtName, w.trade, t.en, t.hi, t.ur, t.ks, ...w.languages].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).map((x) => x.p);

  const sort = query.sort || 'best';
  const score = (p) => (p.availableToday ? 1000 : 0) + (p.verified ? 100 : 0) + p.rating * 10 + Math.min(p.ratingCount, 50) / 10;
  const sorters = {
    best: (a, b) => score(b) - score(a),
    rating: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount,
    rate_low: (a, b) => a.rate - b.rate,
    exp: (a, b) => b.experience - a.experience,
  };
  list.sort(sorters[sort] || sorters.best);
  return { total: db.workers.filter((w) => !w.underReview).length, workers: list.slice(0, 200) };
});

// --- OTP ---
add('POST', '/api/otp/request', async (ctx) => {
  const phone = sec.normPhone(ctx.body.phone);
  const purpose = ctx.body.purpose;
  if (!phone) throw new ApiError(400, 'invalid_phone', 'Enter a valid 10-digit mobile number.');
  if (!['employer', 'register', 'manage'].includes(purpose)) throw new ApiError(400, 'validation', 'Unknown purpose.');
  if (purpose === 'register' && findByPhone(phone)) throw new ApiError(409, 'phone_exists', 'This number is already listed.');
  // For a prototype we tell the user when no listing exists. A production build should respond identically either way.
  if (purpose === 'manage') {
    const w = findByPhone(phone);
    if (!w || w.demo) throw new ApiError(404, 'no_listing', 'No listing found for this number.');
  }
  const r = sec.requestOtp(phone, purpose, ctx.ip);
  if (!r.ok) throw new ApiError(429, r.error, 'Please wait before requesting another OTP.', { retryAfter: r.retryAfter });
  await sendOtpSms(phone, r.code);
  return { ok: true, expiresIn: 300, resendIn: 30, demoOtp: OTP_MODE === 'demo' ? r.code : undefined };
});

add('POST', '/api/otp/verify', (ctx) => {
  const phone = sec.normPhone(ctx.body.phone);
  const purpose = ctx.body.purpose;
  if (!phone || !['employer', 'register', 'manage'].includes(purpose)) throw new ApiError(400, 'validation', 'Invalid request.');
  const ipLimit = sec.hit('verify-ip:' + ctx.ip, 40, 3600e3);
  if (!ipLimit.ok) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again later.', { retryAfter: ipLimit.retryAfter });
  const r = sec.verifyOtp(phone, purpose, String(ctx.body.code || ''));
  if (!r.ok) throw new ApiError(400, r.error, 'That OTP is not valid.');

  if (purpose === 'employer') {
    if (db.blockedEmployers.includes(sec.hashPhone(phone))) throw new ApiError(403, 'blocked', 'This number has been blocked after safety reports.');
    return { token: sec.signToken({ role: 'employer', sub: phone }, 2 * 3600), expiresIn: 7200 };
  }
  if (purpose === 'register') {
    return { token: sec.signToken({ role: 'register', sub: phone }, 15 * 60), expiresIn: 900 };
  }
  const w = findByPhone(phone);
  if (!w) throw new ApiError(404, 'no_listing', 'No listing found for this number.');
  return { token: sec.signToken({ role: 'worker', sub: w.id }, 2 * 3600), expiresIn: 7200 };
});

// --- register a worker ---
add('POST', '/api/workers', (ctx) => {
  const b = ctx.body;
  const proof = sec.verifyToken(b.otpToken, 'register');
  if (!proof) throw new ApiError(401, 'unauthorized', 'Verify your phone with OTP first.');
  const phone = proof.sub;
  if (findByPhone(phone)) throw new ApiError(409, 'phone_exists', 'This number is already listed.');
  if (b.consent !== true) throw new ApiError(400, 'validation', 'Consent is required to list.');

  const name = clean(b.name, 60);
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'\-]{1,59}$/u.test(name)) throw new ApiError(400, 'validation', 'Enter your full name (letters only).');
  if (!TRADE_IDS.has(b.trade)) throw new ApiError(400, 'validation', 'Choose a trade.');
  if (!DISTRICT_MAP[b.district]) throw new ApiError(400, 'validation', 'Choose a district.');
  const village = clean(b.village, 50);
  if (!/^[\p{L}\p{M}\p{N} .,'\-/]{2,50}$/u.test(village)) throw new ApiError(400, 'validation', 'Enter your village or area.');
  const rate = Number(b.rate);
  if (!Number.isInteger(rate) || rate < 100 || rate > 5000) throw new ApiError(400, 'validation', 'Daily rate must be between ₹100 and ₹5000.');
  const experience = b.experience === '' || b.experience == null ? 0 : Number(b.experience);
  if (!Number.isInteger(experience) || experience < 0 || experience > 60) throw new ApiError(400, 'validation', 'Experience must be 0 to 60 years.');
  const languages = Array.isArray(b.languages) ? [...new Set(b.languages.filter((l) => LANGUAGES.includes(l)))].slice(0, 5) : [];
  if (!languages.length) throw new ApiError(400, 'validation', 'Choose at least one language.');

  const w = {
    id: 'w' + crypto.randomBytes(5).toString('hex'), demo: false, name, trade: b.trade, district: b.district, village,
    phone, rate, experience, languages, verified: false, underReview: false,
    baseRating: 0, baseCount: 0, availableOn: todayIST(), joined: todayIST(),
  };
  db.workers.unshift(w);
  save(db);
  return {
    worker: publicWorker(w, todayIST()),
    manageToken: sec.signToken({ role: 'worker', sub: w.id }, 2 * 3600),
  };
});

// --- employer actions ---
add('POST', '/api/workers/:id/reveal', (ctx) => {
  const emp = requireEmployer(ctx);
  const w = db.workers.find((x) => x.id === ctx.params.id && !x.underReview);
  if (!w) throw new ApiError(404, 'not_found', 'Worker not found.');
  const lim = sec.hit('reveal:' + emp.hash, 25, 3600e3);
  if (!lim.ok) throw new ApiError(429, 'rate_limited', 'You have viewed many numbers. Try again later.', { retryAfter: lim.retryAfter });
  const recent = db.contacts.find((c) => c.workerId === w.id && c.employerHash === emp.hash && Date.now() - c.at < 24 * 3600e3);
  if (!recent) {
    db.contacts.push({ id: crypto.randomBytes(4).toString('hex'), workerId: w.id, employerHash: emp.hash, employerMask: sec.maskPhone(emp.phone), at: Date.now() });
    save(db);
  }
  return { phone: w.phone, demo: !!w.demo };
});

add('POST', '/api/workers/:id/rate', (ctx) => {
  const emp = requireEmployer(ctx);
  const w = db.workers.find((x) => x.id === ctx.params.id);
  if (!w) throw new ApiError(404, 'not_found', 'Worker not found.');
  if (!db.contacts.some((c) => c.workerId === w.id && c.employerHash === emp.hash)) {
    throw new ApiError(403, 'need_contact_first', 'You can rate a worker after viewing their number.');
  }
  const stars = Number(ctx.body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new ApiError(400, 'validation', 'Choose 1 to 5 stars.');
  const comment = clean(ctx.body.comment, 200);
  const existing = db.ratings.find((r) => r.workerId === w.id && r.employerHash === emp.hash);
  if (existing) Object.assign(existing, { stars, comment, at: Date.now() });
  else db.ratings.push({ workerId: w.id, employerHash: emp.hash, stars, comment, at: Date.now() });
  save(db);
  const r = ratingOf(w);
  return { ok: true, rating: r.avg, ratingCount: r.count };
});

add('POST', '/api/workers/:id/report', (ctx) => {
  const emp = requireEmployer(ctx);
  const w = db.workers.find((x) => x.id === ctx.params.id);
  if (!w) throw new ApiError(404, 'not_found', 'Worker not found.');
  const reason = ctx.body.reason;
  if (!REPORT_REASONS.includes(reason)) throw new ApiError(400, 'validation', 'Choose a reason.');
  const rec = { workerId: w.id, employerHash: emp.hash, reason, details: clean(ctx.body.details, 300), at: Date.now() };
  const i = db.reports.findIndex((r) => r.workerId === w.id && r.employerHash === emp.hash);
  if (i >= 0) db.reports[i] = rec; else db.reports.push(rec);
  const distinct = new Set(db.reports.filter((r) => r.workerId === w.id).map((r) => r.employerHash)).size;
  if (distinct >= REVIEW_THRESHOLD) w.underReview = true;
  save(db);
  return { ok: true };
});

// --- worker self-service ---
function myListing(w) {
  const today = todayIST();
  const reportedIds = new Set(db.employerReports.filter((r) => r.workerId === w.id).map((r) => r.contactId));
  const contacts = db.contacts.filter((c) => c.workerId === w.id).sort((a, b) => b.at - a.at).slice(0, 30)
    .map((c) => ({ id: c.id, employerMask: c.employerMask, at: c.at, reported: reportedIds.has(c.id) }));
  return { worker: publicWorker(w, today), underReview: !!w.underReview, contacts };
}

add('GET', '/api/me', (ctx) => myListing(requireWorker(ctx)));

add('PATCH', '/api/me', (ctx) => {
  const w = requireWorker(ctx);
  const b = ctx.body;
  if (typeof b.availableToday === 'boolean') w.availableOn = b.availableToday ? todayIST() : null;
  if (b.rate !== undefined) {
    const rate = Number(b.rate);
    if (!Number.isInteger(rate) || rate < 100 || rate > 5000) throw new ApiError(400, 'validation', 'Daily rate must be between ₹100 and ₹5000.');
    w.rate = rate;
  }
  save(db);
  return myListing(w);
});

add('DELETE', '/api/me', (ctx) => {
  const w = requireWorker(ctx);
  db.workers = db.workers.filter((x) => x.id !== w.id);
  db.ratings = db.ratings.filter((r) => r.workerId !== w.id);
  db.reports = db.reports.filter((r) => r.workerId !== w.id);
  db.contacts = db.contacts.filter((c) => c.workerId !== w.id);
  db.employerReports = db.employerReports.filter((r) => r.workerId !== w.id);
  save(db);
  return { ok: true };
});

add('POST', '/api/me/report-contact', (ctx) => {
  const w = requireWorker(ctx);
  const c = db.contacts.find((x) => x.id === ctx.body.contactId && x.workerId === w.id);
  if (!c) throw new ApiError(404, 'not_found', 'Contact not found.');
  const reason = ctx.body.reason;
  if (!REPORT_REASONS.includes(reason)) throw new ApiError(400, 'validation', 'Choose a reason.');
  if (!db.employerReports.some((r) => r.contactId === c.id)) {
    db.employerReports.push({ contactId: c.id, workerId: w.id, employerHash: c.employerHash, reason, at: Date.now() });
  }
  const distinct = new Set(db.employerReports.filter((r) => r.employerHash === c.employerHash).map((r) => r.workerId)).size;
  if (distinct >= EMPLOYER_BLOCK_THRESHOLD && !db.blockedEmployers.includes(c.employerHash)) db.blockedEmployers.push(c.employerHash);
  save(db);
  return { ok: true };
});

// --- admin (field coordinator) ---
add('GET', '/api/admin/reports', (ctx) => {
  requireAdmin(ctx);
  const byWorker = {};
  for (const r of db.reports) (byWorker[r.workerId] ||= []).push({ reason: r.reason, details: r.details, at: r.at });
  return {
    underReview: db.workers.filter((w) => w.underReview).map((w) => ({ id: w.id, name: w.name, trade: w.trade, village: w.village })),
    reports: byWorker, blockedEmployers: db.blockedEmployers.length,
  };
});

add('POST', '/api/admin/workers/:id/verify', (ctx) => {
  requireAdmin(ctx);
  const w = db.workers.find((x) => x.id === ctx.params.id);
  if (!w) throw new ApiError(404, 'not_found', 'Worker not found.');
  w.verified = ctx.body.verified !== false;
  save(db);
  return { id: w.id, verified: w.verified };
});

add('POST', '/api/admin/workers/:id/review', (ctx) => {
  requireAdmin(ctx);
  const w = db.workers.find((x) => x.id === ctx.params.id);
  if (!w) throw new ApiError(404, 'not_found', 'Worker not found.');
  w.underReview = ctx.body.underReview === true;
  if (!w.underReview) db.reports = db.reports.filter((r) => r.workerId !== w.id);
  save(db);
  return { id: w.id, underReview: w.underReview };
});

// ---------- HTTP plumbing ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new ApiError(413, 'too_large', 'Request too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
      } catch { reject(new ApiError(400, 'bad_json', 'Invalid JSON.')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);
  const url = new URL(req.url, 'http://localhost');
  const ip = clientIp(req);

  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    try { return serveStatic(req, res, url.pathname); } catch { res.writeHead(400); return res.end(); }
  }

  try {
    const g = sec.hit('global:' + ip, 240, 60e3);
    if (!g.ok) throw new ApiError(429, 'rate_limited', 'Too many requests.', { retryAfter: g.retryAfter });
    const route = routes.map((r) => ({ r, m: r.re.exec(url.pathname) })).find((x) => x.m && x.r.method === req.method);
    if (!route) {
      const pathExists = routes.some((r) => r.re.test(url.pathname));
      throw new ApiError(pathExists ? 405 : 404, 'not_found', 'Not found.');
    }
    const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
    const out = await route.r.handler({
      req, res, ip, body, params: route.m.groups || {}, query: Object.fromEntries(url.searchParams),
    });
    sendJson(res, 200, out);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.extra && e.extra.retryAfter) res.setHeader('Retry-After', e.extra.retryAfter);
      return sendJson(res, e.status, { error: e.code, message: e.message, ...(e.extra || {}) });
    }
    console.error(e);
    sendJson(res, 500, { error: 'server_error', message: 'Something went wrong.' });
  }
});

function start(port = Number(process.env.PORT) || 3000, host = HOST) {
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

if (require.main === module) {
  start().then(() => {
    const { port } = server.address();
    console.log(`HandsOnHire running at http://localhost:${port}  (OTP mode: ${OTP_MODE})`);
    if (OTP_MODE === 'demo') console.log('Demo mode: OTPs are shown in the app and printed here. Set OTP_MODE=production with an SMS provider before going live.');
    if (!ADMIN_KEY) console.log('ADMIN_KEY is not set: admin endpoints are disabled.');
    else if (OTP_MODE === 'demo' && !process.env.ADMIN_KEY) console.log('Using the default demo admin key. Set ADMIN_KEY to change it.');
  });
}

module.exports = { server, start };
