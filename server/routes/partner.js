import { Router } from 'express';
import { tx } from '../db.js';
import { requireRole } from '../auth.js';
import { listOrders, present, withItems } from '../orders.js';
import {
  BILLING_METHODS, COMMUNES, HttpError, TRIAL_DAYS, bool, effectiveSubscriptionStatus, int, normalizePhone, oneOf, sqlDate, text
} from '../lib.js';

const ACTIVE = "('pending','accepted','ready','picked_up')";

export function partnerRoutes(db) {
  const r = Router();

  // Sign-up: any signed-in customer can register one restaurant and becomes its owner.
  r.post('/restaurants', requireRole('customer', 'owner'), (req, res) => {
    if (db.prepare('SELECT 1 FROM restaurants WHERE owner_id = ?').get(req.user.id)) {
      throw new HttpError(409, 'Vous avez déjà un restaurant.');
    }
    const b = req.body;
    const fields = {
      name: text(b.name, 'nom du restaurant', { max: 80 }),
      cuisine: text(b.cuisine, 'type de cuisine', { max: 60 }),
      commune: oneOf(b.commune, COMMUNES, 'commune'),
      address: text(b.address, 'quartier et repère', { max: 160 }),
      phone: normalizePhone(b.phone)
    };
    const planId = text(b.plan_id, 'formule', { max: 20 });
    if (!db.prepare('SELECT 1 FROM plans WHERE id = ?').get(planId)) throw new HttpError(400, 'Formule inconnue.');
    const billing = oneOf(b.billing_method || 'orange_money', BILLING_METHODS, 'moyen de paiement');
    const trialEnds = sqlDate(new Date(Date.now() + TRIAL_DAYS * 86400000));

    const id = tx(db, () => {
      const rid = db.prepare(
        'INSERT INTO restaurants (owner_id, name, cuisine, commune, address, phone) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(req.user.id, fields.name, fields.cuisine, fields.commune, fields.address, fields.phone).lastInsertRowid;
      db.prepare(
        `INSERT INTO subscriptions (restaurant_id, plan_id, status, trial_ends_at, billing_method, deduct_from_payouts)
         VALUES (?, ?, 'trial', ?, ?, ?)`
      ).run(rid, planId, trialEnds, billing, bool(b.deduct_from_payouts) ? 1 : 0);
      db.prepare("UPDATE users SET role = 'owner' WHERE id = ?").run(req.user.id);
      return rid;
    });
    res.status(201).json({ restaurant: db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id) });
  });

  // Everything below acts on the signed-in owner's restaurant.
  r.use(requireRole('owner'), (req, _res, next) => {
    req.restaurant = db.prepare('SELECT * FROM restaurants WHERE owner_id = ?').get(req.user.id);
    if (!req.restaurant) return next(new HttpError(404, 'Aucun restaurant.'));
    next();
  });

  const subscriptionOf = (rid) => {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE restaurant_id = ?').get(rid);
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(sub.plan_id);
    return { ...sub, effective_status: effectiveSubscriptionStatus(sub), plan };
  };

  r.get('/restaurant', (req, res) => {
    const rid = req.restaurant.id;
    const today = db.prepare(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(subtotal_gnf), 0) AS sales
       FROM orders WHERE restaurant_id = ? AND status NOT IN ('refused','cancelled') AND date(created_at) = date('now')`
    ).get(rid);
    res.json({ restaurant: req.restaurant, subscription: subscriptionOf(rid), today });
  });

  r.patch('/restaurant', (req, res) => {
    const b = req.body;
    const cur = req.restaurant;
    const next = {
      name: b.name !== undefined ? text(b.name, 'nom', { max: 80 }) : cur.name,
      address: b.address !== undefined ? text(b.address, 'adresse', { max: 160 }) : cur.address,
      is_open: b.is_open !== undefined ? (bool(b.is_open) ? 1 : 0) : cur.is_open,
      delivery_fee_gnf: b.delivery_fee_gnf !== undefined ? int(b.delivery_fee_gnf, 'frais de livraison', { max: 200000 }) : cur.delivery_fee_gnf,
      prep_minutes: b.prep_minutes !== undefined ? int(b.prep_minutes, 'temps de préparation', { min: 5, max: 120 }) : cur.prep_minutes
    };
    db.prepare(
      'UPDATE restaurants SET name = ?, address = ?, is_open = ?, delivery_fee_gnf = ?, prep_minutes = ? WHERE id = ?'
    ).run(next.name, next.address, next.is_open, next.delivery_fee_gnf, next.prep_minutes, cur.id);
    res.json({ restaurant: { ...cur, ...next } });
  });

  // --- Menu ---
  r.get('/dishes', (req, res) => {
    res.json({ dishes: db.prepare('SELECT * FROM dishes WHERE restaurant_id = ? ORDER BY sort, id').all(req.restaurant.id) });
  });

  const dishFields = (b, cur = {}) => ({
    name: b.name !== undefined ? text(b.name, 'nom du plat', { max: 80 }) : cur.name,
    description: b.description !== undefined ? text(b.description, 'description', { max: 240, optional: true }) : cur.description ?? '',
    category: b.category !== undefined ? text(b.category, 'catégorie', { max: 40 }) : cur.category ?? 'Plats',
    price_gnf: b.price_gnf !== undefined ? int(b.price_gnf, 'prix', { min: 500, max: 10_000_000 }) : cur.price_gnf,
    available: b.available !== undefined ? (bool(b.available) ? 1 : 0) : cur.available ?? 1
  });

  r.post('/dishes', (req, res) => {
    const { plan } = subscriptionOf(req.restaurant.id);
    const count = db.prepare('SELECT COUNT(*) AS n FROM dishes WHERE restaurant_id = ?').get(req.restaurant.id).n;
    if (plan.max_dishes && count >= plan.max_dishes) {
      throw new HttpError(409, `La formule ${plan.name} est limitée à ${plan.max_dishes} plats.`);
    }
    const d = dishFields(req.body);
    if (!d.name || !d.price_gnf) throw new HttpError(400, 'Nom et prix requis.');
    const id = db.prepare(
      'INSERT INTO dishes (restaurant_id, name, description, category, price_gnf, available, sort) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(req.restaurant.id, d.name, d.description, d.category, d.price_gnf, d.available, count).lastInsertRowid;
    res.status(201).json({ dish: db.prepare('SELECT * FROM dishes WHERE id = ?').get(id) });
  });

  const ownDish = (req) => {
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ? AND restaurant_id = ?').get(int(req.params.id, 'plat'), req.restaurant.id);
    if (!dish) throw new HttpError(404, 'Plat introuvable.');
    return dish;
  };

  r.patch('/dishes/:id', (req, res) => {
    const cur = ownDish(req);
    const d = dishFields(req.body, cur);
    db.prepare('UPDATE dishes SET name = ?, description = ?, category = ?, price_gnf = ?, available = ? WHERE id = ?')
      .run(d.name, d.description, d.category, d.price_gnf, d.available, cur.id);
    res.json({ dish: { ...cur, ...d } });
  });

  r.delete('/dishes/:id', (req, res) => {
    const cur = ownDish(req);
    if (db.prepare('SELECT 1 FROM order_items WHERE dish_id = ?').get(cur.id)) {
      throw new HttpError(409, 'Ce plat a déjà été commandé : marquez-le comme épuisé plutôt que de le supprimer.');
    }
    db.prepare('DELETE FROM dishes WHERE id = ?').run(cur.id);
    res.json({ ok: true });
  });

  // --- Orders ---
  r.get('/orders', (req, res) => {
    const active = req.query.scope !== 'history';
    const where = active
      ? `o.restaurant_id = ? AND o.status IN ${ACTIVE}`
      : `o.restaurant_id = ? AND o.status NOT IN ${ACTIVE}`;
    const orders = withItems(db, listOrders(db, where, [req.restaurant.id], active ? 100 : 50));
    res.json({ orders: orders.map((o) => present(o, req.user)) });
  });

  // --- Subscription & invoices ---
  r.get('/billing', (req, res) => {
    const rid = req.restaurant.id;
    const month = db.prepare(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(subtotal_gnf), 0) AS sales, COALESCE(SUM(commission_gnf), 0) AS commission
       FROM orders WHERE restaurant_id = ? AND status = 'delivered' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    ).get(rid);
    const invoices = db.prepare('SELECT * FROM invoices WHERE restaurant_id = ? ORDER BY period DESC, kind').all(rid);
    res.json({ subscription: subscriptionOf(rid), month, invoices, plans: db.prepare('SELECT * FROM plans ORDER BY sort').all() });
  });

  r.patch('/subscription', (req, res) => {
    const rid = req.restaurant.id;
    const sub = db.prepare('SELECT * FROM subscriptions WHERE restaurant_id = ?').get(rid);
    const b = req.body;
    let { plan_id: planId, billing_method: billing, deduct_from_payouts: deduct, status } = sub;
    if (b.plan_id !== undefined) {
      planId = text(b.plan_id, 'formule', { max: 20 });
      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
      if (!plan) throw new HttpError(400, 'Formule inconnue.');
      const dishes = db.prepare('SELECT COUNT(*) AS n FROM dishes WHERE restaurant_id = ?').get(rid).n;
      if (plan.max_dishes && dishes > plan.max_dishes) {
        throw new HttpError(409, `Vous avez ${dishes} plats ; la formule ${plan.name} en autorise ${plan.max_dishes}.`);
      }
    }
    if (b.billing_method !== undefined) billing = oneOf(b.billing_method, BILLING_METHODS, 'moyen de paiement');
    if (b.deduct_from_payouts !== undefined) deduct = bool(b.deduct_from_payouts) ? 1 : 0;
    if (b.cancel === true) status = 'cancelled';
    db.prepare('UPDATE subscriptions SET plan_id = ?, billing_method = ?, deduct_from_payouts = ?, status = ? WHERE id = ?')
      .run(planId, billing, deduct, status, sub.id);
    res.json({ subscription: subscriptionOf(rid) });
  });

  return r;
}
