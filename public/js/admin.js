import { api, fill, attempt, badge, brand, gnf, h, itemsLine, LABELS, loginDialog, logoutAndReload, me, poll, timeAgo, toast } from './core.js';

const side = document.getElementById('side');
const main = document.getElementById('main');
const SECTIONS = [
  ['apercu', 'Vue d’ensemble'], ['commandes', 'Commandes'], ['livreurs', 'Livreurs'],
  ['restaurants', 'Restaurants & abonnements'], ['formules', 'Formules & tarifs'], ['factures', 'Factures']
];
let stopPoll = () => {};

const table = (heads, rows) => h('div', { class: 'table-wrap' }, h('table', {},
  h('thead', {}, h('tr', {}, heads.map((t) => h('th', { class: t.num ? 'num' : '' }, t.label ?? t)))),
  h('tbody', {}, rows)));
const kpi = (label, value, note) => h('div', { class: 'card kpi' },
  h('span', { class: 'small muted' }, label), h('span', { class: 'value' }, value), note && h('span', { class: 'small muted' }, note));

function hbars(rows) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return rows.length
    ? rows.map((r) => h('div', { class: 'hbar', title: `${r.label} : ${r.n}` },
      h('span', { class: 'small' }, r.label),
      h('span', { class: 'track' }, h('span', { class: 'fill', style: { display: 'block', width: `${(r.n / max) * 100}%` } })),
      h('strong', { class: 'num' }, r.n)))
    : h('p', { class: 'small muted' }, 'Pas encore de données aujourd’hui.');
}

async function overview() {
  const d = await api('/api/admin/overview');
  const hours = Array.from({ length: 17 }, (_, i) => i + 7);
  const counts = Object.fromEntries(d.byHour.map((x) => [x.hour, x.n]));
  const max = Math.max(1, ...Object.values(counts));
  return [
    h('h1', {}, 'Vue d’ensemble'),
    d.alerts.waiting_for_rider > 0 && h('div', { class: 'notice error row between', role: 'alert' },
      h('span', {}, h('strong', {}, `${d.alerts.waiting_for_rider} commande(s) sans livreur depuis plus de 10 min.`)),
      h('a', { href: '#commandes/no_rider' }, 'Assigner')),
    h('div', { class: 'grid', style: { '--min': '190px' } },
      kpi('Commandes aujourd’hui', d.kpis.orders),
      kpi('Chiffre d’affaires', gnf(d.kpis.revenue), 'hors commandes annulées'),
      kpi('Livreurs en ligne', `${d.riders.online} / ${d.riders.total}`),
      kpi('Temps moyen de livraison', d.kpis.avg_delivery_min ? `${Math.round(d.kpis.avg_delivery_min)} min` : '—'),
      kpi('Annulées ou refusées', d.kpis.cancelled)),
    h('div', { class: 'grid', style: { '--min': '380px' } },
      h('section', { class: 'card stack' }, h('h2', {}, 'Commandes par heure (aujourd’hui)'),
        h('div', { class: 'bars', role: 'img', 'aria-label': 'Commandes par heure' },
          hours.map((hr) => h('span', { title: `${hr} h : ${counts[hr] || 0} commande(s)`, style: { height: `${((counts[hr] || 0) / max) * 100}%` } }))),
        h('div', { class: 'row between small muted' }, h('span', {}, '7 h'), h('span', {}, '15 h'), h('span', {}, '23 h'))),
      h('section', { class: 'card stack' }, h('h2', {}, 'Par commune'), hbars(d.byCommune.map((x) => ({ label: x.commune, n: x.n }))),
        h('h2', { style: { marginTop: '8px' } }, 'Moyens de paiement'), hbars(d.byPayment.map((x) => ({ label: LABELS.payment[x.payment_method], n: x.n }))))),
    h('section', { class: 'card stack' },
      h('div', { class: 'row between' }, h('h2', {}, 'Commandes récentes'), h('a', { href: '#commandes' }, 'Toutes les commandes')),
      d.recent.length ? table(['N°', 'Client', 'Restaurant', 'Commune', { label: 'Montant', num: true }, 'Statut'],
        d.recent.map((o) => h('tr', {}, h('td', {}, h('strong', {}, o.code)), h('td', {}, o.customer_name || o.customer_phone),
          h('td', {}, o.restaurant_name), h('td', {}, o.commune), h('td', { class: 'num' }, gnf(o.total_gnf)),
          h('td', {}, badge(o.status, LABELS.status[o.status])))))
        : h('p', { class: 'small muted' }, 'Aucune commande.'))
  ];
}

