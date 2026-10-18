import { randomInt } from 'node:crypto';
import { tx } from './db.js';
import { COMMUNES, HttpError, PAYMENT_METHODS, int, isListable, oneOf, text } from './lib.js';

const ORDER_SELECT = `
  SELECT o.*, r.name AS restaurant_name, r.address AS restaurant_address, r.phone AS restaurant_phone,
         c.name AS customer_name, c.phone AS customer_phone,
         rd.name AS rider_name, rd.phone AS rider_phone
  FROM orders o
  JOIN restaurants r ON r.id = o.restaurant_id
  JOIN users c ON c.id = o.customer_id
  LEFT JOIN users rd ON rd.id = o.rider_id`;

export function getOrder(db, id) {
  return db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id);
}

export function listOrders(db, where = '1', params = [], limit = 100) {
  return db.prepare(`${ORDER_SELECT} WHERE ${where} ORDER BY o.id DESC LIMIT ${Number(limit)}`).all(...params);
}

export function withItems(db, orders) {
  const items = db.prepare('SELECT dish_id, name, unit_price_gnf, qty FROM order_items WHERE order_id = ?');
  return orders.map((o) => ({ ...o, items: items.all(o.id) }));
}

// Each role sees what it needs: the customer holds the hand-over code, the
// rider and restaurant never see it.
export function present(order, viewer) {
  const out = { ...order };
  if (viewer.role !== 'admin' && viewer.id !== order.customer_id) delete out.delivery_code;
  return out;
}

