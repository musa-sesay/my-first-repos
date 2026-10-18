// Shared front-end helpers. Every piece of data is inserted with textContent
// (through h()), never innerHTML, so names and notes cannot inject markup.

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined || method !== 'GET' ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : method !== 'GET' ? '{}' : undefined,
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Erreur réseau.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

// Replaces an element's children, skipping false/null like h() does.
export function fill(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6',
  user: 'M12 4a4 4 0 1 0 0.01 0 M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  bike: 'M6 14a3 3 0 1 0 0.01 0 M18 14a3 3 0 1 0 0.01 0 M6 17l5-8h4l3 8 M11 9l-2-4',
  wallet: 'M3 6h18v13H3z M3 10h18 M7 15h3',
  back: 'M15 6l-6 6 6 6',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z M12 7a2.5 2.5 0 1 0 0.01 0',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'
};

export function icon(name, cls = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

export function brand(tagText) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 36 36');
  svg.setAttribute('class', 'brand-mark');
  svg.setAttribute('aria-hidden', 'true');
  const rect = document.createElementNS(SVG_NS, 'rect');
  Object.entries({ width: 36, height: 36, rx: 10, fill: '#F5C518' }).forEach(([k, v]) => rect.setAttribute(k, v));
  const path = document.createElementNS(SVG_NS, 'path');
  Object.entries({ d: 'M11 9v18M11 18l11-9M15 15l9 12', stroke: '#14211B', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' })
    .forEach(([k, v]) => path.setAttribute(k, v));
  svg.append(rect, path);
  return h('span', { class: 'brand' }, svg, h('span', { class: 'brand-name' }, 'kassa'), tagText && h('span', { class: 'tag' }, tagText));
}

export const gnf = (n) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' GNF');

export const LABELS = {
  status: {
    pending: 'Nouvelle', accepted: 'En préparation', ready: 'Prête', picked_up: 'En route',
    delivered: 'Livrée', refused: 'Refusée', cancelled: 'Annulée'
  },
  sub: { trial: 'Essai', active: 'Actif', past_due: 'Impayé', cancelled: 'Résilié' },
  invoice: { due: 'À payer', paid: 'Payée', void: 'Annulée' },
  payment: { orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', cash: 'Espèces', card: 'Carte bancaire' }
};

export const badge = (cls, label) => h('span', { class: `badge s-${cls}` }, label);

export function toast(message, kind = '') {
  const el = h('div', { class: `toast ${kind}`, role: kind === 'error' ? 'alert' : 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}

// Runs fn and reports failures, so every button handler can stay short.
export async function attempt(fn) {
  try {
    return await fn();
  } catch (err) {
    toast(err.message, 'error');
    return undefined;
  }
}

export function timeAgo(sqlDate) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(sqlDate.replace(' ', 'T') + 'Z')) / 60000));
  if (mins < 1) return 'à l’instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `il y a ${hrs} h` : new Date(sqlDate.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR');
}

export function itemsLine(items) {
  return items.map((i) => `${i.qty} × ${i.name}`).join(' · ');
}

export function switchButton(label, checked, onToggle) {
  return h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(!!checked), onclick: onToggle },
    h('span', { class: 'track' }), label);
}

// Polls fn every `ms` while the page is visible. Returns a stop function.
export function poll(fn, ms = 5000) {
  let timer;
  const tick = async () => {
    if (document.visibilityState === 'visible') await fn().catch(() => {});
    timer = setTimeout(tick, ms);
  };
  timer = setTimeout(tick, ms);
  return () => clearTimeout(timer);
}

// Phone + SMS code sign-in. Resolves with the signed-in user.
export function loginDialog({ title = 'Connexion', askName = false } = {}) {
  return new Promise((resolve) => {
    const phone = h('input', { id: 'login-phone', type: 'tel', inputmode: 'numeric', placeholder: '6XX XX XX XX', autocomplete: 'tel' });
    const name = h('input', { id: 'login-name', type: 'text', autocomplete: 'name', placeholder: 'Mariama' });
    const code = h('input', { id: 'login-code', type: 'text', inputmode: 'numeric', maxlength: 6, autocomplete: 'one-time-code', placeholder: '••••••' });
    const hint = h('p', { class: 'small muted', 'aria-live': 'polite' });
    const codeStep = h('div', { class: 'stack', hidden: true },
      h('label', { class: 'field', for: 'login-code' }, 'Code reçu par SMS', code), hint);
    const submit = h('button', { type: 'submit', class: 'btn primary block' }, 'Recevoir mon code');
    let sent = false;
    const form = h('form', {
      method: 'dialog', class: 'stack', style: { '--gap': '16px' },
      onsubmit: async (e) => {
        e.preventDefault();
        submit.disabled = true;
        await attempt(async () => {
          if (!sent) {
            const r = await api('/api/auth/request-code', { method: 'POST', body: { phone: phone.value } });
            sent = true;
            codeStep.hidden = false;
            submit.textContent = 'Valider';
            hint.textContent = r.devCode
              ? `Mode développement : le code est ${r.devCode}.`
              : `Code envoyé au ${r.phone}.`;
            code.focus();
          } else {
            const r = await api('/api/auth/verify', { method: 'POST', body: { phone: phone.value, code: code.value, name: name.value } });
            dlg.close();
            dlg.remove();
            resolve(r.user);
          }
        });
        submit.disabled = false;
      }
    },
    h('h2', { class: 'display', style: { fontSize: '24px' } }, title),
    h('label', { class: 'field', for: 'login-phone' }, 'Numéro de téléphone',
      h('div', { class: 'row', style: { '--gap': '8px', flexWrap: 'nowrap' } },
        h('span', { class: 'btn', style: { pointerEvents: 'none', flex: 'none' } }, '+224'), phone)),
    askName && h('label', { class: 'field', for: 'login-name' }, 'Votre prénom (facultatif)', name),
    codeStep,
    submit,
    h('button', { type: 'button', class: 'btn block', onclick: () => { dlg.close(); dlg.remove(); resolve(null); } }, 'Annuler'));
    const dlg = h('dialog', { 'aria-label': title }, form);
    document.body.append(dlg);
    dlg.showModal();
    phone.focus();
  });
}

export async function me() {
  return api('/api/me');
}

export async function logoutAndReload() {
  await attempt(() => api('/api/auth/logout', { method: 'POST' }));
  location.reload();
}
