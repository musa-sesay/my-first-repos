import { api, fill, attempt, badge, brand, gnf, h, itemsLine, LABELS, loginDialog, logoutAndReload, me, poll, switchButton, timeAgo, toast } from './core.js';

const side = document.getElementById('side');
const main = document.getElementById('main');
const SECTIONS = [['commandes', 'Commandes'], ['menu', 'Menu'], ['abonnement', 'Abonnement'], ['reglages', 'Réglages']];
let stopPoll = () => {};
let info;

function nav(current) {
  fill(side, 
    h('a', { href: '/pro', class: 'brand' }, brand('PRO')),
    h('div', { class: 'card', style: { background: 'var(--ground)', padding: '12px' } },
      h('strong', {}, info.restaurant.name), h('div', { class: 'small muted' }, `${info.restaurant.address}, ${info.restaurant.commune}`)),
    h('nav', { 'aria-label': 'Espace restaurant' },
      SECTIONS.map(([id, label]) => h('a', { href: `#${id}`, 'aria-current': id === current ? 'page' : null }, label)),
      h('button', { type: 'button', onclick: logoutAndReload }, 'Se déconnecter')));
}

function subscriptionBanner() {
  const s = info.subscription;
  if (s.effective_status === 'trial') {
    const days = Math.max(0, Math.ceil((new Date(s.trial_ends_at.replace(' ', 'T') + 'Z') - Date.now()) / 86400000));
    return h('div', { class: 'notice warn row between' },
      h('span', {}, h('strong', {}, `Essai ${s.plan.name}`), ` · il vous reste ${days} jour${days > 1 ? 's' : ''}.`),
      h('a', { href: '#abonnement' }, 'Gérer l’abonnement'));
  }
  if (s.effective_status === 'past_due') {
    return h('div', { class: 'notice error row between', role: 'alert' },
      h('span', {}, 'Abonnement impayé : votre restaurant n’apparaît plus dans l’app client.'), h('a', { href: '#abonnement' }, 'Régler'));
  }
  if (s.effective_status === 'cancelled') {
    return h('div', { class: 'notice error', role: 'alert' }, 'Abonnement résilié : votre restaurant n’est plus visible des clients. Contactez Kassa pour le réactiver.');
  }
  return null;
}

// --- Orders board ---
async function ordersView() {
  const header = h('div', { class: 'row between' });
  const kpis = h('div', { class: 'grid', style: { '--min': '180px' } });
  const board = h('div', { class: 'kanban' });
  const history = h('div', { class: 'card' });

  const act = async (o, action) => {
    if (action === 'refuse' && !confirm(`Refuser la commande ${o.code} ?`)) return;
    if (await attempt(() => api(`/api/orders/${o.id}/${action}`, { method: 'POST' }))) refresh();
  };

  const card = (o) => h('article', { class: `order-card${o.status === 'pending' ? ' new' : ''}` },
    h('div', { class: 'row between small' }, h('strong', {}, o.code), h('span', { class: 'muted' }, timeAgo(o.created_at))),
    h('strong', {}, itemsLine(o.items)),
    h('span', { class: 'small muted' }, `${o.commune} · ${LABELS.payment[o.payment_method]} · ${gnf(o.subtotal_gnf)}`),
    o.status === 'pending' && h('div', { class: 'grid', style: { '--min': '100px', gap: '8px' } },
      h('button', { class: 'btn small danger', onclick: () => act(o, 'refuse') }, 'Refuser'),
      h('button', { class: 'btn small primary', onclick: () => act(o, 'accept') }, 'Accepter')),
    o.status === 'accepted' && h('button', { class: 'btn small dark', onclick: () => act(o, 'ready') }, 'Marquer comme prête'),
    (o.status === 'ready' || o.status === 'picked_up' || o.status === 'accepted') &&
      h('span', { class: 'small', style: { color: 'var(--blue-ink)' } },
        o.rider_name ? `${o.status === 'picked_up' ? 'En route avec' : 'Livreur :'} ${o.rider_name}` : 'En attente d’un livreur'));

  async function refresh() {
    const [{ orders }, fresh] = await Promise.all([api('/api/partner/orders'), api('/api/partner/restaurant')]);
    info = fresh;
    const r = info.restaurant;
    fill(header, 
      h('h1', {}, 'Commandes'),
      switchButton(r.is_open ? 'Ouvert · reçoit des commandes' : 'Fermé', r.is_open, async () => {
        if (await attempt(() => api('/api/partner/restaurant', { method: 'PATCH', body: { is_open: !r.is_open } }))) refresh();
      }));
    fill(kpis, 
      h('div', { class: 'card kpi' }, h('span', { class: 'small muted' }, 'Commandes aujourd’hui'), h('span', { class: 'value' }, info.today.orders)),
      h('div', { class: 'card kpi' }, h('span', { class: 'small muted' }, 'Ventes aujourd’hui'), h('span', { class: 'value' }, gnf(info.today.sales))));
    const col = (title, statuses) => {
      const list = orders.filter((o) => statuses.includes(o.status));
      return h('section', { 'aria-label': title },
        h('h2', { class: 'row between' }, title, h('span', { class: 'badge', style: { background: '#fff' } }, list.length)),
        list.length ? list.map(card) : h('p', { class: 'small muted' }, 'Rien pour le moment.'));
    };
    fill(board, col('Nouvelles', ['pending']), col('En préparation', ['accepted']), col('Prêtes · livreur', ['ready', 'picked_up']));
  }

  async function loadHistory() {
    const { orders } = await api('/api/partner/orders?scope=history');
    fill(history, h('h2', { style: { marginBottom: '8px' } }, 'Historique'),
      orders.length ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['N°', 'Plats', 'Date', 'Montant', 'Statut'].map((t) => h('th', {}, t)))),
        h('tbody', {}, orders.map((o) => h('tr', {},
          h('td', {}, h('strong', {}, o.code)), h('td', {}, itemsLine(o.items)), h('td', {}, timeAgo(o.created_at)),
          h('td', { class: 'num' }, gnf(o.subtotal_gnf)), h('td', {}, badge(o.status, LABELS.status[o.status])))))))
        : h('p', { class: 'small muted' }, 'Aucune commande terminée.'));
  }

  await Promise.all([refresh(), loadHistory()]);
  stopPoll = poll(refresh, 5000);
  return [subscriptionBanner(), header, kpis, board, history];
}