export function createOrder(db, customer, body) {
  const restaurantId = int(body.restaurant_id, 'restaurant');
  const paymentMethod = oneOf(body.payment_method, PAYMENT_METHODS, 'moyen de paiement');
  const commune = oneOf(body.commune, COMMUNES, 'commune');
  const address = text(body.address, 'adresse', { max: 160 });
  const landmark = text(body.landmark, 'point de repère', { max: 200, optional: true });
  const lines = Array.isArray(body.items) ? body.items : [];
  if (!lines.length || lines.length > 30) throw new HttpError(400, 'Panier vide ou trop grand.');

  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(restaurantId);
  const sub = restaurant && db.prepare('SELECT * FROM subscriptions WHERE restaurant_id = ?').get(restaurantId);
  if (!restaurant || !isListable(sub)) throw new HttpError(404, 'Restaurant introuvable.');
  if (!restaurant.is_open) throw new HttpError(409, 'Ce restaurant est fermé pour le moment.');
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(sub.plan_id);

  const dishStmt = db.prepare('SELECT * FROM dishes WHERE id = ? AND restaurant_id = ?');
  const merged = new Map();
  for (const line of lines) {
    const dishId = int(line?.dish_id, 'plat');
    const qty = int(line?.qty, 'quantité', { min: 1, max: 20 });
    merged.set(dishId, (merged.get(dishId) || 0) + qty);
  }
  const resolved = [...merged].map(([dishId, qty]) => {
    const dish = dishStmt.get(dishId, restaurantId);
    if (!dish) throw new HttpError(400, 'Plat introuvable.');
    if (!dish.available) throw new HttpError(409, `« ${dish.name} » n’est plus disponible.`);
    return { dish, qty };
  });

  const subtotal = resolved.reduce((s, { dish, qty }) => s + dish.price_gnf * qty, 0);
  const fee = restaurant.delivery_fee_gnf;
  const commission = plan.commission_bps ? Math.round((subtotal * plan.commission_bps) / 10000) : 0;
  const deliveryCode = String(randomInt(0, 10000)).padStart(4, '0');

  const id = tx(db, () => {
    const orderId = db.prepare(
      `INSERT INTO orders (code, customer_id, restaurant_id, status, payment_method, subtotal_gnf, delivery_fee_gnf,
         total_gnf, commission_gnf, commune, address, landmark, delivery_code)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(`tmp-${Date.now()}-${randomInt(1e9)}`, customer.id, restaurantId, paymentMethod, subtotal, fee,
      subtotal + fee, commission, commune, address, landmark, deliveryCode).lastInsertRowid;
    db.prepare('UPDATE orders SET code = ? WHERE id = ?').run('KS-' + (20000 + Number(orderId)), orderId);
    const item = db.prepare('INSERT INTO order_items (order_id, dish_id, name, unit_price_gnf, qty) VALUES (?, ?, ?, ?, ?)');
    for (const { dish, qty } of resolved) item.run(orderId, dish.id, dish.name, dish.price_gnf, qty);
    return orderId;
  });
  return getOrder(db, id);
}

function update(db, id, fields) {
  const keys = Object.keys(fields);
  db.prepare(
    `UPDATE orders SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`
  ).run(...keys.map((k) => fields[k]), id);
}

const conflict = () => new HttpError(409, 'Cette action n’est plus possible pour cette commande.');

// The order state machine. Every status change goes through here so the
// rules for who may do what live in one place.
export function act(db, order, user, action, payload = {}) {
  const s = order.status;
  const ownsRestaurant = () =>
    db.prepare('SELECT 1 FROM restaurants WHERE id = ? AND owner_id = ?').get(order.restaurant_id, user.id);
  const isRider = user.role === 'rider' && order.rider_id === user.id;

  switch (action) {
    case 'accept':
    case 'refuse':
    case 'ready': {
      if (user.role !== 'admin' && !ownsRestaurant()) throw new HttpError(403, 'Accès refusé.');
      if (action === 'accept' && s === 'pending') return update(db, order.id, { status: 'accepted' });
      if (action === 'refuse' && s === 'pending') return update(db, order.id, { status: 'refused' });
      if (action === 'ready' && s === 'accepted') return update(db, order.id, { status: 'ready' });
      throw conflict();
    }
    case 'claim': {
      if (user.role !== 'rider') throw new HttpError(403, 'Accès refusé.');
      const online = db.prepare('SELECT online FROM rider_status WHERE user_id = ?').get(user.id);
      if (!online?.online) throw new HttpError(409, 'Passez en ligne pour accepter une course.');
      const busy = db.prepare("SELECT 1 FROM orders WHERE rider_id = ? AND status IN ('accepted','ready','picked_up')").get(user.id);
      if (busy) throw new HttpError(409, 'Terminez votre course en cours d’abord.');
      // Guarded update so two riders cannot claim the same order.
      const r = db.prepare(
        `UPDATE orders SET rider_id = ?, updated_at = datetime('now')
         WHERE id = ? AND rider_id IS NULL AND status IN ('accepted','ready')`
      ).run(user.id, order.id);
      if (!r.changes) throw conflict();
      return;
    }
    case 'pickup': {
      if (!isRider) throw new HttpError(403, 'Accès refusé.');
      if (s !== 'ready') throw new HttpError(409, 'La commande n’est pas encore prête.');
      return update(db, order.id, { status: 'picked_up' });
    }
    case 'deliver': {
      if (!isRider) throw new HttpError(403, 'Accès refusé.');
      if (s !== 'picked_up') throw conflict();
      if (String(payload.code ?? '').trim() !== order.delivery_code) throw new HttpError(400, 'Code de remise incorrect.');
      return update(db, order.id, {
        status: 'delivered',
        delivered_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        ...(order.payment_method === 'cash' ? { payment_status: 'paid' } : {})
      });
    }
    case 'cancel': {
      const mayCancel = user.role === 'admin'
        ? !['delivered', 'refused', 'cancelled'].includes(s)
        : user.id === order.customer_id && s === 'pending';
      if (!mayCancel) throw conflict();
      return update(db, order.id, { status: 'cancelled' });
    }
    case 'assign': {
      if (user.role !== 'admin') throw new HttpError(403, 'Accès refusé.');
      if (!['pending', 'accepted', 'ready'].includes(s)) throw conflict();
      const riderId = int(payload.rider_id, 'livreur');
      const rider = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'rider'").get(riderId);
      if (!rider) throw new HttpError(400, 'Livreur introuvable.');
      return update(db, order.id, { rider_id: riderId });
    }
    case 'mark_paid': {
      if (user.role !== 'admin') throw new HttpError(403, 'Accès refusé.');
      return update(db, order.id, { payment_status: 'paid' });
    }
    default:
      throw new HttpError(400, 'Action inconnue.');
  }
}
