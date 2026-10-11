/* HandsOnHire front end. No framework, no inline handlers (the CSP forbids them). */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICONS = {
    farm: '<path d="M12 22V12M12 12C7 12 4 8 4 4c4 0 8 3 8 8zM12 12c5 0 8-4 8-8-4 0-8 3-8 8z"/>',
    picker: '<path d="M12 7c-2-2-6-1-6 4 0 5 3 9 6 9s6-4 6-9c0-5-4-6-6-4zM12 7c0-2 1-4 3-5"/>',
    tractor: '<circle cx="7" cy="17" r="3.5"/><circle cx="18" cy="18" r="2"/><path d="M3 17V9h7l2 4h4v5M10 9V6h3"/>',
    mason: '<path d="M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6"/>',
    electrician: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
    plumber: '<path d="M12 2c-3 3-5 6-5 9a5 5 0 0 0 10 0c0-3-2-6-5-9z"/>',
    painter: '<path d="M3 17.25V21h3.75L18.6 9.15l-3.75-3.75L3 17.25zM17.7 4.05l2.25 2.25a1 1 0 0 1 0 1.4l-1.6 1.6-3.75-3.75 1.6-1.6a1 1 0 0 1 1.5.1z"/>',
    carpenter: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    artisan: '<path d="M9 3h6M10 3c0 3-4 4-4 9a6 6 0 0 0 12 0c0-5-4-6-4-9"/>',
    homestay: '<path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="1.5"/>',
    house: '<path d="M4 21V10l8-6 8 6v11M9 21v-7h6v7"/>',
    mover: '<path d="M3 7h13v10H3zM16 10h3l2 3v4h-5z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="18" cy="19" r="1.5"/>',
    gardener: '<path d="M12 22c0-6 4-8 4-8s0 6-4 8zm0 0c0-4-4-6-4-6s0 4 4 6zM12 14V4M9 4h6"/>',
  };
  const svg = (inner, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const tradeSvg = (id) => svg(ICONS[id] || '');
  const STAR = '<svg class="star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3 7 7 .6-5.3 4.7L18.2 22 12 18.2 5.8 22l1.5-7.7L2 9.6 9 9z"/></svg>';
  const SHIELD = svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>');
  const LOCK = svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
  const PHONE = svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>');
  const CHAT = svg('<path d="M21 12a8 8 0 0 1-11.7 7L4 20l1.1-4.2A8 8 0 1 1 21 12z"/>');

  // ---------- state ----------
  const LOCALES = { en: 'en-IN', hi: 'hi-IN', ur: 'ur-IN', ks: 'ur-IN' };
  const SPEECH = { en: 'en-IN', hi: 'hi-IN', ur: 'ur-PK', ks: 'ur-IN' }; // no Kashmiri recogniser yet, Urdu is the closest
  const RTL = new Set(['ur', 'ks']);
  const GROUPS = { farm: 'agri', picker: 'agri', tractor: 'agri', gardener: 'agri', mason: 'build', electrician: 'build', plumber: 'build', painter: 'build', carpenter: 'build', mover: 'build', artisan: 'craft', homestay: 'service', house: 'service' };
  const store = {
    get: (k, d = null) => { try { return JSON.parse(sessionStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
    del: (k) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
  };
  const state = {
    lang: (() => { try { return localStorage.getItem('hoh_lang') || 'en'; } catch { return 'en'; } })(),
    meta: null, stats: null, workers: [], total: 0,
    filters: { q: '', district: '', trades: [], avail: false, verified: false, sort: 'best' },
    revealed: store.get('hoh_rev', {}),
    loadSeq: 0,
  };
  if (!window.I18N[state.lang]) state.lang = 'en';
  if (!window.I18N.ks) window.I18N.ks = window.I18N.en;

  // ---------- i18n ----------
  function t(key, vars) {
    const s = window.I18N[state.lang][key] ?? window.I18N.en[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? vars[k] : ''));
  }
  const tradeLabel = (id) => {
    const tr = state.meta && state.meta.trades.find((x) => x.id === id);
    return tr ? (tr[state.lang] || tr.en) : id;
  };

  function applyI18n(root = document) {
    $$('[data-i18n]', root).forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-ph]', root).forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $$('[data-i18n-label]', root).forEach((el) => { const v = t(el.dataset.i18nLabel); el.setAttribute('aria-label', v); el.title = v; });
  }
  function updateDraftBanner() {
    const b = $('#draft-banner');
    b.hidden = state.lang !== 'ks';
    if (state.lang === 'ks') $('#draft-text').textContent = t('draft_note');
  }
  function setLang(lang) {
    state.lang = lang;
    try { localStorage.setItem('hoh_lang', lang); } catch { /* ignore */ }
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr';
    $('#lang-select').value = lang;
    applyI18n();
    updateDraftBanner();
    $('#modal-close').setAttribute('aria-label', t('close'));
    if (state.meta) { renderDistricts(); renderChips(); renderSeason(); renderTally(); renderCards(); }
  }

  // ---------- api ----------
  async function api(path, { method = 'GET', body, token } = {}) {
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch { throw { code: 'network' }; }
    let data = {};
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) throw { code: data.error || 'generic', message: data.message, status: res.status, retryAfter: data.retryAfter };
    return data;
  }
  function errMsg(e) {
    const key = 'err_' + (e && e.code);
    if (window.I18N[state.lang][key] || window.I18N.en[key]) return t(key);
    return (e && e.message) || t('err_generic');
  }

  // ---------- toast ----------
  function toast(msg, kind = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    $('#toast-root').appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  // ---------- modal ----------
  let lastFocus = null;
  let modalOnClose = null;
  let modalTimers = [];
  const clearTimers = () => { modalTimers.forEach(clearInterval); modalTimers = []; };

  function openModal(html, onMount) {
    clearTimers();
    modalOnClose = null;
    $('#modal-body').innerHTML = html;
    const bd = $('#modal-backdrop');
    if (!bd.classList.contains('open')) lastFocus = document.activeElement;
    bd.classList.add('open');
    document.body.classList.add('modal-open');
    if (onMount) onMount($('#modal-body'));
    const first = $('#modal-body input:not([type=hidden]), #modal-body select, #modal-body button');
    (first || $('#modal')).focus();
  }
  function closeModal() {
    clearTimers();
    $('#modal-backdrop').classList.remove('open');
    document.body.classList.remove('modal-open');
    $('#modal-body').innerHTML = '';
    const cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  const setError = (root, msg) => { const el = $('.form-error', root); if (el) el.textContent = msg || ''; };

  // ---------- phone + OTP steps (shared by employer, register, manage) ----------
  function cleanPhone(raw) {
    let d = String(raw).replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? d : null;
  }

  function phoneStep(root, { purpose, title, hint, onToken, onCancel }) {
    root.innerHTML = `
      <h3 id="modal-title">${esc(title)}</h3>
      <p class="hint">${esc(hint)}</p>
      <form id="f-phone" novalidate>
        <div class="field">
          <label for="p-phone">${esc(t('your_phone'))}</label>
          <div class="phone-input" dir="ltr"><span class="prefix">+91</span>
            <input id="p-phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="${esc(t('phone_ph'))}" required></div>
        </div>
        <p class="form-error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" data-act="cancel">${esc(t('cancel'))}</button>
          <button type="submit" class="btn-submit">${esc(t('send_otp'))}</button>
        </div>
      </form>`;
    const form = $('#f-phone', root);
    $('[data-act=cancel]', root).onclick = onCancel;
    $('#p-phone', root).focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const phone = cleanPhone($('#p-phone', root).value);
      if (!phone) return setError(root, t('err_invalid_phone'));
      const btn = $('.btn-submit', form); btn.disabled = true; setError(root, '');
      try {
        const r = await api('/api/otp/request', { method: 'POST', body: { phone, purpose } });
        otpStep(root, {
          phone, purpose, demoOtp: r.demoOtp, resendIn: r.resendIn, onToken,
          onBack: () => phoneStep(root, { purpose, title, hint, onToken, onCancel }),
        });
      } catch (err) { setError(root, errMsg(err)); btn.disabled = false; }
    };
  }

  function otpStep(root, { phone, purpose, demoOtp, resendIn = 30, onToken, onBack }) {
    const masked = phone.slice(0, 2) + '••••••' + phone.slice(-2);
    const demoHtml = demoOtp
      ? `<p class="demo-otp">${esc(t('demo_otp', { code: '@@' })).replace('@@', `<b class="otp-code" dir="ltr">${esc(demoOtp)}</b>`)}</p>` : '';
    root.innerHTML = `
      <h3 id="modal-title">${esc(t('otp_title'))}</h3>
      <p class="hint"><span dir="ltr">${esc(t('otp_sent', { phone: masked }))}</span></p>
      ${demoHtml}
      <form id="f-otp" novalidate>
        <div class="field">
          <label for="p-otp">${esc(t('enter_otp'))}</label>
          <input id="p-otp" class="otp-input" dir="ltr" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" required>
        </div>
        <p class="form-error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" data-act="back">${esc(t('back'))}</button>
          <button type="submit" class="btn-submit">${esc(t('verify'))}</button>
        </div>
        <button type="button" class="link-btn resend" data-act="resend" disabled></button>
      </form>`;
    const input = $('#p-otp', root);
    const resend = $('[data-act=resend]', root);
    input.focus();
    $('[data-act=back]', root).onclick = onBack;

    let left = resendIn;
    const tick = () => {
      if (left > 0) { resend.disabled = true; resend.textContent = t('resend_in', { s: left }); left -= 1; }
      else { resend.disabled = false; resend.textContent = t('resend'); }
    };
    tick();
    clearTimers();
    modalTimers.push(setInterval(tick, 1000));

    resend.onclick = async () => {
      resend.disabled = true; setError(root, '');
      try {
        const r = await api('/api/otp/request', { method: 'POST', body: { phone, purpose } });
        otpStep(root, { phone, purpose, demoOtp: r.demoOtp, resendIn: r.resendIn, onToken, onBack });
      } catch (err) { setError(root, errMsg(err)); left = err.retryAfter || 5; tick(); }
    };

    $('#f-otp', root).onsubmit = async (e) => {
      e.preventDefault();
      const code = input.value.replace(/\D/g, '');
      if (code.length !== 6) return setError(root, t('err_otp_wrong'));
      const btn = $('.btn-submit', root); btn.disabled = true; setError(root, '');
      try {
        const r = await api('/api/otp/verify', { method: 'POST', body: { phone, purpose, code } });
        onToken(r.token, r);
      } catch (err) { setError(root, errMsg(err)); btn.disabled = false; input.select(); }
    };
  }

  // ---------- employer session ----------
  function tokenValid(tok) {
    try {
      const p = JSON.parse(atob(tok.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
      return p.exp * 1000 > Date.now() + 60000;
    } catch { return false; }
  }
  const getToken = (key) => { const tok = store.get(key); return tok && tokenValid(tok) ? tok : null; };

  function ensureEmployer() {
    const existing = getToken('hoh_emp');
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve) => {
      openModal('<div id="step"></div>', (body) => {
        phoneStep($('#step', body), {
          purpose: 'employer', title: t('otp_title'), hint: t('otp_hint_employer'),
          onToken: (tok) => { store.set('hoh_emp', tok); resolve(tok); closeModal(); toast(t('phone_verified')); },
          onCancel: () => closeModal(),
        });
        modalOnClose = () => resolve(null);
      });
    });
  }

  // ---------- data loading ----------
  async function loadWorkers() {
    const seq = ++state.loadSeq;
    const f = state.filters;
    const qs = new URLSearchParams();
    if (f.q) qs.set('q', f.q);
    if (f.district) qs.set('district', f.district);
    if (f.trades.length) qs.set('trade', f.trades.join(','));
    if (f.avail) qs.set('available', '1');
    if (f.verified) qs.set('verified', '1');
    qs.set('sort', f.sort);
    try {
      const r = await api('/api/workers?' + qs);
      if (seq !== state.loadSeq) return; // a newer request superseded this one
      state.workers = r.workers; state.total = r.total;
      renderCards();
    } catch (e) { toast(errMsg(e), 'err'); }
  }
  async function loadStats() {
    try { state.stats = await api('/api/stats'); renderTally(); } catch { /* non-critical */ }
  }

  // ---------- rendering ----------
  function renderDistricts() {
    const sel = $('#district-select');
    const groups = {};
    state.meta.districts.forEach((d) => { (groups[d.state] ||= []).push(d); });
    sel.innerHTML = `<option value="">${esc(t('district_all'))}</option>` + Object.entries(groups)
      .map(([st, ds]) => `<optgroup label="${esc(st)}">${ds.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</optgroup>`).join('');
    sel.value = state.filters.district;
  }

  function renderChips() {
    const row = $('#chip-row');
    const none = state.filters.trades.length === 0;
    row.innerHTML = `<button type="button" class="chip${none ? ' active' : ''}" data-trade="" aria-pressed="${none}">${esc(t('all_trades'))}</button>` +
      state.meta.trades.map((tr) => {
        const on = state.filters.trades.includes(tr.id);
        return `<button type="button" class="chip${on ? ' active' : ''}" data-trade="${esc(tr.id)}" aria-pressed="${on}">${tradeSvg(tr.id)}${esc(tradeLabel(tr.id))}</button>`;
      }).join('');
  }

  function tallyMarks(count) {
    if (!count) return '<span class="tally-none">–</span>';
    let html = '';
    for (let g = 0; g < Math.floor(count / 5); g++) {
      html += '<div class="tally-group"><div class="tally-line"></div><div class="tally-line"></div><div class="tally-line"></div><div class="tally-line"></div><div class="tally-slash"></div></div>';
    }
    const rem = count % 5;
    if (rem) html += `<div class="tally-rem">${'<div class="tally-line"></div>'.repeat(rem)}</div>`;
    return html;
  }

  function renderTally() {
    if (!state.stats || !state.meta) return;
    const s = state.stats;
    $('#tally-total').textContent = t('board_total', { n: s.totalAvailable, v: s.villages });
    $('#hl-title').textContent = t('board_title');
    $('#hl-n').textContent = s.totalAvailable;
    $('#hero-live').hidden = false;
    $('#tally-grid').innerHTML = state.meta.trades.map((tr) => {
      const n = s.byTrade[tr.id] || 0;
      return `<button type="button" class="tally-item" data-trade="${esc(tr.id)}" aria-label="${esc(tradeLabel(tr.id))}: ${n}">
        <span class="tally-trade">${esc(tradeLabel(tr.id))}</span>
        <span class="tally-marks" aria-hidden="true">${tallyMarks(n)}</span>
        <span class="tally-n" aria-hidden="true">${n}</span></button>`;
    }).join('');
  }

  function renderSeason() {
    const s = state.meta && state.meta.seasonal;
    const el = $('#season');
    if (!s) { el.hidden = true; return; }
    el.hidden = false;
    $('#season-text').textContent = s[state.lang] || s.en;
  }

  const fmtPhone = (p) => `+91 ${p.slice(0, 5)} ${p.slice(5)}`;

  function cardHtml(w) {
    const rv = state.revealed[w.id];
    const initials = w.name.split(' ').filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');
    const rating = w.ratingCount
      ? `<span class="rating">${STAR}<b>${w.rating.toFixed(1)}</b><small>(${w.ratingCount})</small></span>`
      : `<span class="rating new">${esc(t('new_worker'))}</span>`;
    const contact = rv
      ? `<p class="phone-full" dir="ltr">${esc(fmtPhone(rv.phone))}</p>
         ${rv.demo ? `<p class="demo-note">${esc(t('demo_note'))}</p>` : ''}
         <div class="contact-row">
           <a class="contact-btn call" href="tel:+91${esc(rv.phone)}">${PHONE}${esc(t('call'))}</a>
           <a class="contact-btn wa" href="https://wa.me/91${esc(rv.phone)}?text=${encodeURIComponent(t('wa_text'))}" target="_blank" rel="noopener noreferrer">${CHAT}${esc(t('whatsapp'))}</a>
         </div>
         <div class="mini-row">
           <button type="button" class="link-btn" data-act="rate" data-id="${esc(w.id)}">${esc(t('rate_btn'))}</button>
           <button type="button" class="link-btn danger" data-act="report" data-id="${esc(w.id)}">${esc(t('report_btn'))}</button>
         </div>`
      : `<p class="masked" dir="ltr">${esc(w.maskedPhone)}</p>
         <button type="button" class="contact-btn reveal" data-act="reveal" data-id="${esc(w.id)}">${LOCK}${esc(t('show_contact'))}</button>
         <p class="contact-hint">${esc(t('contact_hint'))}</p>`;
    return `<article class="id-card" data-group="${GROUPS[w.trade] || 'build'}">
      <div class="id-card-top">
        <div class="avatar" aria-hidden="true">${esc(initials)}</div>
        <div class="id-heading">
          <p class="id-name">${esc(w.name)}</p>
          <p class="id-loc">${esc(w.village)}, ${esc(w.districtName)}</p>
        </div>
        ${rating}
      </div>
      <div class="id-trade-row">
        <div class="trade-icon">${tradeSvg(w.trade)}</div>
        <span class="trade-name">${esc(tradeLabel(w.trade))}</span>
        ${w.verified ? `<span class="badge-verified">${SHIELD}${esc(t('id_checked'))}</span>` : ''}
      </div>
      <p class="rate">${esc(t('daily_rate'))}: <b>₹${w.rate}</b></p>
      <p class="meta-line">${esc(t('yrs', { n: w.experience }))}<br><span class="langs">${esc(w.languages.join(', '))}</span></p>
      <div class="status-row"><span class="status-badge ${w.availableToday ? 'avail' : 'busy'}">${esc(w.availableToday ? t('available') : t('unavailable'))}</span></div>
      <div class="contact-area">${contact}</div>
    </article>`;
  }

  function renderCards() {
    $('#grid-count').textContent = t('shown_of', { n: state.workers.length, t: state.total });
    const box = $('#cards-container');
    box.innerHTML = state.workers.length
      ? state.workers.map(cardHtml).join('')
      : `<div class="empty-state">${esc(t('empty'))}</div>`;
  }

  // ---------- actions ----------
  async function reveal(id) {
    const tok = await ensureEmployer();
    if (!tok) return;
    try {
      const r = await api(`/api/workers/${encodeURIComponent(id)}/reveal`, { method: 'POST', token: tok });
      state.revealed[id] = r; store.set('hoh_rev', state.revealed);
      renderCards();
    } catch (e) {
      if (e.code === 'unauthorized') { store.del('hoh_emp'); return reveal(id); }
      if (e.code === 'blocked') store.del('hoh_emp');
      toast(errMsg(e), 'err');
    }
  }

  function reasonOptions() {
    return state.meta.reportReasons.map((r) => `<option value="${esc(r)}">${esc(t('reason_' + r))}</option>`).join('');
  }

  function openReasonModal({ title, hint, onSubmit, onCancel }) {
    openModal(`
      <h3 id="modal-title">${esc(title)}</h3>
      <p class="hint">${esc(hint || '')}</p>
      <form id="f-reason" novalidate>
        <div class="field"><select id="r-reason" aria-label="${esc(title)}">${reasonOptions()}</select></div>
        <div class="field"><textarea id="r-details" maxlength="300" rows="3" placeholder="${esc(t('details_ph'))}"></textarea></div>
        <p class="form-error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" data-act="cancel">${esc(t('cancel'))}</button>
          <button type="submit" class="btn-submit">${esc(t('submit'))}</button>
        </div>
      </form>`, (body) => {
      $('[data-act=cancel]', body).onclick = onCancel || closeModal;
      $('#f-reason', body).onsubmit = async (e) => {
        e.preventDefault();
        const btn = $('.btn-submit', body); btn.disabled = true;
        try { await onSubmit($('#r-reason', body).value, $('#r-details', body).value); }
        catch (err) { setError(body, errMsg(err)); btn.disabled = false; }
      };
    });
  }

  async function openReport(id) {
    const w = state.workers.find((x) => x.id === id);
    const tok = await ensureEmployer();
    if (!tok || !w) return;
    openReasonModal({
      title: t('report_title', { name: w.name }), hint: t('report_hint'),
      onSubmit: async (reason, details) => {
        await api(`/api/workers/${encodeURIComponent(id)}/report`, { method: 'POST', token: tok, body: { reason, details } });
        closeModal(); toast(t('thanks_report'));
        loadWorkers(); loadStats();
      },
    });
  }

  async function openRate(id) {
    const w = state.workers.find((x) => x.id === id);
    const tok = await ensureEmployer();
    if (!tok || !w) return;
    openModal(`
      <h3 id="modal-title">${esc(t('rate_title', { name: w.name }))}</h3>
      <p class="hint">${esc(t('rate_hint'))}</p>
      <form id="f-rate" novalidate>
        <div class="stars" role="radiogroup" aria-label="${esc(t('rate_btn'))}">
          ${[1, 2, 3, 4, 5].map((n) => `<label class="star-opt"><input type="radio" name="stars" value="${n}"><span aria-hidden="true">★</span><span class="sr-only">${n}</span></label>`).join('')}
        </div>
        <div class="field"><textarea id="rt-comment" maxlength="200" rows="2" placeholder="${esc(t('comment_ph'))}"></textarea></div>
        <p class="form-error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" data-act="cancel">${esc(t('cancel'))}</button>
          <button type="submit" class="btn-submit">${esc(t('submit'))}</button>
        </div>
      </form>`, (body) => {
      const opts = $$('.star-opt', body);
      const paint = () => { const v = +(($('input:checked', body) || {}).value || 0); opts.forEach((o, i) => o.classList.toggle('on', i < v)); };
      opts.forEach((o) => o.addEventListener('change', paint));
      $('[data-act=cancel]', body).onclick = closeModal;
      $('#f-rate', body).onsubmit = async (e) => {
        e.preventDefault();
        const checked = $('input:checked', body);
        if (!checked) return setError(body, t('rate_hint'));
        const btn = $('.btn-submit', body); btn.disabled = true;
        try {
          await api(`/api/workers/${encodeURIComponent(id)}/rate`, { method: 'POST', token: tok, body: { stars: +checked.value, comment: $('#rt-comment', body).value } });
          closeModal(); toast(t('thanks_rating')); loadWorkers();
        } catch (err) { setError(body, errMsg(err)); btn.disabled = false; }
      };
    });
  }

  // ---------- register ----------
  function openRegister() {
    const langs = state.meta.languages;
    const draft = { name: '', trade: state.meta.trades[0].id, district: state.meta.districts[0].id, village: '', rate: '', experience: '', languages: [], consent: false };

    function renderForm() {
      const tradeOpts = state.meta.trades.map((tr) => `<option value="${esc(tr.id)}"${tr.id === draft.trade ? ' selected' : ''}>${esc(tradeLabel(tr.id))}</option>`).join('');
      const distOpts = state.meta.districts.map((d) => `<option value="${esc(d.id)}"${d.id === draft.district ? ' selected' : ''}>${esc(d.name)}, ${esc(d.state)}</option>`).join('');
      const langBoxes = langs.map((l) => `<label class="lang-opt"><input type="checkbox" name="lang" value="${esc(l)}"${draft.languages.includes(l) ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('');
      openModal(`
        <h3 id="modal-title">${esc(t('reg_title'))}</h3>
        <p class="hint">${esc(t('reg_hint'))}</p>
        <form id="f-reg" novalidate>
          <div class="field"><label for="g-name">${esc(t('full_name'))}</label>
            <input id="g-name" type="text" maxlength="60" autocomplete="name" placeholder="${esc(t('name_ph'))}" value="${esc(draft.name)}" required></div>
          <div class="field-row">
            <div class="field"><label for="g-trade">${esc(t('trade_label'))}</label><select id="g-trade">${tradeOpts}</select></div>
            <div class="field"><label for="g-rate">${esc(t('rate_label'))}</label>
              <input id="g-rate" type="text" inputmode="numeric" maxlength="4" placeholder="600" value="${esc(draft.rate)}" required></div>
          </div>
          <div class="field-row">
            <div class="field"><label for="g-district">${esc(t('district_label'))}</label><select id="g-district">${distOpts}</select></div>
            <div class="field"><label for="g-village">${esc(t('village_label'))}</label>
              <input id="g-village" type="text" maxlength="50" placeholder="${esc(t('village_ph'))}" value="${esc(draft.village)}" required></div>
          </div>
          <div class="field"><label for="g-exp">${esc(t('exp_label'))}</label>
            <input id="g-exp" type="text" inputmode="numeric" maxlength="2" placeholder="5" value="${esc(draft.experience)}"></div>
          <fieldset class="field"><legend>${esc(t('langs_label'))}</legend><div class="lang-grid">${langBoxes}</div></fieldset>
          <label class="consent"><input type="checkbox" id="g-consent"${draft.consent ? ' checked' : ''}><span>${esc(t('consent'))}</span></label>
          <p class="form-error" role="alert"></p>
          <div class="modal-actions">
            <button type="button" class="btn-cancel" data-act="cancel">${esc(t('cancel'))}</button>
            <button type="submit" class="btn-submit">${esc(t('reg_submit'))}</button>
          </div>
        </form>`, (body) => {
        $('[data-act=cancel]', body).onclick = closeModal;
        $('#f-reg', body).onsubmit = async (e) => {
          e.preventDefault();
          Object.assign(draft, {
            name: $('#g-name', body).value.trim(), trade: $('#g-trade', body).value, district: $('#g-district', body).value,
            village: $('#g-village', body).value.trim(), rate: $('#g-rate', body).value.trim(), experience: $('#g-exp', body).value.trim(),
            languages: $$('input[name=lang]:checked', body).map((x) => x.value), consent: $('#g-consent', body).checked,
          });
          const rate = Number(draft.rate);
          if (draft.name.length < 2 || draft.village.length < 2) return setError(body, t('err_generic'));
          if (!Number.isInteger(rate) || rate < 100 || rate > 5000) return setError(body, t('rate_label') + ': 100 - 5000');
          if (!draft.languages.length) return setError(body, t('langs_label'));
          if (!draft.consent) return setError(body, t('consent'));
          startOtp(body);
        };
      });
    }

    function startOtp() {
      openModal('<div id="step"></div>', (body) => {
        phoneStep($('#step', body), {
          purpose: 'register', title: t('otp_title'), hint: t('reg_hint'),
          onCancel: renderForm,
          onToken: (proof) => submit(proof, body),
        });
      });
    }

    async function submit(otpToken, body) {
      try {
        const r = await api('/api/workers', {
          method: 'POST',
          body: { ...draft, rate: Number(draft.rate), experience: draft.experience === '' ? 0 : Number(draft.experience), otpToken },
        });
        store.set('hoh_wk', r.manageToken);
        openModal(`
          <h3 id="modal-title">${esc(t('reg_done'))}</h3>
          <p class="hint">${esc(t('reg_done2'))}</p>
          <div class="modal-actions"><button type="button" class="btn-submit" data-act="done">${esc(t('close'))}</button></div>`,
        (b) => { $('[data-act=done]', b).onclick = closeModal; });
        loadWorkers(); loadStats();
      } catch (err) {
        // Back to the form with the reason shown.
        renderForm();
        setError($('#modal-body'), errMsg(err));
      }
    }

    renderForm();
  }

  // ---------- manage my listing ----------
  function openManage() {
    const tok = getToken('hoh_wk');
    if (tok) return showPanel(tok);
    openModal('<div id="step"></div>', (body) => {
      phoneStep($('#step', body), {
        purpose: 'manage', title: t('manage_title'), hint: t('manage_hint'),
        onCancel: closeModal,
        onToken: (token) => { store.set('hoh_wk', token); showPanel(token); },
      });
    });
  }

  async function showPanel(token) {
    let me;
    try { me = await api('/api/me', { token }); }
    catch (e) {
      if (e.code === 'unauthorized' || e.code === 'no_listing') { store.del('hoh_wk'); return openManage(); }
      return toast(errMsg(e), 'err');
    }
    const w = me.worker;
    const fmt = (at) => new Date(at).toLocaleString(LOCALES[state.lang] || 'en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const contacts = me.contacts.length
      ? `<ul class="contact-log">${me.contacts.map((c) => `
          <li><span dir="ltr" class="log-num">${esc(c.employerMask)}</span><span class="log-time">${esc(fmt(c.at))}</span>
          ${c.reported ? `<span class="log-done">${esc(t('reported'))}</span>`
            : `<button type="button" class="link-btn danger" data-act="rc" data-id="${esc(c.id)}">${esc(t('report_contact'))}</button>`}</li>`).join('')}</ul>`
      : `<p class="muted">${esc(t('no_contacts'))}</p>`;
    openModal(`
      <h3 id="modal-title">${esc(t('manage_title'))}</h3>
      <p class="manage-name"><b>${esc(w.name)}</b><br>${esc(tradeLabel(w.trade))}, ${esc(w.village)}</p>
      ${me.underReview ? `<p class="warn">${esc(t('under_review'))}</p>` : ''}
      <p><span class="status-badge ${w.availableToday ? 'avail' : 'busy'}">${esc(w.availableToday ? t('status_avail') : t('status_busy'))}</span></p>
      <div class="modal-actions"><button type="button" class="btn-submit" data-act="toggle">${esc(w.availableToday ? t('btn_busy') : t('btn_avail'))}</button></div>
      <form id="f-newrate" class="inline-form" novalidate>
        <label for="m-rate">${esc(t('update_rate'))} (₹)</label>
        <div class="inline-row"><input id="m-rate" type="text" inputmode="numeric" maxlength="4" value="${w.rate}"><button type="submit" class="btn-cancel">${esc(t('save'))}</button></div>
      </form>
      <h4>${esc(t('contacts_title'))}</h4>
      ${contacts}
      <p class="form-error" role="alert"></p>
      <button type="button" class="link-btn danger delete-link" data-act="delete">${esc(t('delete_listing'))}</button>`,
    (body) => {
      const refresh = () => showPanel(token);
      const fail = (e) => {
        if (e.code === 'unauthorized') { store.del('hoh_wk'); openManage(); } else setError(body, errMsg(e));
      };
      $('[data-act=toggle]', body).onclick = async () => {
        try { await api('/api/me', { method: 'PATCH', token, body: { availableToday: !w.availableToday } }); toast(t('saved')); loadWorkers(); loadStats(); refresh(); }
        catch (e) { fail(e); }
      };
      $('#f-newrate', body).onsubmit = async (e) => {
        e.preventDefault();
        try { await api('/api/me', { method: 'PATCH', token, body: { rate: Number($('#m-rate', body).value) } }); toast(t('saved')); loadWorkers(); refresh(); }
        catch (err) { fail(err); }
      };
      $('[data-act=delete]', body).onclick = async () => {
        if (!window.confirm(t('confirm_delete'))) return;
        try { await api('/api/me', { method: 'DELETE', token }); store.del('hoh_wk'); closeModal(); toast(t('deleted')); loadWorkers(); loadStats(); }
        catch (err) { fail(err); }
      };
      $$('[data-act=rc]', body).forEach((btn) => {
        btn.onclick = () => openReasonModal({
          title: t('report_contact'), hint: '',
          onCancel: refresh,
          onSubmit: async (reason) => {
            await api('/api/me/report-contact', { method: 'POST', token, body: { contactId: btn.dataset.id, reason } });
            toast(t('thanks_report')); refresh();
          },
        });
      });
    });
  }

  // ---------- voice search ----------
  function setupVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = $('#btn-voice');
    if (!SR) return;
    btn.hidden = false;
    btn.addEventListener('click', () => {
      try {
        const rec = new SR();
        rec.lang = SPEECH[state.lang] || 'en-IN';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        btn.classList.add('listening');
        rec.onresult = (e) => {
          const text = e.results[0][0].transcript.trim();
          $('#search-input').value = text;
          state.filters.q = text;
          loadWorkers();
        };
        rec.onerror = () => btn.classList.remove('listening');
        rec.onend = () => btn.classList.remove('listening');
        rec.start();
      } catch { btn.classList.remove('listening'); }
    });
  }

  // ---------- events ----------
  function setTradeFilter(trades) {
    state.filters.trades = trades;
    renderChips();
    loadWorkers();
  }

  function bind() {
    $('#lang-select').addEventListener('change', (e) => setLang(e.target.value));
    $('#btn-list').addEventListener('click', openRegister);
    $('#btn-list-hero').addEventListener('click', openRegister);
    $('#btn-manage').addEventListener('click', openManage);
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop') closeModal(); });

    document.addEventListener('keydown', (e) => {
      const open = $('#modal-backdrop').classList.contains('open');
      if (!open) return;
      if (e.key === 'Escape') return closeModal();
      if (e.key === 'Tab') { // keep focus inside the dialog
        const f = $$('#modal button:not([disabled]), #modal input:not([type=hidden]), #modal select, #modal textarea, #modal a[href]').filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    let timer;
    $('#search-input').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.filters.q = e.target.value.trim(); loadWorkers(); }, 250);
    });
    $('#district-select').addEventListener('change', (e) => { state.filters.district = e.target.value; loadWorkers(); });
    $('#sort-select').addEventListener('change', (e) => { state.filters.sort = e.target.value; loadWorkers(); });
    $('#avail-checkbox').addEventListener('change', (e) => { state.filters.avail = e.target.checked; loadWorkers(); });
    $('#verified-checkbox').addEventListener('change', (e) => { state.filters.verified = e.target.checked; loadWorkers(); });

    $('#chip-row').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      const id = chip.dataset.trade;
      const cur = state.filters.trades;
      if (!id || (cur.length === 1 && cur[0] === id)) setTradeFilter([]);
      else setTradeFilter([id]);
    });
    $('#tally-grid').addEventListener('click', (e) => {
      const item = e.target.closest('.tally-item'); if (!item) return;
      state.filters.avail = true; $('#avail-checkbox').checked = true;
      setTradeFilter([item.dataset.trade]);
      $('#grid-section').scrollIntoView({ behavior: 'smooth' });
    });
    $('#season-btn').addEventListener('click', () => {
      state.filters.avail = false; $('#avail-checkbox').checked = false;
      setTradeFilter(state.meta.seasonal.trades.slice());
      $('#grid-section').scrollIntoView({ behavior: 'smooth' });
    });

    $('#cards-container').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === 'reveal') reveal(id);
      else if (btn.dataset.act === 'rate') openRate(id);
      else if (btn.dataset.act === 'report') openReport(id);
    });
  }

  // ---------- init ----------
  async function init() {
    bind();
    setupVoice();
    document.documentElement.lang = state.lang;
    document.documentElement.dir = RTL.has(state.lang) ? 'rtl' : 'ltr';
    $('#lang-select').value = state.lang;
    applyI18n();
    updateDraftBanner();
    $('#cards-container').innerHTML = `<div class="empty-state">${esc(t('loading'))}</div>`;
    try {
      state.meta = await api('/api/meta');
    } catch (e) {
      $('#cards-container').innerHTML = `<div class="empty-state">${esc(errMsg(e))}</div>`;
      return;
    }
    renderDistricts(); renderChips(); renderSeason();
    await Promise.all([loadWorkers(), loadStats()]);
  }

  init();
})();
