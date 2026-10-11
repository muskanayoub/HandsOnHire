# HandsOnHire

**A digital labour chowk for rural India.** Daily-wage workers (farm hands, orchard pickers, masons, artisans, homestay staff and more) list themselves; employers find them by trade, village and *availability today*. Built for **National RBIC Hackathon 1.0**, theme *Livelihoods & Circular Economy*.

> The problem: rural workers lose days of pay waiting at the chowk, and employers (especially during apple, saffron and paddy harvests) can't find hands when they need them. Existing apps assume literacy, English and constant connectivity.

## Run it

Requires Node 18+. **No `npm install` needed** (zero dependencies).

```bash
npm start            # http://localhost:3000
npm test             # 14 tests (API + translation completeness)
npm run reset        # wipe data/db.json (re-seeds on next start)
```

Demo mode shows each OTP on screen so you can try everything without an SMS account.

## Features

| Area | What it does |
|---|---|
| **Today's board** | Chalkboard tally of workers available *today*, per trade. Availability resets daily; workers tap "I'm available today" each morning, so the board is never stale. |
| **Rural focus** | 66 demo workers across 17 districts (J&K, Himachal, Punjab). Trades include orchard picker, tractor operator, craft artisan and homestay/guide. |
| **Seasonal alerts** | A banner for the current month (apple harvest, saffron at Pampore, paddy, snow clearing…) that filters to the trades in demand. |
| **Four languages** | English, हिन्दी, اردو and **کٲشُر (Kashmiri)**, all with full right-to-left support where needed. Trade names and search work in every language. Kashmiri is a **draft translation** (see below). |
| **Voice search** | Microphone button using the browser's speech recognition (Chrome/Edge/Android) for low-literacy users. Kashmiri uses the Urdu recogniser, as no Kashmiri one exists yet. |
| **How it works + live board** | A three-step explainer, plus a live "available today" count on the hero signboard. Worker cards are colour-coded by trade group (agri, building, craft, services). |
| **Search & filters** | Name/trade/village, district, trade chips, available-today, ID-checked only, sort by match/rating/rate/experience. |
| **Ratings** | Employers rate workers, but only after viewing their number. |

## Safety design

1. **Phone numbers are never in the public API.** The list returns a masked number (`90••••••11`).
2. **Employers verify by OTP** before a number is revealed (token valid 2 hours).
3. **Workers verify by OTP** to register and to manage their listing. No passwords.
4. **Every reveal is logged.** Workers see who (masked) viewed their number and when.
5. **Two-way reporting.** 3 different employers report a worker → profile hidden pending review. 2 different workers report an employer → that number is blocked.
6. **ID-checked badge**, set only by a field coordinator through the admin API.
7. **Abuse controls:** OTPs are 6 digits, salted and hashed, expire in 5 min, single-use, max 5 attempts, 30 s resend cooldown, 5 per phone per hour, 20 per IP per hour. Reveals are capped at 25/hour per employer. 240 API requests/min per IP.
8. **Hardening:** HMAC-signed tokens, constant-time comparisons, input validation and sanitising, 16 KB body limit, path-traversal protection, strict CSP and security headers, no inline scripts.
9. **Consent** checkbox when listing; workers can delete their listing and all linked data at any time.
10. Safety tips for both sides are shown in the app.

## Project layout

```
server.js            HTTP server + all API routes
lib/security.js      tokens, OTP manager, rate limiter, phone validation
lib/store.js         JSON-file database (atomic writes)
lib/seed.js          trades, districts, demo worker generator
lib/seasonal.js      month-by-month demand alerts (en/hi/ur/ks)
lib/sms.js           SMS hook (plug in MSG91 / Twilio / Fast2SMS)
public/              index.html, style.css, script.js
public/i18n.js       English, Hindi, Urdu strings
public/i18n-ks.js    Kashmiri strings (edit this file to correct the translation)
test/api.test.js     API tests
test/i18n.test.js    checks every language has every string
```

## API (summary)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/meta`, `/api/stats` | none | trades, districts, season alert; today's counts |
| `GET /api/workers?q=&trade=&district=&available=1&verified=1&sort=` | none | masked public list |
| `POST /api/otp/request`, `/api/otp/verify` | none | `purpose`: `employer`, `register`, `manage` |
| `POST /api/workers` | register token | create listing |
| `POST /api/workers/:id/reveal`, `/rate`, `/report` | employer token | see number, rate, report |
| `GET/PATCH/DELETE /api/me`, `POST /api/me/report-contact` | worker token | manage own listing, see viewers, report an employer |
| `GET /api/admin/reports`, `POST /api/admin/workers/:id/verify`, `/review` | `x-admin-key` | coordinator tools |

## Going live: checklist

- Set `OTP_MODE=production` and implement the call in `lib/sms.js`. The API then stops returning OTPs.
- Set `ADMIN_KEY` and `HOH_SECRET` (token signing key). Serve over HTTPS; set `TRUST_PROXY=1` behind a proxy.
- **Delete the demo data** (`npm run reset` and remove the seeding block in `server.js`). Demo workers are fictional and use placeholder numbers (`90000 000xx`).
- Replace the JSON file with SQLite/Postgres; move rate-limit and OTP state to Redis if you run more than one instance.
- Optional: `HOH_WHATSAPP` for a WhatsApp onboarding number.
- Voice search uses the browser's speech service, which may send audio to the browser vendor. Mention this in your privacy notice.

## Known limits

- The "ID-checked" badge needs a real field-coordinator process; the app only stores the flag.
- The "no listing" OTP response reveals whether a number is registered; make it uniform in production.
- **The Kashmiri translation is a draft.** It was written without a native-speaker review, so wording may need correction. Edit `public/i18n-ks.js`, then delete the `draft_note` line to remove the on-screen draft notice. Hindi and Urdu should be proofread too. Dogri is not included.
- No SMS/IVR/WhatsApp-bot onboarding yet, which would be the next step for workers without smartphones.

## Roadmap

IVR / missed-call registration · WhatsApp bot · reviewed Kashmiri and Dogri · employer job posts with push alerts · payment on completion · offline-first PWA · coordinator dashboard.

## Admin quick-start (demo)

```bash
curl -X POST localhost:3000/api/admin/workers/s1/verify \
  -H 'x-admin-key: demo-admin-key' -H 'content-type: application/json' -d '{"verified":true}'
```
