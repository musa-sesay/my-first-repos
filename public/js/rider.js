import { api, fill, attempt, brand, gnf, h, icon, itemsLine, LABELS, loginDialog, logoutAndReload, me, poll, switchButton, timeAgo, toast } from './core.js';

const app = document.getElementById('app');
const tabbar = document.querySelector('.tabbar');
let stopPoll = () => {};
let communes = [];

function header(state) {
  return h('div', { class: 'topbar' }, brand('LIVREUR'),
    state && switchButton(state.online ? 'En ligne' : 'Hors ligne', state.online, async () => {
      if (await attempt(() => api('/api/rider/state', { method: 'PATCH', body: { online: !state.online } }))) route();
    }));
}

function jobCard(o, actions) {
  return h('section', { class: 'card stack', style: { '--gap': '10px' } },
    h('div', { class: 'row between' }, h('strong', {}, o.code), h('span', { class: 'small muted' }, timeAgo(o.created_at))),
    h('div', { class: 'row between' },
      h('span', { class: 'display', style: { fontSize: '28px' } }, gnf(o.delivery_fee_gnf)),
      h('span', { class: 'small muted' }, LABELS.status[o.status])),
    h('ol', { class: 'stack', style: { listStyle: 'none', padding: 0, margin: 0, '--gap': '8px' } },
      h('li', {}, h('strong', {}, `Récupérer : ${o.restaurant_name}`), h('div', { class: 'small muted' }, o.restaurant_address)),
      h('li', {}, h('strong', {}, `Livrer : ${o.address}, ${o.commune}`),
        o.landmark && h('div', { class: 'small' }, `Repère : ${o.landmark}`),
        h('div', { class: 'small muted' }, o.payment_method === 'cash' ? `Espèces à encaisser : ${gnf(o.total_gnf)}` : `Déjà payé par ${LABELS.payment[o.payment_method]}`))),
    actions);
}

async function coursesView() {
  const state = await api('/api/rider/state');
  const act = async (o, action, body) => {
    const r = await attempt(() => api(`/api/orders/${o.id}/${action}`, { method: 'POST', body }));
    if (r) route();
    return r;
  };
  const out = [header(state)];
  if (!state.online) {
    const commune = h('select', { id: 'r-commune' }, communes.map((c) => h('option', { selected: c === state.commune }, c)));
    out.push(h('section', { class: 'card stack' },
      h('h1', {}, 'Vous êtes hors ligne'),
      h('p', { class: 'muted' }, 'Passez en ligne pour recevoir des courses. Pensez au casque et au gilet Kassa.'),
      h('label', { class: 'field', for: 'r-commune' }, 'Ma zone', commune),
      h('button', {
        class: 'btn primary block',
        onclick: async () => { if (await attempt(() => api('/api/rider/state', { method: 'PATCH', body: { online: true, commune: commune.value } }))) route(); }
      }, 'Passer en ligne')));
    return out;
  }
  const o = state.current;
  if (o) {
    const call = (tel, label) => h('a', { class: 'btn small', href: `tel:${tel}` }, icon('phone'), label);
    if (o.status !== 'picked_up') {
      out.push(h('span', { class: 'small muted', style: { fontWeight: 700 } }, 'ÉTAPE 1 SUR 2 · RÉCUPÉRER'),
        jobCard(o, [
          h('div', { class: 'small' }, itemsLine(o.items)),
          h('div', { class: 'row' }, call(o.restaurant_phone, 'Restaurant'), call(o.customer_phone, 'Client')),
          o.status === 'ready'
            ? h('button', { class: 'btn dark block', onclick: () => act(o, 'pickup') }, 'J’ai récupéré la commande')
            : h('div', { class: 'notice warn' }, 'Le restaurant prépare la commande. Le bouton s’activera quand elle sera prête.')
        ]));
    } else {
      const code = h('input', { id: 'code', inputmode: 'numeric', maxlength: 4, placeholder: '• • • •', style: { fontSize: '22px', letterSpacing: '10px', textAlign: 'center' } });
      out.push(h('span', { class: 'small muted', style: { fontWeight: 700 } }, 'ÉTAPE 2 SUR 2 · LIVRER'),
        jobCard(o, [
          h('div', { class: 'row' }, call(o.customer_phone, `Appeler ${o.customer_name || 'le client'}`)),
          h('form', {
            class: 'stack',
            onsubmit: async (e) => {
              e.preventDefault();
              if (await act(o, 'deliver', { code: code.value })) toast(`Course terminée : +${gnf(o.delivery_fee_gnf)}`);
            }
          }, h('label', { class: 'field', for: 'code' }, 'Code de remise donné par le client', code),
          h('button', { class: 'btn primary block' }, 'Confirmer la livraison'))
        ]));
    }
  } else {
    out.push(h('h1', { style: { margin: '8px 0' } }, state.open.length ? 'Courses disponibles' : 'En attente de course…'));
    if (!state.open.length) out.push(h('p', { class: 'muted' }, `Zone : ${state.commune || 'non définie'}. Les nouvelles courses apparaissent ici automatiquement.`));
    for (const job of state.open) {
      out.push(jobCard(job, h('button', { class: 'btn primary block', onclick: () => act(job, 'claim') }, 'Accepter la course')));
    }
  }
  stopPoll = poll(async () => {
    const next = await api('/api/rider/state');
    const sig = (s) => JSON.stringify([s.online, s.current?.id, s.current?.status, s.open.map((x) => x.id)]);
    if (sig(next) !== sig(state)) route();
  }, 5000);
  return out;
}

