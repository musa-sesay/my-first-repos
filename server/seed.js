// Fills an empty database with demo accounts, restaurants and menus.
// Run with `npm run seed`. Prices are sample values, not real ones.
import { openDb, tx } from './db.js';
import { TRIAL_DAYS, sqlDate } from './lib.js';

export const DEMO = {
  admin: '+224620000001',
  customer: '+224620000002',
  riders: [['+224620000011', 'Ibrahima S.'], ['+224620000012', 'Fanta D.']],
  restaurants: [
    {
      owner: '+224620000101', name: 'Chez Fanta', cuisine: 'Cuisine guinéenne', commune: 'Ratoma',
      address: 'Taouyah, près du rond-point', plan: 'pro', fee: 10000,
      dishes: [
        ['Riz sauce arachide', 'Poulet fermier, pâte d’arachide, piment à part', 'Plats', 45000],
        ['Sauce feuille', 'Feuilles de manioc, poisson fumé, huile de palme', 'Plats', 40000],
        ['Poulet yassa', 'Oignons confits, citron, riz blanc', 'Plats', 55000],
        ['Fouti (fonio)', 'Fonio du Fouta, sauce gombo', 'Plats', 42000],
        ['Jus de bissap', 'Fleur d’hibiscus, menthe · 50 cl', 'Boissons', 10000],
        ['Jus de gingembre', 'Gingembre frais, citron · 50 cl', 'Boissons', 10000],
        ['Dégué', 'Couscous de mil, lait caillé sucré', 'Desserts', 15000]
      ]
    },
    {
      owner: '+224620000102', name: 'Le Braisé de Kaloum', cuisine: 'Poisson braisé · Attiéké', commune: 'Kaloum',
      address: 'Almamya, face au port', plan: 'business', fee: 15000,
      dishes: [
        ['Poisson braisé + attiéké', 'Bar entier, oignons, piment', 'Plats', 55000],
        ['Poulet braisé', 'Demi-poulet mariné, frites ou alloco', 'Plats', 50000],
        ['Alloco', 'Banane plantain frite', 'Accompagnements', 12000],
        ['Jus de pain de singe', 'Fruit du baobab · 50 cl', 'Boissons', 12000]
      ]
    },
    {
      owner: '+224620000103', name: 'Saveurs du Fouta', cuisine: 'Fonio · Lait caillé', commune: 'Dixinn',
      address: 'Landréah, derrière l’université', plan: 'essentiel', fee: 12000,
      dishes: [
        ['Fouti sauce gombo', 'Fonio, gombo, viande de bœuf', 'Plats', 42000],
        ['Kansiyé', 'Sauce arachide épaisse, riz', 'Plats', 40000],
        ['Lait caillé', 'Avec sucre et couscous de mil', 'Desserts', 15000]
      ]
    }
  ]
};

export function seed(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return false;
  tx(db, () => {
    const user = db.prepare('INSERT INTO users (phone, name, role) VALUES (?, ?, ?)');
    user.run(DEMO.admin, 'Admin Kassa', 'admin');
    user.run(DEMO.customer, 'Mariama B.', 'customer');
    for (const [phone, name] of DEMO.riders) user.run(phone, name, 'rider');
    const trialEnds = sqlDate(new Date(Date.now() + TRIAL_DAYS * 86400000));
    for (const r of DEMO.restaurants) {
      const ownerId = user.run(r.owner, `Gérant ${r.name}`, 'owner').lastInsertRowid;
      const rid = db.prepare(
        'INSERT INTO restaurants (owner_id, name, cuisine, commune, address, phone, delivery_fee_gnf) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(ownerId, r.name, r.cuisine, r.commune, r.address, r.owner, r.fee).lastInsertRowid;
      db.prepare(
        "INSERT INTO subscriptions (restaurant_id, plan_id, status, trial_ends_at) VALUES (?, ?, ?, ?)"
      ).run(rid, r.plan, r.plan === 'pro' ? 'trial' : 'active', r.plan === 'pro' ? trialEnds : null);
      const dish = db.prepare(
        'INSERT INTO dishes (restaurant_id, name, description, category, price_gnf, sort) VALUES (?, ?, ?, ?, ?, ?)'
      );
      r.dishes.forEach(([name, desc, cat, price], i) => dish.run(rid, name, desc, cat, price, i));
    }
  });
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb();
  if (seed(db)) {
    console.log('Données de démonstration créées. Comptes (connexion par code SMS, affiché en mode développement) :');
    console.log(`  Admin     ${DEMO.admin}`);
    console.log(`  Client    ${DEMO.customer}`);
    console.log(`  Livreurs  ${DEMO.riders.map(([p]) => p).join(', ')}`);
    console.log(`  Restaurants ${DEMO.restaurants.map((r) => `${r.name} ${r.owner}`).join(' · ')}`);
  } else {
    console.log('La base contient déjà des données : rien à faire.');
  }
}
