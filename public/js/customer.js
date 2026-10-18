import { api, fill, attempt, badge, brand, gnf, h, icon, itemsLine, LABELS, loginDialog, logoutAndReload, me, poll, timeAgo, toast } from './core.js';

const app = document.getElementById('app');
const TINTS = ['#F7E3B5', '#DCEBDD', '#F5D6CC', '#EFE8D6', '#E8EEF8'];
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }
};

let session = { user: null };
let communes = [];
let stopPoll = () => {};

// --- Cart (kept in this browser only) ---
const emptyCart = () => ({ restaurant_id: null, restaurant_name: '', fee: 0, items: {} });
let cart = store.get('kassa.cart', emptyCart());
const saveCart = () => store.set('kassa.cart', cart);
const cartCount = () => Object.values(cart.items).reduce((n, i) => n + i.qty, 0);
const cartSubtotal = () => Object.values(cart.items).reduce((s, i) => s + i.qty * i.price, 0);

function setQty(restaurant, dish, delta) {
  if (cart.restaurant_id && cart.restaurant_id !== restaurant.id && cartCount() > 0) {
    if (!confirm(`Votre panier contient des plats de ${cart.restaurant_name}. Le vider pour commander chez ${restaurant.name} ?`)) return;
    cart = emptyCart();
  }
  cart.restaurant_id = restaurant.id;
  cart.restaurant_name = restaurant.name;
  cart.fee = restaurant.delivery_fee_gnf;
  const cur = cart.items[dish.id] || { name: dish.name, price: dish.price_gnf, qty: 0 };
  cur.qty = Math.max(0, cur.qty + delta);
  if (cur.qty) cart.items[dish.id] = cur;
  else delete cart.items[dish.id];
  saveCart();
}

async function ensureLogin() {
  if (session.user) return session.user;
  const user = await loginDialog({ title: 'Connectez-vous pour commander', askName: true });
  if (user) session = await me();
  return session.user;
}

function plate(seed) {
  return h('span', { class: 'plate', style: { background: TINTS[seed % TINTS.length] }, 'aria-hidden': 'true' },
    h('span', { style: { width: '40px', height: '40px', borderRadius: '50%', background: '#fff', display: 'block', boxShadow: 'inset 0 0 0 10px rgba(11,110,79,.15)' } }));
}

function backLink(href, label) {
  return h('a', { href, class: 'btn small', 'aria-label': label }, icon('back'), 'Retour');
}

// --- Screens ---
async function home() {
  const commune = store.get('kassa.commune', '');
  const { restaurants } = await api('/api/restaurants' + (commune ? `?commune=${encodeURIComponent(commune)}` : ''));
  const search = h('input', { type: 'search', id: 'q', placeholder: 'Restaurant, cuisine…' });
  const list = h('div');
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const shown = restaurants.filter((r) => !q || (r.name + ' ' + r.cuisine).toLowerCase().includes(q));
    fill(list, ...(shown.length ? shown.map((r) =>
      h('a', { href: `#/r/${r.id}`, class: 'list-item' }, plate(r.id),
        h('span', { class: 'stack grow', style: { '--gap': '4px' } },
          h('span', { class: 'row', style: { '--gap': '8px' } }, h('strong', {}, r.name), r.featured && h('span', { class: 'tag' }, 'PRO')),
          h('span', { class: 'small muted' }, `${r.cuisine} · ${r.commune}`),
          h('span', { class: 'small' }, r.is_open ? `${r.prep_minutes + 15}–${r.prep_minutes + 25} min · livraison ${gnf(r.delivery_fee_gnf)}` : 'Fermé pour le moment')))
    ) : [h('p', { class: 'empty' }, 'Aucun restaurant trouvé.')]));
  };
  search.addEventListener('input', render);
  const select = h('select', { id: 'commune', onchange: (e) => { store.set('kassa.commune', e.target.value); route(); } },
    h('option', { value: '' }, 'Tout Conakry'),
    communes.map((c) => h('option', { value: c, selected: c === commune }, c)));
  render();
  return [
    h('div', { class: 'topbar' }, brand(), session.user && h('span', { class: 'small muted' }, session.user.name || session.user.phone)),
    h('h1', { style: { margin: '12px 0' } }, session.user?.name ? `Bonjour ${session.user.name}, on mange quoi ?` : 'On mange quoi aujourd’hui ?'),
    h('div', { class: 'grid', style: { '--min': '160px', gap: '10px', marginBottom: '8px' } },
      h('label', { class: 'field', for: 'commune' }, 'Livrer à', select),
      h('label', { class: 'field', for: 'q' }, 'Rechercher', search)),
    h('h2', { style: { margin: '16px 0 4px' } }, 'Restaurants'),
    list
  ];
}