async function ordersView(filter = '') {
  const [{ orders }, { riders }] = await Promise.all([
    api('/api/admin/orders' + (filter ? `?status=${filter}` : '')), api('/api/admin/riders')
  ]);
  const filters = [['', 'Toutes'], ['no_rider', 'Sans livreur'], ['pending', 'Nouvelles'], ['accepted', 'En préparation'],
    ['ready', 'Prêtes'], ['picked_up', 'En route'], ['delivered', 'Livrées'], ['cancelled', 'Annulées']];
  const act = async (o, action, body) => {
    if (await attempt(() => api(`/api/orders/${o.id}/${action}`, { method: 'POST', body }))) { toast('Commande mise à jour.'); route(); }
  };
  return [
    h('div', { class: 'row between' }, h('h1', {}, 'Commandes'), h('button', { class: 'btn small', onclick: route }, 'Actualiser')),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrer par statut' },
      filters.map(([id, label]) => h('a', { class: 'chip', href: `#commandes${id ? '/' + id : ''}`, 'aria-pressed': String(id === filter),
        style: { display: 'inline-flex', alignItems: 'center', textDecoration: 'none' } }, label))),
    orders.length ? orders.map((o) => {
      const assign = h('select', { 'aria-label': `Livreur pour ${o.code}` },
        h('option', { value: '' }, 'Choisir un livreur…'),
        riders.map((r) => h('option', { value: r.id, disabled: !!r.current_order && r.id !== o.rider_id, selected: r.id === o.rider_id },
          `${r.name} · ${r.online ? 'en ligne' : 'hors ligne'}${r.current_order ? ` · ${r.current_order}` : ''}`)));
      const canAssign = ['pending', 'accepted', 'ready'].includes(o.status);
      return h('article', { class: 'card stack', style: { '--gap': '10px' } },
        h('div', { class: 'row between' }, h('strong', { class: 'display', style: { fontSize: '20px' } }, o.code),
          h('span', { class: 'row', style: { '--gap': '8px' } }, badge(o.status, LABELS.status[o.status]),
            badge(o.payment_status, o.payment_status === 'paid' ? 'Payée' : 'Non payée'))),
        h('div', { class: 'grid', style: { '--min': '220px' } },
          h('div', { class: 'stack', style: { '--gap': '2px' } }, h('span', { class: 'small muted' }, 'Restaurant'), h('strong', {}, o.restaurant_name), h('span', { class: 'small' }, itemsLine(o.items))),
          h('div', { class: 'stack', style: { '--gap': '2px' } }, h('span', { class: 'small muted' }, 'Client'), h('strong', {}, o.customer_name || '—'), h('span', { class: 'small' }, o.customer_phone)),
          h('div', { class: 'stack', style: { '--gap': '2px' } }, h('span', { class: 'small muted' }, 'Livraison'), h('strong', {}, `${o.address}, ${o.commune}`), o.landmark && h('span', { class: 'small' }, `Repère : ${o.landmark}`)),
          h('div', { class: 'stack', style: { '--gap': '2px' } }, h('span', { class: 'small muted' }, 'Total'), h('strong', {}, gnf(o.total_gnf)), h('span', { class: 'small' }, `${LABELS.payment[o.payment_method]} · ${timeAgo(o.created_at)}`))),
        h('div', { class: 'row' },
          canAssign && assign,
          canAssign && h('button', { class: 'btn small primary', onclick: () => assign.value && act(o, 'assign', { rider_id: Number(assign.value) }) }, 'Assigner'),
          !canAssign && o.rider_name && h('span', { class: 'small' }, `Livreur : ${o.rider_name}`),
          o.payment_status === 'unpaid' && o.payment_method !== 'cash' && !['refused', 'cancelled'].includes(o.status) &&
            h('button', { class: 'btn small', onclick: () => confirm(`Confirmer le paiement ${LABELS.payment[o.payment_method]} de ${o.code} ?`) && act(o, 'mark_paid') }, 'Marquer comme payée'),
          !['delivered', 'refused', 'cancelled'].includes(o.status) &&
            h('button', { class: 'btn small danger', style: { marginLeft: 'auto' }, onclick: () => confirm(`Annuler ${o.code} ?`) && act(o, 'cancel') }, 'Annuler')));
    }) : h('p', { class: 'empty' }, 'Aucune commande.')
  ];
}