// --- Menu editor ---
async function menuView() {
  const { dishes } = await api('/api/partner/dishes');
  const plan = info.subscription.plan;
  const list = h('div', { class: 'card stack', style: { '--gap': '0' } });
  const render = () => fill(list, 
    h('div', { class: 'row between', style: { marginBottom: '8px' } }, h('h2', {}, `Vos plats (${dishes.length}${plan.max_dishes ? ` / ${plan.max_dishes}` : ''})`)),
    dishes.length ? dishes.map((d) => h('div', { class: 'list-item' },
      h('span', { class: 'stack grow', style: { '--gap': '2px' } },
        h('strong', {}, d.name), h('span', { class: 'small muted' }, `${d.category} · ${gnf(d.price_gnf)}`)),
      switchButton(d.available ? 'Disponible' : 'Épuisé', d.available, async () => {
        const r = await attempt(() => api(`/api/partner/dishes/${d.id}`, { method: 'PATCH', body: { available: !d.available } }));
        if (r) { Object.assign(d, r.dish); render(); }
      }),
      h('button', { class: 'btn small', onclick: () => edit(d) }, 'Modifier'),
      h('button', {
        class: 'btn small danger', 'aria-label': `Supprimer ${d.name}`,
        onclick: async () => {
          if (!confirm(`Supprimer « ${d.name} » ?`)) return;
          if (await attempt(() => api(`/api/partner/dishes/${d.id}`, { method: 'DELETE' }))) { dishes.splice(dishes.indexOf(d), 1); render(); }
        }
      }, 'Supprimer')))
      : h('p', { class: 'empty' }, 'Ajoutez votre premier plat ci-dessous.'));

  const name = h('input', { id: 'd-name', required: true, maxlength: 80 });
  const desc = h('input', { id: 'd-desc', maxlength: 240 });
  const cat = h('input', { id: 'd-cat', value: 'Plats', list: 'cats', maxlength: 40 });
  const price = h('input', { id: 'd-price', type: 'number', min: 500, step: 500, required: true, inputmode: 'numeric' });
  let editing = null;
  const title = h('h2', {}, 'Ajouter un plat');
  const submit = h('button', { type: 'submit', class: 'btn primary' }, 'Ajouter');
  const cancel = h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => edit(null) }, 'Annuler');
  function edit(d) {
    editing = d;
    name.value = d?.name || ''; desc.value = d?.description || ''; cat.value = d?.category || 'Plats'; price.value = d?.price_gnf || '';
    title.textContent = d ? `Modifier « ${d.name} »` : 'Ajouter un plat';
    submit.textContent = d ? 'Enregistrer' : 'Ajouter';
    cancel.hidden = !d;
    if (d) name.focus();
  }
  const form = h('form', {
    class: 'card stack',
    onsubmit: async (e) => {
      e.preventDefault();
      const body = { name: name.value, description: desc.value, category: cat.value, price_gnf: Number(price.value) };
      const r = await attempt(() => editing
        ? api(`/api/partner/dishes/${editing.id}`, { method: 'PATCH', body })
        : api('/api/partner/dishes', { method: 'POST', body }));
      if (!r) return;
      if (editing) Object.assign(editing, r.dish); else dishes.push(r.dish);
      toast(editing ? 'Plat modifié.' : 'Plat ajouté.');
      edit(null);
      render();
    }
  }, title,
  h('div', { class: 'grid', style: { '--min': '200px' } },
    h('label', { class: 'field', for: 'd-name' }, 'Nom', name),
    h('label', { class: 'field', for: 'd-price' }, 'Prix (GNF)', price),
    h('label', { class: 'field', for: 'd-cat' }, 'Catégorie', cat),
    h('label', { class: 'field', for: 'd-desc' }, 'Description', desc)),
  h('datalist', { id: 'cats' }, ['Plats', 'Boissons', 'Desserts', 'Accompagnements'].map((c) => h('option', { value: c }))),
  h('div', { class: 'row' }, submit, cancel));
  render();
  return [h('h1', {}, 'Menu'), list, form];
}