async function restaurantScreen(id) {
  const { restaurant: r, dishes } = await api(`/api/restaurants/${id}`);
  const menu = h('div', { class: 'stack' });
  const bar = h('div', { class: 'cartbar' });
  const render = () => {
    const cats = [...new Set(dishes.map((d) => d.category))];
    fill(menu, ...cats.map((cat) => h('section', {},
      h('h2', { style: { margin: '16px 0 4px' } }, cat),
      dishes.filter((d) => d.category === cat).map((d) => {
        const qty = cart.restaurant_id === r.id ? cart.items[d.id]?.qty || 0 : 0;
        const control = !d.available || !r.is_open
          ? h('span', { class: 'small muted' }, d.available ? 'Fermé' : 'Épuisé')
          : qty
            ? h('span', { class: 'qty' },
              h('button', { type: 'button', 'aria-label': `Retirer un ${d.name}`, onclick: () => { setQty(r, d, -1); render(); } }, '−'),
              h('span', { 'aria-live': 'polite' }, qty),
              h('button', { type: 'button', 'aria-label': `Ajouter un ${d.name}`, onclick: () => { setQty(r, d, 1); render(); } }, '+'))
            : h('button', { type: 'button', class: 'add', 'aria-label': `Ajouter ${d.name}`, onclick: () => { setQty(r, d, 1); render(); } }, '+');
        return h('div', { class: 'list-item' },
          h('span', { class: 'stack grow', style: { '--gap': '4px' } },
            h('strong', {}, d.name), d.description && h('span', { class: 'small muted' }, d.description),
            h('span', { style: { color: 'var(--green)', fontWeight: 700 } }, gnf(d.price_gnf))),
          control);
      }))));
    const n = cart.restaurant_id === r.id ? cartCount() : 0;
    bar.hidden = !n;
    fill(bar, h('a', { href: '#/panier' },
      h('span', {}, h('span', { class: 'count' }, n), 'Voir le panier'), h('span', {}, gnf(cartSubtotal()))));
  };
  render();
  return [
    h('div', { class: 'topbar' }, backLink('#/', 'Retour aux restaurants')),
    h('div', { class: 'card stack', style: { '--gap': '6px', background: '#F7E3B5' } },
      h('h1', {}, r.name), h('span', {}, `${r.cuisine} · ${r.address}, ${r.commune}`),
      h('span', { class: 'small' }, `Livraison ${gnf(r.delivery_fee_gnf)} · préparation ~${r.prep_minutes} min`),
      !r.is_open && h('div', { class: 'notice warn' }, 'Ce restaurant est fermé pour le moment.')),
    menu, bar
  ];
}