async function ridersView() {
  const { riders } = await api('/api/admin/riders');
  const phone = h('input', { id: 'rd-phone', type: 'tel', required: true, placeholder: '6XX XX XX XX' });
  const name = h('input', { id: 'rd-name', required: true });
  return [
    h('h1', {}, 'Livreurs'),
    h('section', { class: 'card' }, riders.length ? table(['Nom', 'Téléphone', 'Statut', 'Zone', 'Course en cours'],
      riders.map((r) => h('tr', {}, h('td', {}, h('strong', {}, r.name)), h('td', {}, r.phone),
        h('td', {}, badge(r.online ? 'active' : 'cancelled', r.online ? 'En ligne' : 'Hors ligne')), h('td', {}, r.commune || '—'), h('td', {}, r.current_order || '—'))))
      : h('p', { class: 'small muted' }, 'Aucun livreur.')),
    h('form', {
      class: 'card stack',
      onsubmit: async (e) => {
        e.preventDefault();
        if (await attempt(() => api('/api/admin/riders', { method: 'POST', body: { phone: phone.value, name: name.value } }))) { toast('Livreur ajouté.'); route(); }
      }
    }, h('h2', {}, 'Ajouter un livreur'),
    h('p', { class: 'small muted' }, 'Le livreur se connecte ensuite sur /rider avec ce numéro.'),
    h('div', { class: 'grid' }, h('label', { class: 'field', for: 'rd-name' }, 'Nom', name), h('label', { class: 'field', for: 'rd-phone' }, 'Téléphone', phone)),
    h('button', { class: 'btn primary', style: { alignSelf: 'flex-start' } }, 'Ajouter'))
  ];
}

async function restaurantsView() {
  const [{ restaurants }, sum, { plans }] = await Promise.all([
    api('/api/admin/restaurants'), api('/api/admin/subscriptions/summary'), api('/api/plans')
  ]);
  const setSub = async (r, body) => {
    if (await attempt(() => api(`/api/admin/restaurants/${r.id}/subscription`, { method: 'PATCH', body }))) { toast('Abonnement mis à jour.'); route(); }
  };
  return [
    h('h1', {}, 'Restaurants & abonnements'),
    sum.unpriced_plans > 0 && h('div', { class: 'notice warn row between' },
      h('span', {}, `${sum.unpriced_plans} formule(s) sans prix : le revenu mensuel ne les compte pas.`), h('a', { href: '#formules' }, 'Définir les prix')),
    h('div', { class: 'grid', style: { '--min': '170px' } },
      kpi('Revenu mensuel récurrent', gnf(sum.mrr), 'abonnements actifs'),
      kpi('Actifs', sum.counts.active), kpi('En essai', sum.counts.trial),
      kpi('Impayés', sum.counts.past_due, `${sum.unpaid.n} facture(s) · ${gnf(sum.unpaid.amount)}`),
      kpi('Résiliés', sum.counts.cancelled)),
    h('section', { class: 'card' }, table(['Restaurant', 'Formule', 'Statut', 'Fin d’essai', 'À payer', 'Actions'],
      restaurants.map((r) => h('tr', {},
        h('td', {}, h('strong', {}, r.name), h('div', { class: 'small muted' }, `${r.commune} · ${r.phone}`)),
        h('td', {}, h('select', { 'aria-label': `Formule de ${r.name}`, onchange: (e) => setSub(r, { plan_id: e.target.value }) },
          plans.map((p) => h('option', { value: p.id, selected: p.id === r.plan_id }, p.name)))),
        h('td', {}, badge(r.effective_status, LABELS.sub[r.effective_status])),
        h('td', {}, r.trial_ends_at ? r.trial_ends_at.slice(0, 10) : '—'),
        h('td', { class: 'num' }, r.invoices_due ? gnf(r.amount_due) : '—'),
        h('td', {}, h('div', { class: 'row', style: { '--gap': '6px' } },
          r.effective_status !== 'active' && h('button', { class: 'btn small primary', onclick: () => setSub(r, { status: 'active' }) }, 'Activer'),
          r.effective_status === 'active' && h('button', { class: 'btn small', onclick: () => setSub(r, { status: 'past_due' }) }, 'Suspendre'),
          r.status !== 'cancelled' && h('button', { class: 'btn small danger', onclick: () => confirm(`Résilier ${r.name} ?`) && setSub(r, { status: 'cancelled' }) }, 'Résilier'))))))),
  ];
}

