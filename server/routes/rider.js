import { Router } from 'express';
import { requireRole } from '../auth.js';
import { listOrders, present, withItems } from '../orders.js';
import { COMMUNES, bool, oneOf } from '../lib.js';

// Rider pay is the order's delivery fee for now; change RIDER_PAY when the
// real pay rules are decided.
const RIDER_PAY = 'delivery_fee_gnf';

export function riderRoutes(db) {
  const r = Router();
  r.use(requireRole('rider'));

  const status = (id) =>
    db.prepare('SELECT online, commune FROM rider_status WHERE user_id = ?').get(id) || { online: 0, commune: null };

  r.get('/state', (req, res) => {
    const st = status(req.user.id);
    const current = withItems(db, listOrders(db, "o.rider_id = ? AND o.status IN ('accepted','ready','picked_up')", [req.user.id], 1))[0] || null;
    const open = st.online && !current
      ? listOrders(db, "o.rider_id IS NULL AND o.status IN ('accepted','ready')", [], 20)
      : [];
    res.json({
      online: !!st.online,
      commune: st.commune,
      current: current && present(current, req.user),
      open: open.map((o) => present(o, req.user))
    });
  });

  r.patch('/state', (req, res) => {
    const cur = status(req.user.id);
    const online = req.body.online !== undefined ? (bool(req.body.online) ? 1 : 0) : cur.online;
    const commune = req.body.commune !== undefined ? oneOf(req.body.commune, COMMUNES, 'commune') : cur.commune;
    db.prepare(
      `INSERT INTO rider_status (user_id, online, commune) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET online = excluded.online, commune = excluded.commune`
    ).run(req.user.id, online, commune);
    res.json({ online: !!online, commune });
  });

  r.get('/earnings', (req, res) => {
    const sum = (range) => db.prepare(
      `SELECT COUNT(*) AS trips, COALESCE(SUM(${RIDER_PAY}), 0) AS earned,
              COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_gnf ELSE 0 END), 0) AS cash_collected
       FROM orders WHERE rider_id = ? AND status = 'delivered' AND date(delivered_at) >= date('now', ?)`
    ).get(req.user.id, range);
    const days = db.prepare(
      `SELECT date(delivered_at) AS day, COALESCE(SUM(${RIDER_PAY}), 0) AS earned
       FROM orders WHERE rider_id = ? AND status = 'delivered' AND date(delivered_at) >= date('now', '-6 days')
       GROUP BY day ORDER BY day`
    ).all(req.user.id);
    const recent = listOrders(db, "o.rider_id = ? AND o.status = 'delivered'", [req.user.id], 10)
      .map((o) => ({ code: o.code, restaurant_name: o.restaurant_name, commune: o.commune, delivered_at: o.delivered_at,
        payment_method: o.payment_method, earned: o[RIDER_PAY] }));
    res.json({ today: sum('+0 days'), week: sum('-6 days'), days, recent });
  });

  return r;
}