async function cartScreen() {
  if (!cartCount()) {
    return [h('div', { class: 'topbar' }, backLink('#/', 'Retour')), h('p', { class: 'empty' }, 'Votre panier est vide.')];
  }
  const saved = store.get('kassa.address', {});
  const preferred = saved.commune || store.get('kassa.commune', '');
  const commune = h('select', { id: 'c-commune', required: true },
    h('option', { value: '', disabled: true, selected: !preferred }, 'Choisir votre commune…'),
    communes.map((c) => h('option', { value: c, selected: c === preferred }, c)));
  const address = h('input', { id: 'c-address', required: true, value: saved.address || '', placeholder: 'Quartier (ex. Kipé)' });
  const landmark = h('input', { id: 'c-landmark', value: saved.landmark || '', placeholder: 'Après la pharmacie, portail bleu…' });
  let method = store.get('kassa.payment', 'orange_money');
  const methods = h('div', { class: 'stack', role: 'radiogroup', 'aria-label': 'Moyen de paiement', style: { '--gap': '8px' } });
  const renderMethods = () => fill(methods, ...Object.entries(LABELS.payment).map(([id, label]) =>
    h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(method === id), class: 'btn block',
      style: { justifyContent: 'flex-start', borderWidth: method === id ? '2px' : '1px', borderColor: method === id ? 'var(--green)' : 'var(--line)' },
      onclick: () => { method = id; renderMethods(); }
    }, label, id === 'cash' && h('span', { class: 'small muted' }, '· à la livraison'))));
  renderMethods();
  const lines = Object.entries(cart.items);
  const total = cartSubtotal() + cart.fee;
  const submit = h('button', { type: 'submit', class: 'btn primary block' }, `Commander · ${gnf(total)}`);
  const form = h('form', {
    class: 'stack', style: { '--gap': '14px' },
    onsubmit: async (e) => {
      e.preventDefault();
      if (!(await ensureLogin())) return;
      submit.disabled = true;
      const placed = await attempt(() => api('/api/orders', {
        method: 'POST',
        body: {
          restaurant_id: cart.restaurant_id,
          items: lines.map(([id, i]) => ({ dish_id: Number(id), qty: i.qty })),
          payment_method: method, commune: commune.value, address: address.value, landmark: landmark.value
        }
      }));
      submit.disabled = false;
      if (!placed) return;
      store.set('kassa.address', { commune: commune.value, address: address.value, landmark: landmark.value });
      store.set('kassa.payment', method);
      cart = emptyCart();
      saveCart();
      location.hash = `#/commande/${placed.order.id}`;
    }
  },
  h('section', { class: 'card stack', style: { '--gap': '8px' } },
    h('h2', {}, cart.restaurant_name),
    lines.map(([, i]) => h('div', { class: 'row between' }, h('span', {}, `${i.qty} × ${i.name}`), h('span', {}, gnf(i.qty * i.price)))),
    h('div', { class: 'row between muted' }, h('span', {}, 'Livraison'), h('span', {}, gnf(cart.fee))),
    h('div', { class: 'row between', style: { fontWeight: 700 } }, h('span', {}, 'Total'), h('span', {}, gnf(total)))),
  h('section', { class: 'card stack' },
    h('h2', {}, 'Adresse de livraison'),
    h('label', { class: 'field', for: 'c-commune' }, 'Commune', commune),
    h('label', { class: 'field', for: 'c-address' }, 'Quartier et rue', address),
    h('label', { class: 'field', for: 'c-landmark' }, 'Point de repère pour le livreur', landmark)),
  h('section', { class: 'card stack' }, h('h2', {}, 'Moyen de paiement'), methods,
    method !== 'cash' && h('p', { class: 'small muted' }, 'Le paiement mobile est confirmé par l’équipe Kassa.')),
  submit);
  return [h('div', { class: 'topbar' }, backLink(`#/r/${cart.restaurant_id}`, 'Retour au menu'), h('h1', { style: { fontSize: '22px' } }, 'Votre commande')), form];
}

const STEP_ORDER = ['pending', 'accepted', 'ready', 'picked_up', 'delivered'];

async function trackingScreen(id) {
  const box = h('div', { class: 'stack', style: { '--gap': '14px' } });
  const render = (o) => {
    const idx = STEP_ORDER.indexOf(o.status);
    const ended = o.status === 'refused' || o.status === 'cancelled';
    fill(box, 
      h('div', { class: 'row between' }, h('h1', { style: { fontSize: '24px' } }, `Commande ${o.code}`), badge(o.status, LABELS.status[o.status])),
      !ended && h('ol', { class: 'steps', 'aria-label': 'Avancement' },
        ['Confirmée', 'Préparée', 'En route', 'Livrée'].map((label, i) =>
          h('li', { class: idx > i ? 'done' : '', 'aria-current': idx === i ? 'step' : null }, label))),
      ended && h('div', { class: 'notice error' }, o.status === 'refused' ? 'Le restaurant n’a pas pu accepter votre commande.' : 'Commande annulée.'),
      o.status !== 'delivered' && !ended && h('div', { class: 'card row between', style: { background: 'var(--yellow-soft)' } },
        h('span', { class: 'stack', style: { '--gap': '2px' } }, h('strong', {}, 'Code de remise'), h('span', { class: 'small' }, 'À donner au livreur à la réception')),
        h('span', { class: 'display', style: { fontSize: '28px', letterSpacing: '4px' } }, o.delivery_code)),
      o.rider_name && h('div', { class: 'card row' },
        h('span', { class: 'grow stack', style: { '--gap': '2px' } }, h('strong', {}, o.rider_name), h('span', { class: 'small muted' }, 'Votre livreur')),
        h('a', { class: 'btn small', href: `tel:${o.rider_phone}` }, icon('phone'), 'Appeler')),
      h('section', { class: 'card stack', style: { '--gap': '6px' } },
        h('h2', {}, o.restaurant_name),
        o.items.map((i) => h('div', { class: 'row between' }, h('span', {}, `${i.qty} × ${i.name}`), h('span', {}, gnf(i.qty * i.unit_price_gnf)))),
        h('div', { class: 'row between muted' }, h('span', {}, 'Livraison'), h('span', {}, gnf(o.delivery_fee_gnf))),
        h('div', { class: 'row between', style: { fontWeight: 700 } }, h('span', {}, `Total · ${LABELS.payment[o.payment_method]}`), h('span', {}, gnf(o.total_gnf))),
        h('span', { class: 'small muted' }, `${o.address}, ${o.commune}${o.landmark ? ' · ' + o.landmark : ''}`)),
      o.status === 'pending' && h('button', {
        type: 'button', class: 'btn danger block',
        onclick: async () => { const r = await attempt(() => api(`/api/orders/${o.id}/cancel`, { method: 'POST' })); if (r) render(r.order); }
      }, 'Annuler la commande'));
  };
  render((await api(`/api/orders/${id}`)).order);
  stopPoll = poll(async () => render((await api(`/api/orders/${id}`)).order));
  return [h('div', { class: 'topbar' }, backLink('#/commandes', 'Mes commandes')), box];
}