// --- Subscription & invoices ---
async function billingView() {
  const data = await api('/api/partner/billing');
  const s = data.subscription;
  const priceOf = (p) => (p.monthly_price_gnf === null ? 'Prix à venir' : `${gnf(p.monthly_price_gnf)} / mois`);
  const update = async (body, msg) => {
    if (await attempt(() => api('/api/partner/subscription', { method: 'PATCH', body }))) { toast(msg); route(); }
  };
  return [
    h('h1', {}, 'Abonnement et factures'),
    subscriptionBanner(),
    h('div', { class: 'grid', style: { '--min': '300px' } },
      h('section', { class: 'card stack', style: { background: 'var(--green)', color: '#fff' } },
        h('span', { class: 'small', style: { color: '#CFE5DA' } }, 'Formule actuelle'),
        h('div', { class: 'row between' }, h('span', { class: 'display', style: { fontSize: '32px' } }, s.plan.name),
          badge(s.effective_status, LABELS.sub[s.effective_status])),
        h('span', {}, priceOf(s.plan)),
        h('div', { class: 'grid', style: { '--min': '120px', gap: '10px' } },
          [['Commandes ce mois', data.month.orders], ['Ventes ce mois', gnf(data.month.sales)], ['Commission', gnf(data.month.commission)]]
            .map(([l, v]) => h('div', { class: 'kpi', style: { background: '#08573E', borderRadius: '12px', padding: '12px' } },
              h('span', { class: 'small', style: { color: '#CFE5DA' } }, l), h('strong', {}, v))))),
      h('section', { class: 'card stack' },
        h('h2', {}, 'Paiement de l’abonnement'),
        h('label', { class: 'field', for: 'b-method' }, 'Moyen de paiement',
          h('select', { id: 'b-method', onchange: (e) => update({ billing_method: e.target.value }, 'Moyen de paiement modifié.') },
            ['orange_money', 'mtn_momo', 'card'].map((m) => h('option', { value: m, selected: m === s.billing_method }, LABELS.payment[m])))),
        switchButton('Déduire de mes versements', s.deduct_from_payouts, () =>
          update({ deduct_from_payouts: !s.deduct_from_payouts }, 'Préférence enregistrée.')))),
    h('section', { class: 'card stack' },
      h('h2', {}, 'Changer de formule'),
      h('div', { class: 'grid', style: { '--min': '220px' } }, data.plans.map((p) =>
        h('div', { class: 'card flat stack', style: { borderColor: p.id === s.plan_id ? 'var(--green)' : 'var(--line)', borderWidth: p.id === s.plan_id ? '2px' : '1px' } },
          h('strong', { class: 'display', style: { fontSize: '22px' } }, p.name),
          h('span', {}, priceOf(p)),
          h('span', { class: 'small muted grow' }, p.pitch),
          p.id === s.plan_id
            ? h('span', { class: 'badge s-active', style: { alignSelf: 'flex-start' } }, 'Formule actuelle')
            : h('button', { class: 'btn small', onclick: () => update({ plan_id: p.id }, `Formule ${p.name} choisie.`) }, `Passer à ${p.name}`))))),
    h('section', { class: 'card stack' },
      h('h2', {}, 'Factures'),
      data.invoices.length ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Période', 'Type', 'Montant', 'Statut'].map((t) => h('th', {}, t)))),
        h('tbody', {}, data.invoices.map((i) => h('tr', {},
          h('td', {}, i.period), h('td', {}, i.kind === 'subscription' ? 'Abonnement' : 'Commissions'),
          h('td', { class: 'num' }, gnf(i.amount_gnf)), h('td', {}, badge(i.status, LABELS.invoice[i.status])))))))
        : h('p', { class: 'small muted' }, 'Aucune facture pour le moment.'),
      s.status !== 'cancelled' && h('button', {
        class: 'btn danger small', style: { alignSelf: 'flex-start' },
        onclick: () => confirm('Résilier l’abonnement ? Votre restaurant ne sera plus visible des clients.') && update({ cancel: true }, 'Abonnement résilié.')
      }, 'Résilier l’abonnement'))
  ];
}

