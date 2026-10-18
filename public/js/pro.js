import { api, fill, attempt, brand, gnf, h, LABELS, loginDialog, me } from './core.js';

let session = await me();
const [{ plans }, { communes }] = await Promise.all([api('/api/plans'), api('/api/meta')]);
let chosen = new URLSearchParams(location.search).get('formule') || 'pro';

const price = (p) => (p.monthly_price_gnf === null ? 'Prix à venir' : `${gnf(p.monthly_price_gnf)} / mois`);
const commission = (p) => (p.commission_bps === null ? 'commission à venir' : `${(p.commission_bps / 100).toLocaleString('fr-FR')} % par commande`);

fill(document.getElementById('header'), 
  h('a', { href: '/pro', class: 'brand' }, brand('PRO')),
  h('div', { class: 'row' },
    session.user?.role === 'owner'
      ? h('a', { class: 'btn primary', href: '/partner' }, 'Mon espace restaurant')
      : h('a', { class: 'btn primary', href: '#inscription' }, 'Inscription')));

document.getElementById('trial-line').textContent = 'Essai gratuit · sans engagement';

function renderPlans() {
  fill(document.getElementById('plans'), ...plans.map((p) =>
    h('div', { class: `card stack plan${p.id === 'pro' ? ' featured' : ''}`, style: { '--gap': '14px', padding: '26px' } },
      h('div', { class: 'row between' }, h('h3', { class: 'display', style: { fontSize: '26px' } }, p.name),
        p.id === 'pro' && h('span', { class: 'tag', style: { background: 'var(--yellow)', color: 'var(--ink)' } }, 'Le plus choisi')),
      h('p', { class: 'muted' }, p.pitch),
      h('div', { class: 'stack', style: { '--gap': '2px' } },
        h('span', { class: 'display', style: { fontSize: '28px' } }, price(p)),
        h('span', { class: 'small muted' }, commission(p) + (p.max_dishes ? ` · jusqu’à ${p.max_dishes} plats` : ' · plats illimités'))),
      h('a', { class: p.id === 'pro' ? 'btn yellow' : 'btn dark', href: '#inscription', onclick: () => { chosen = p.id; renderSignup(); } }, `Choisir ${p.name}`))));
}

function renderSignup() {
  const box = document.getElementById('signup');
  if (session.user?.role === 'owner') {
    fill(box, h('h2', { class: 'display', style: { fontSize: '26px' } }, 'Votre restaurant est déjà inscrit'),
      h('a', { class: 'btn primary', href: '/partner' }, 'Ouvrir mon espace restaurant'));
    return;
  }
  if (session.user && session.user.role !== 'customer') {
    fill(box, h('div', { class: 'notice warn' }, 'Ce compte est un compte livreur ou administrateur. Utilisez un autre numéro pour inscrire un restaurant.'));
    return;
  }
  const field = (id, label, input) => h('label', { class: 'field', for: id }, label, input);
  const inputs = {
    name: h('input', { id: 's-name', required: true, maxlength: 80, placeholder: 'Chez Fanta' }),
    cuisine: h('select', { id: 's-cuisine' }, ['Cuisine guinéenne', 'Grillades & poisson braisé', 'Fast-food', 'Libanaise', 'Pâtisserie & boulangerie', 'Autre']
      .map((c) => h('option', {}, c))),
    commune: h('select', { id: 's-commune' }, communes.map((c) => h('option', {}, c))),
    address: h('input', { id: 's-address', required: true, maxlength: 160, placeholder: 'Taouyah, près du rond-point' }),
    phone: h('input', { id: 's-phone', required: true, type: 'tel', inputmode: 'numeric', placeholder: '6XX XX XX XX', value: session.user?.phone?.slice(4) || '' }),
    billing: h('select', { id: 's-billing' }, ['orange_money', 'mtn_momo', 'card'].map((m) => h('option', { value: m }, LABELS.payment[m])))
  };
  const planPick = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Formule' },
    plans.map((p) => h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(p.id === chosen),
      onclick: () => { chosen = p.id; renderSignup(); } }, p.name)));
  const submit = h('button', { type: 'submit', class: 'btn primary block' }, session.user ? 'Créer mon espace restaurant' : 'Continuer (connexion par SMS)');
  fill(box, h('form', {
    class: 'stack', style: { '--gap': '16px' },
    onsubmit: async (e) => {
      e.preventDefault();
      if (!session.user) {
        if (!(await loginDialog({ title: 'Connexion du gérant', askName: true }))) return;
        session = await me();
        if (session.user.role !== 'customer') return renderSignup();
      }
      submit.disabled = true;
      const ok = await attempt(() => api('/api/partner/restaurants', {
        method: 'POST',
        body: {
          name: inputs.name.value, cuisine: inputs.cuisine.value, commune: inputs.commune.value,
          address: inputs.address.value, phone: inputs.phone.value, plan_id: chosen, billing_method: inputs.billing.value
        }
      }));
      submit.disabled = false;
      if (ok) location.href = '/partner#menu';
    }
  },
  h('h2', { class: 'display', style: { fontSize: '28px' } }, 'Inscrire mon restaurant'),
  h('p', { class: 'muted' }, 'Environ 5 minutes. Vous ajouterez votre menu juste après.'),
  h('div', { class: 'grid', style: { '--min': '240px' } },
    field('s-name', 'Nom du restaurant', inputs.name), field('s-cuisine', 'Type de cuisine', inputs.cuisine),
    field('s-commune', 'Commune', inputs.commune), field('s-address', 'Quartier et repère', inputs.address),
    field('s-phone', 'Téléphone du restaurant', inputs.phone), field('s-billing', 'Payer l’abonnement par', inputs.billing)),
  h('div', { class: 'stack', style: { '--gap': '8px' } }, h('span', { style: { fontWeight: 700, fontSize: '14px' } }, 'Formule'), planPick),
  submit));
}

renderPlans();
renderSignup();
