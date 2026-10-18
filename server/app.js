import express from 'express';
import { fileURLToPath } from 'node:url';
import { loadUser, logout, publicUser, requestCode, requireRole, sessionToken, setSessionCookie, SESSION_COOKIE, verifyCode } from './auth.js';
import { act, createOrder, getOrder, listOrders, present, withItems } from './orders.js';
import { COMMUNES, HttpError, int, isListable, text } from './lib.js';
import { partnerRoutes } from './routes/partner.js';
import { riderRoutes } from './routes/rider.js';
import { adminRoutes } from './routes/admin.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

export function listableRestaurants(db) {
  const rows = db.prepare(
    `SELECT r.*, s.status AS sub_status, s.trial_ends_at, s.plan_id
     FROM restaurants r JOIN subscriptions s ON s.restaurant_id = r.id ORDER BY r.name`
  ).all();
  return rows.filter((r) => isListable({ status: r.sub_status, trial_ends_at: r.trial_ends_at }));
}

function publicRestaurant(r) {
  return {
    id: r.id, name: r.name, cuisine: r.cuisine, commune: r.commune, address: r.address,
    is_open: !!r.is_open, delivery_fee_gnf: r.delivery_fee_gnf, prep_minutes: r.prep_minutes,
    featured: r.plan_id === 'pro' || r.plan_id === 'business'
  };
}

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((req, _res, next) => {
    req.body ??= {};
    next();
  });
  app.use(loadUser(db));

  // Mutating API calls must be JSON, which a cross-site form cannot send.
  app.use('/api', (req, _res, next) => {
    if (req.method !== 'GET' && !req.is('application/json')) return next(new HttpError(415, 'JSON attendu.'));
    next();
  });

  // --- Auth ---
  app.post('/api/auth/request-code', async (req, res) => {
    res.json(await requestCode(db, req.body.phone));
  });
  app.post('/api/auth/verify', (req, res) => {
    const { token, user } = verifyCode(db, req.body.phone, req.body.code, req.body.name);
    setSessionCookie(res, token);
    res.json({ user: publicUser(user) });
  });
  app.post('/api/auth/logout', (req, res) => {
    logout(db, sessionToken(req));
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });
  app.get('/api/me', (req, res) => {
    const restaurant = req.user?.role === 'owner'
      ? db.prepare('SELECT id, name FROM restaurants WHERE owner_id = ?').get(req.user.id)
      : null;
    res.json({ user: publicUser(req.user), restaurant: restaurant || null });
  });
  app.patch('/api/me', requireRole(), (req, res) => {
    const name = text(req.body.name, 'nom', { max: 80 });
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
    res.json({ user: publicUser({ ...req.user, name }) });
  });

  // --- Public catalogue ---
  app.get('/api/meta', (_req, res) => {
    res.json({ communes: COMMUNES });
  });
  app.get('/api/plans', (_req, res) => {
    res.json({ plans: db.prepare('SELECT * FROM plans ORDER BY sort').all() });
  });
  app.get('/api/restaurants', (req, res) => {
    let list = listableRestaurants(db);
    if (req.query.commune) list = list.filter((r) => r.commune === req.query.commune);
    // Pro and Business plans are shown first in their commune.
    list.sort((a, b) => Number(b.plan_id !== 'essentiel') - Number(a.plan_id !== 'essentiel'));
    res.json({ restaurants: list.map(publicRestaurant) });
  });
  app.get('/api/restaurants/:id', (req, res) => {
    const id = int(req.params.id, 'restaurant');
    const r = listableRestaurants(db).find((x) => x.id === id);
    if (!r) throw new HttpError(404, 'Restaurant introuvable.');
    const dishes = db.prepare(
      'SELECT id, name, description, category, price_gnf, available FROM dishes WHERE restaurant_id = ? ORDER BY sort, id'
    ).all(id).map((d) => ({ ...d, available: !!d.available }));
    res.json({ restaurant: publicRestaurant(r), dishes });
  });

  // --- Customer orders ---
  app.post('/api/orders', requireRole(), (req, res) => {
    const order = createOrder(db, req.user, req.body);
    res.status(201).json({ order: present(withItems(db, [order])[0], req.user) });
  });
  app.get('/api/orders', requireRole(), (req, res) => {
    const orders = withItems(db, listOrders(db, 'o.customer_id = ?', [req.user.id], 30));
    res.json({ orders: orders.map((o) => present(o, req.user)) });
  });
  app.get('/api/orders/:id', requireRole(), (req, res) => {
    const order = getOrder(db, int(req.params.id, 'commande'));
    const ownerOf = order && db.prepare('SELECT 1 FROM restaurants WHERE id = ? AND owner_id = ?').get(order.restaurant_id, req.user.id);
    const allowed = order && (req.user.role === 'admin' || order.customer_id === req.user.id || order.rider_id === req.user.id || ownerOf);
    if (!allowed) throw new HttpError(404, 'Commande introuvable.');
    res.json({ order: present(withItems(db, [order])[0], req.user) });
  });
  app.post('/api/orders/:id/:action', requireRole(), (req, res) => {
    const order = getOrder(db, int(req.params.id, 'commande'));
    if (!order) throw new HttpError(404, 'Commande introuvable.');
    act(db, order, req.user, req.params.action, req.body);
    res.json({ order: present(withItems(db, [getOrder(db, order.id)])[0], req.user) });
  });

  app.use('/api/partner', partnerRoutes(db));
  app.use('/api/rider', riderRoutes(db));
  app.use('/api/admin', adminRoutes(db));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Introuvable.')));
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Erreur du serveur.' : err.message });
  });
  return app;
}
