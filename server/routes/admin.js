import { Router } from 'express';
import { requireRole } from '../auth.js';
import { listOrders, present, withItems } from '../orders.js';
import { HttpError, effectiveSubscriptionStatus, int, normalizePhone, oneOf, text } from '../lib.js';

const ORDER_STATUSES = ['pending', 'accepted', 'ready', 'picked_up', 'delivered', 'refused', 'cancelled'];
const SUB_STATUSES = ['trial', 'active', 'past_due', 'cancelled'];

export function adminRoutes(db) {
  const r = Router();
  r.use(requireRole('admin'));

  r.get('/overview', (_req, res) => {
    const today = "date(o.created_at) = date('now')";
    const kpis = db.prepare(
      `SELECT COUNT(*) AS orders,
              COALESCE(SUM(CASE WHEN status NOT IN ('refused','cancelled') THEN total_gnf END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN status IN ('refused','cancelled') THEN 1 ELSE 0 END), 0) AS cancelled,
              AVG(CASE WHEN status = 'delivered' THEN (julianday(delivered_at) - julianday(created_at)) * 1440 END) AS avg_delivery_min
       FROM orders o WHERE ${today}`
    ).get();
    const riders = db.prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(rs.online), 0) AS online
       FROM users u LEFT JOIN rider_status rs ON rs.user_id = u.id WHERE u.role = 'rider'`
    ).get();
    const byHour = db.prepare(
      `SELECT CAST(strftime('%H', o.created_at) AS INTEGER) AS hour, COUNT(*) AS n FROM orders o WHERE ${today} GROUP BY hour`
    ).all();
    const byCommune = db.prepare(
      `SELECT o.commune, COUNT(*) AS n FROM orders o WHERE ${today} GROUP BY o.commune ORDER BY n DESC`
    ).all();
    const byPayment = db.prepare(
      `SELECT o.payment_method, COUNT(*) AS n FROM orders o WHERE ${today} GROUP BY o.payment_method ORDER BY n DESC`
    ).all();
    const waiting = db.prepare(
      `SELECT COUNT(*) AS n FROM orders WHERE rider_id IS NULL AND status IN ('accepted','ready')
       AND updated_at < datetime('now', '-10 minutes')`
    ).get().n;
    const recent = listOrders(db, '1', [], 8).map((o) => present(o, { role: 'admin' }));
    res.json({ kpis, riders, byHour, byCommune, byPayment, alerts: { waiting_for_rider: waiting }, recent });
  });

  // --- Orders & dispatch ---
  r.get('/orders', (req, res) => {
    const status = req.query.status;
    const orders = status === 'no_rider'
      ? listOrders(db, "o.rider_id IS NULL AND o.status IN ('pending','accepted','ready')")
      : status
        ? listOrders(db, 'o.status = ?', [oneOf(status, ORDER_STATUSES, 'statut')])
        : listOrders(db);
    res.json({ orders: withItems(db, orders).map((o) => present(o, req.user)) });
  });

  r.get('/riders', (_req, res) => {
    const riders = db.prepare(
      `SELECT u.id, u.name, u.phone, COALESCE(rs.online, 0) AS online, rs.commune,
              (SELECT code FROM orders WHERE rider_id = u.id AND status IN ('accepted','ready','picked_up') LIMIT 1) AS current_order
       FROM users u LEFT JOIN rider_status rs ON rs.user_id = u.id WHERE u.role = 'rider' ORDER BY online DESC, u.name`
    ).all();
    res.json({ riders: riders.map((x) => ({ ...x, online: !!x.online })) });
  });

  r.post('/riders', (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const name = text(req.body.name, 'nom', { max: 80 });
    const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (existing && existing.role !== 'customer' && existing.role !== 'rider') {
      throw new HttpError(409, 'Ce numéro appartient déjà à un restaurant ou un administrateur.');
    }
    if (existing) db.prepare("UPDATE users SET role = 'rider', name = ? WHERE id = ?").run(name, existing.id);
    else db.prepare("INSERT INTO users (phone, name, role) VALUES (?, ?, 'rider')").run(phone, name);
    res.status(201).json({ rider: db.prepare('SELECT id, name, phone, role FROM users WHERE phone = ?').get(phone) });
  });

  // --- Restaurants & subscriptions ---
  r.get('/restaurants', (_req, res) => {
    const rows = db.prepare(
      `SELECT r.id, r.name, r.commune, r.phone, r.is_open, r.created_at,
              s.plan_id, s.status, s.trial_ends_at, s.billing_method, s.deduct_from_payouts,
              p.name AS plan_name,
              (SELECT COUNT(*) FROM invoices i WHERE i.restaurant_id = r.id AND i.status = 'due') AS invoices_due,
              (SELECT COALESCE(SUM(amount_gnf), 0) FROM invoices i WHERE i.restaurant_id = r.id AND i.status = 'due') AS amount_due
       FROM restaurants r JOIN subscriptions s ON s.restaurant_id = r.id JOIN plans p ON p.id = s.plan_id ORDER BY r.name`
    ).all();
    res.json({ restaurants: rows.map((x) => ({ ...x, effective_status: effectiveSubscriptionStatus(x) })) });
  });

  r.patch('/restaurants/:id/subscription', (req, res) => {
    const id = int(req.params.id, 'restaurant');
    const sub = db.prepare('SELECT * FROM subscriptions WHERE restaurant_id = ?').get(id);
    if (!sub) throw new HttpError(404, 'Restaurant introuvable.');
    const status = req.body.status !== undefined ? oneOf(req.body.status, SUB_STATUSES, 'statut') : sub.status;
    const planId = req.body.plan_id !== undefined ? text(req.body.plan_id, 'formule', { max: 20 }) : sub.plan_id;
    if (!db.prepare('SELECT 1 FROM plans WHERE id = ?').get(planId)) throw new HttpError(400, 'Formule inconnue.');
    db.prepare('UPDATE subscriptions SET status = ?, plan_id = ? WHERE id = ?').run(status, planId, sub.id);
    res.json({ subscription: db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(sub.id) });
  });

  r.get('/subscriptions/summary', (_req, res) => {
    const subs = db.prepare(
      'SELECT s.*, p.monthly_price_gnf FROM subscriptions s JOIN plans p ON p.id = s.plan_id'
    ).all().map((s) => ({ ...s, effective: effectiveSubscriptionStatus(s) }));
    const count = (st) => subs.filter((s) => s.effective === st).length;
    const mrr = subs.filter((s) => s.effective === 'active').reduce((t, s) => t + (s.monthly_price_gnf || 0), 0);
    const byPlan = db.prepare(
      `SELECT p.id, p.name, COUNT(s.id) AS n FROM plans p LEFT JOIN subscriptions s ON s.plan_id = p.id
       AND s.status != 'cancelled' GROUP BY p.id ORDER BY p.sort`
    ).all();
    const unpaid = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(amount_gnf), 0) AS amount FROM invoices WHERE status = 'due'").get();
    const unpriced = db.prepare('SELECT COUNT(*) AS n FROM plans WHERE monthly_price_gnf IS NULL').get().n;
    res.json({
      mrr, unpriced_plans: unpriced,
      counts: { active: count('active'), trial: count('trial'), past_due: count('past_due'), cancelled: count('cancelled') },
      byPlan, unpaid
    });
  });

  r.put('/plans/:id', (req, res) => {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
    if (!plan) throw new HttpError(404, 'Formule inconnue.');
    const price = int(req.body.monthly_price_gnf, 'prix', { min: 0, max: 100_000_000, optional: true });
    const bps = int(req.body.commission_bps, 'commission', { min: 0, max: 5000, optional: true });
    const maxDishes = req.body.max_dishes !== undefined
      ? int(req.body.max_dishes, 'nombre de plats', { min: 1, max: 10000, optional: true })
      : plan.max_dishes;
    db.prepare('UPDATE plans SET monthly_price_gnf = ?, commission_bps = ?, max_dishes = ? WHERE id = ?')
      .run(price, bps, maxDishes, plan.id);
    res.json({ plan: db.prepare('SELECT * FROM plans WHERE id = ?').get(plan.id) });
  });

  // Bills every paying restaurant for a month: the plan price, plus the
  // commission on that month's delivered orders. Safe to run twice.
  r.post('/invoices/generate', (req, res) => {
    const period = String(req.body.period || new Date().toISOString().slice(0, 7));
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new HttpError(400, 'Période invalide (AAAA-MM).');
    const subs = db.prepare(
      "SELECT s.restaurant_id, p.monthly_price_gnf FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.status IN ('active','past_due')"
    ).all();
    const insert = db.prepare(
      'INSERT OR IGNORE INTO invoices (restaurant_id, kind, period, amount_gnf) VALUES (?, ?, ?, ?)'
    );
    const commission = db.prepare(
      `SELECT COALESCE(SUM(commission_gnf), 0) AS c FROM orders
       WHERE restaurant_id = ? AND status = 'delivered' AND strftime('%Y-%m', created_at) = ?`
    );
    let created = 0;
    for (const s of subs) {
      if (s.monthly_price_gnf) created += insert.run(s.restaurant_id, 'subscription', period, s.monthly_price_gnf).changes;
      const c = commission.get(s.restaurant_id, period).c;
      if (c > 0) created += insert.run(s.restaurant_id, 'commission', period, c).changes;
    }
    res.json({ period, created });
  });

  r.get('/invoices', (req, res) => {
    const where = req.query.status ? 'WHERE i.status = ?' : '';
    const params = req.query.status ? [oneOf(req.query.status, ['due', 'paid', 'void'], 'statut')] : [];
    res.json({
      invoices: db.prepare(
        `SELECT i.*, r.name AS restaurant_name FROM invoices i JOIN restaurants r ON r.id = i.restaurant_id ${where}
         ORDER BY i.period DESC, r.name LIMIT 200`
      ).all(...params)
    });
  });

  r.post('/invoices/:id/pay', (req, res) => {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(int(req.params.id, 'facture'));
    if (!inv) throw new HttpError(404, 'Facture introuvable.');
    db.prepare("UPDATE invoices SET status = 'paid' WHERE id = ?").run(inv.id);
    const stillDue = db.prepare("SELECT 1 FROM invoices WHERE restaurant_id = ? AND status = 'due'").get(inv.restaurant_id);
    if (!stillDue) {
      db.prepare("UPDATE subscriptions SET status = 'active' WHERE restaurant_id = ? AND status = 'past_due'").run(inv.restaurant_id);
    }
    res.json({ invoice: { ...inv, status: 'paid' } });
  });

  return r;
}