async function gainsView() {
  const e = await api('/api/rider/earnings');
  const max = Math.max(1, ...e.days.map((d) => d.earned));
  return [
    header(null),
    h('h1', {}, 'Mes gains'),
    h('section', { class: 'card stack', style: { background: 'var(--green)', color: '#fff' } },
      h('span', { class: 'small', style: { color: '#CFE5DA' } }, '7 derniers jours'),
      h('span', { class: 'display', style: { fontSize: '34px' } }, gnf(e.week.earned)),
      h('span', { class: 'small', style: { color: '#CFE5DA' } }, `${e.week.trips} course${e.week.trips > 1 ? 's' : ''}`),
      e.days.length > 0 && h('div', { class: 'bars', style: { height: '100px', borderColor: '#5FA88A' }, role: 'img', 'aria-label': 'Gains par jour' },
        e.days.map((d) => h('span', { title: `${d.day} : ${gnf(d.earned)}`, style: { height: `${Math.round((d.earned / max) * 100)}%`, background: '#9FD3BC' } })))),
    h('div', { class: 'grid', style: { '--min': '140px', gap: '10px' } },
      h('div', { class: 'card kpi' }, h('span', { class: 'small muted' }, 'Aujourd’hui'), h('span', { class: 'value' }, gnf(e.today.earned))),
      h('div', { class: 'card kpi' }, h('span', { class: 'small muted' }, 'Courses aujourd’hui'), h('span', { class: 'value' }, e.today.trips))),
    e.today.cash_collected > 0 && h('div', { class: 'notice warn' }, h('strong', {}, `Espèces à remettre : ${gnf(e.today.cash_collected)}`), ' · au point Kassa avant la fin de journée.'),
    h('section', { class: 'card' }, h('h2', {}, 'Dernières courses'),
      e.recent.length ? e.recent.map((r) => h('div', { class: 'list-item' },
        h('span', { class: 'stack grow', style: { '--gap': '2px' } },
          h('strong', {}, `${r.restaurant_name} → ${r.commune}`),
          h('span', { class: 'small muted' }, `${timeAgo(r.delivered_at)} · ${LABELS.payment[r.payment_method]}`)),
        h('strong', {}, gnf(r.earned))))
        : h('p', { class: 'small muted' }, 'Aucune course terminée.')),
    h('button', { class: 'btn danger block', onclick: logoutAndReload }, 'Se déconnecter')
  ];
}

async function route() {
  stopPoll();
  const tab = location.hash.slice(1) === 'gains' ? 'gains' : 'courses';
  let view;
  try {
    view = tab === 'gains' ? await gainsView() : await coursesView();
  } catch (err) {
    view = [h('div', { class: 'notice error', role: 'alert' }, err.message)];
  }
  fill(app, view);
  tabbar.querySelectorAll('a').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

async function start() {
  const session = await me();
  ({ communes } = await api('/api/meta'));
  if (session.user?.role !== 'rider') {
    fill(app, header(null), h('h1', {}, 'App livreur'),
      h('p', { class: 'muted' }, session.user
        ? 'Ce compte n’est pas un compte livreur. Les comptes livreurs sont créés par l’équipe Kassa.'
        : 'Connectez-vous avec le numéro enregistré par l’équipe Kassa.'),
      session.user
        ? h('button', { class: 'btn block', onclick: logoutAndReload }, 'Changer de compte')
        : h('button', { class: 'btn primary block', onclick: async () => { if (await loginDialog({ title: 'Connexion livreur' })) start(); } }, 'Se connecter'));
    return;
  }
  tabbar.hidden = false;
  window.addEventListener('hashchange', route);
  route();
}

start();