async function plansView() {
  const { plans } = await api('/api/plans');
  return [
    h('h1', {}, 'Formules & tarifs'),
    h('p', { class: 'muted' }, 'Ces prix s’affichent sur le site Kassa Pro et servent à la facturation. Laissez vide tant qu’un prix n’est pas décidé.'),
    h('div', { class: 'grid', style: { '--min': '280px' } }, plans.map((p) => {
      const price = h('input', { id: `pp-${p.id}`, type: 'number', min: 0, step: 1000, value: p.monthly_price_gnf ?? '' });
      const pct = h('input', { id: `pc-${p.id}`, type: 'number', min: 0, max: 50, step: 0.5, value: p.commission_bps === null ? '' : p.commission_bps / 100 });
      const dishes = h('input', { id: `pd-${p.id}`, type: 'number', min: 1, value: p.max_dishes ?? '', placeholder: 'Illimité' });
      return h('form', {
        class: 'card stack',
        onsubmit: async (e) => {
          e.preventDefault();
          const body = {
            monthly_price_gnf: price.value === '' ? null : Number(price.value),
            commission_bps: pct.value === '' ? null : Math.round(Number(pct.value) * 100),
            max_dishes: dishes.value === '' ? null : Number(dishes.value)
          };
          if (await attempt(() => api(`/api/admin/plans/${p.id}`, { method: 'PUT', body }))) toast(`${p.name} enregistrée.`);
        }
      }, h('h2', { class: 'display', style: { fontSize: '24px' } }, p.name), h('p', { class: 'small muted' }, p.pitch),
      h('label', { class: 'field', for: `pp-${p.id}` }, 'Prix mensuel (GNF)', price),
      h('label', { class: 'field', for: `pc-${p.id}` }, 'Commission par commande (%)', pct),
      h('label', { class: 'field', for: `pd-${p.id}` }, 'Nombre maximum de plats', dishes),
      h('button', { class: 'btn primary' }, 'Enregistrer'));
    }))
  ];
}

async function invoicesView() {
  const { invoices } = await api('/api/admin/invoices');
  const period = h('input', { id: 'inv-period', type: 'month', value: new Date().toISOString().slice(0, 7), required: true });
  return [
    h('h1', {}, 'Factures'),
    h('form', {
      class: 'card row',
      onsubmit: async (e) => {
        e.preventDefault();
        const r = await attempt(() => api('/api/admin/invoices/generate', { method: 'POST', body: { period: period.value } }));
        if (r) { toast(`${r.created} facture(s) créée(s) pour ${r.period}.`); route(); }
      }
    }, h('label', { class: 'field grow', for: 'inv-period' }, 'Période', period),
    h('button', { class: 'btn primary', style: { alignSelf: 'flex-end' } }, 'Générer les factures du mois'),
    h('p', { class: 'small muted', style: { flexBasis: '100%' } }, 'Abonnement des restaurants actifs ou impayés, plus la commission sur leurs commandes livrées du mois. Relancer ne crée pas de doublon.')),
    h('section', { class: 'card' }, invoices.length ? table(['Restaurant', 'Période', 'Type', { label: 'Montant', num: true }, 'Statut', ''],
      invoices.map((i) => h('tr', {}, h('td', {}, h('strong', {}, i.restaurant_name)), h('td', {}, i.period),
        h('td', {}, i.kind === 'subscription' ? 'Abonnement' : 'Commissions'), h('td', { class: 'num' }, gnf(i.amount_gnf)),
        h('td', {}, badge(i.status, LABELS.invoice[i.status])),
        h('td', {}, i.status === 'due' && h('button', {
          class: 'btn small',
          onclick: async () => { if (confirm('Marquer cette facture comme payée ?') && await attempt(() => api(`/api/admin/invoices/${i.id}/pay`, { method: 'POST' }))) route(); }
        }, 'Marquer payée')))))
      : h('p', { class: 'small muted' }, 'Aucune facture. Définissez les prix des formules puis générez les factures du mois.'))
  ];
}

async function route() {
  stopPoll();
  const [section, arg] = (location.hash.slice(1) || 'apercu').split('/');
  fill(side, h('span', { class: 'row' }, brand(), h('span', { class: 'tag', style: { background: '#9FD3BC', color: 'var(--night)' } }, 'ADMIN')),
    h('nav', { 'aria-label': 'Administration' },
      SECTIONS.map(([id, label]) => h('a', { href: `#${id}`, 'aria-current': id === section ? 'page' : null }, label)),
      h('button', { type: 'button', onclick: logoutAndReload }, 'Se déconnecter')));
  let view;
  try {
    view = section === 'commandes' ? await ordersView(arg || '')
      : section === 'livreurs' ? await ridersView()
        : section === 'restaurants' ? await restaurantsView()
          : section === 'formules' ? await plansView()
            : section === 'factures' ? await invoicesView()
              : await overview();
  } catch (err) {
    view = [h('div', { class: 'notice error', role: 'alert' }, err.message)];
  }
  fill(main, view);
  if (section === 'apercu') stopPoll = poll(async () => route(), 30000);
}

async function start() {
  const session = await me();
  if (session.user?.role !== 'admin') {
    fill(side, brand());
    fill(main, h('h1', {}, 'Administration Kassa'),
      h('p', { class: 'muted' }, session.user ? 'Ce compte n’a pas accès à l’administration.' : 'Connectez-vous avec un numéro administrateur.'),
      session.user
        ? h('button', { class: 'btn', onclick: logoutAndReload }, 'Changer de compte')
        : h('button', { class: 'btn primary', onclick: async () => { if (await loginDialog({ title: 'Connexion administrateur' })) start(); } }, 'Se connecter'));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}

start();