// --- Settings ---
function settingsView() {
  const r = info.restaurant;
  const name = h('input', { id: 'r-name', value: r.name, required: true });
  const address = h('input', { id: 'r-address', value: r.address, required: true });
  const fee = h('input', { id: 'r-fee', type: 'number', min: 0, step: 500, value: r.delivery_fee_gnf });
  const prep = h('input', { id: 'r-prep', type: 'number', min: 5, max: 120, value: r.prep_minutes });
  return [h('h1', {}, 'Réglages'), h('form', {
    class: 'card stack',
    onsubmit: async (e) => {
      e.preventDefault();
      const res = await attempt(() => api('/api/partner/restaurant', {
        method: 'PATCH', body: { name: name.value, address: address.value, delivery_fee_gnf: Number(fee.value), prep_minutes: Number(prep.value) }
      }));
      if (res) { info.restaurant = res.restaurant; toast('Réglages enregistrés.'); nav('reglages'); }
    }
  },
  h('div', { class: 'grid', style: { '--min': '220px' } },
    h('label', { class: 'field', for: 'r-name' }, 'Nom du restaurant', name),
    h('label', { class: 'field', for: 'r-address' }, 'Adresse et repère', address),
    h('label', { class: 'field', for: 'r-fee' }, 'Frais de livraison facturés au client (GNF)', fee),
    h('label', { class: 'field', for: 'r-prep' }, 'Temps de préparation moyen (min)', prep)),
  h('button', { class: 'btn primary', style: { alignSelf: 'flex-start' } }, 'Enregistrer'))];
}

async function route() {
  stopPoll();
  const section = location.hash.slice(1) || 'commandes';
  info = await api('/api/partner/restaurant');
  nav(section);
  let view;
  try {
    view = section === 'menu' ? await menuView()
      : section === 'abonnement' ? await billingView()
        : section === 'reglages' ? settingsView()
          : await ordersView();
  } catch (err) {
    view = [h('div', { class: 'notice error', role: 'alert' }, err.message)];
  }
  fill(main, view);
}

async function start() {
  const session = await me();
  if (session.user?.role !== 'owner') {
    fill(side, h('a', { href: '/pro', class: 'brand' }, brand('PRO')));
    fill(main, h('h1', {}, 'Espace restaurant'),
      h('p', { class: 'muted' }, session.user ? 'Ce compte n’a pas de restaurant.' : 'Connectez-vous avec le numéro du gérant.'),
      h('div', { class: 'row' },
        !session.user && h('button', { class: 'btn primary', onclick: async () => { if (await loginDialog({ title: 'Connexion restaurant' })) start(); } }, 'Se connecter'),
        h('a', { class: 'btn', href: '/pro#inscription' }, 'Inscrire un restaurant'),
        session.user && h('button', { class: 'btn', onclick: logoutAndReload }, 'Changer de compte')));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}

start();