async function ordersScreen() {
  if (!session.user) {
    return [h('h1', {}, 'Mes commandes'), h('p', { class: 'empty' }, 'Connectez-vous pour voir vos commandes.'),
      h('button', { class: 'btn primary block', onclick: async () => { if (await ensureLogin()) route(); } }, 'Se connecter')];
  }
  const { orders } = await api('/api/orders');
  return [h('h1', { style: { marginBottom: '8px' } }, 'Mes commandes'),
    orders.length ? orders.map((o) => h('a', { href: `#/commande/${o.id}`, class: 'list-item' },
      h('span', { class: 'stack grow', style: { '--gap': '4px' } },
        h('strong', {}, `${o.restaurant_name} · ${o.code}`),
        h('span', { class: 'small muted' }, itemsLine(o.items)),
        h('span', { class: 'small' }, `${timeAgo(o.created_at)} · ${gnf(o.total_gnf)}`)),
      badge(o.status, LABELS.status[o.status])))
      : h('p', { class: 'empty' }, 'Aucune commande pour le moment.')];
}

async function profileScreen() {
  const u = session.user;
  if (!u) {
    return [h('h1', {}, 'Profil'), h('p', { class: 'muted' }, 'Connectez-vous avec votre numéro de téléphone.'),
      h('button', { class: 'btn primary block', onclick: async () => { if (await ensureLogin()) route(); } }, 'Se connecter'),
      h('p', { class: 'small' }, h('a', { href: '/pro' }, 'Vous êtes restaurateur ? Découvrez Kassa Pro'))];
  }
  const name = h('input', { id: 'p-name', value: u.name || '' });
  return [h('h1', {}, 'Profil'),
    h('form', {
      class: 'card stack', onsubmit: async (e) => {
        e.preventDefault();
        if (await attempt(() => api('/api/me', { method: 'PATCH', body: { name: name.value } }))) { session = await me(); toast('Enregistré.'); }
      }
    }, h('span', { class: 'muted' }, u.phone), h('label', { class: 'field', for: 'p-name' }, 'Prénom', name), h('button', { class: 'btn primary' }, 'Enregistrer')),
    h('div', { class: 'stack', style: { marginTop: '16px' } },
      u.role === 'owner' && h('a', { class: 'btn block', href: '/partner' }, 'Mon espace restaurant'),
      u.role === 'rider' && h('a', { class: 'btn block', href: '/rider' }, 'App livreur'),
      u.role === 'admin' && h('a', { class: 'btn block', href: '/admin' }, 'Administration'),
      u.role === 'customer' && h('a', { class: 'btn block', href: '/pro' }, 'Inscrire mon restaurant (Kassa Pro)'),
      h('button', { class: 'btn danger block', onclick: logoutAndReload }, 'Se déconnecter'))];
}

// --- Router ---
async function route() {
  stopPoll();
  const hash = location.hash.replace(/^#/, '') || '/';
  const [, a, b] = hash.split('/');
  let tab = 'home';
  let view;
  try {
    if (a === 'r' && b) view = await restaurantScreen(b);
    else if (a === 'panier') view = await cartScreen();
    else if (a === 'commande' && b) { tab = 'orders'; view = await trackingScreen(b); }
    else if (a === 'commandes') { tab = 'orders'; view = await ordersScreen(); }
    else if (a === 'profil') { tab = 'profile'; view = await profileScreen(); }
    else view = await home();
  } catch (err) {
    view = [h('div', { class: 'notice error', role: 'alert' }, err.message), h('a', { href: '#/', class: 'btn', style: { marginTop: '12px' } }, 'Accueil')];
  }
  fill(app, view);
  document.querySelectorAll('.tabbar a').forEach((el) => {
    if (el.dataset.tab === tab) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

(async () => {
  [session, { communes }] = await Promise.all([me(), api('/api/meta')]);
  window.addEventListener('hashchange', route);
  route();
})();
