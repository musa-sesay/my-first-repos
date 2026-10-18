import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';
import { seed, DEMO } from '../server/seed.js';

let server, base, db;

before(async () => {
  db = openDb(':memory:');
  seed(db);
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// A tiny client that keeps its own session cookie.
function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = await res.json();
    return { status: res.status, data };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    patch: (p, b) => call('PATCH', p, b),
    put: (p, b) => call('PUT', p, b),
    del: (p) => call('DELETE', p, {}),
    async login(phone, name) {
      const { data } = await call('POST', '/api/auth/request-code', { phone });
      const r = await call('POST', '/api/auth/verify', { phone, code: data.devCode, name });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      return r.data.user;
    }
  };
}

const restaurantId = (name) => db.prepare('SELECT id FROM restaurants WHERE name = ?').get(name).id;
const dishId = (name) => db.prepare('SELECT id FROM dishes WHERE name = ?').get(name).id;

test('login rejects a wrong code and locks after too many tries', async () => {
  const c = client();
  const phone = '620 55 55 55';
  await c.post('/api/auth/request-code', { phone });
  for (let i = 0; i < 5; i++) {
    const r = await c.post('/api/auth/verify', { phone, code: '000000x' });
    assert.equal(r.status, 400);
  }
  const locked = await c.post('/api/auth/verify', { phone, code: '000000x' });
  assert.equal(locked.status, 429);
  assert.equal((await c.post('/api/auth/request-code', { phone: '12345' })).status, 400);
});

test('full order flow: customer → restaurant → rider → delivered', async () => {
  const customer = client();
  await customer.login(DEMO.customer);
  const order = await customer.post('/api/orders', {
    restaurant_id: restaurantId('Chez Fanta'),
    items: [{ dish_id: dishId('Riz sauce arachide'), qty: 2 }, { dish_id: dishId('Jus de bissap'), qty: 1 }],
    payment_method: 'cash', commune: 'Ratoma', address: 'Kipé', landmark: 'Portail bleu'
  });
  assert.equal(order.status, 201, JSON.stringify(order.data));
  const o = order.data.order;
  assert.equal(o.subtotal_gnf, 100000);
  assert.equal(o.total_gnf, 110000);
  assert.match(o.code, /^KS-\d+$/);
  assert.match(o.delivery_code, /^\d{4}$/);

  const owner = client();
  await owner.login(DEMO.restaurants[0].owner);
  const incoming = await owner.get('/api/partner/orders');
  const seen = incoming.data.orders.find((x) => x.id === o.id);
  assert.ok(seen, 'restaurant sees the order');
  assert.equal(seen.delivery_code, undefined, 'restaurant must not see the hand-over code');

  // Another restaurant cannot touch it.
  const other = client();
  await other.login(DEMO.restaurants[1].owner);
  assert.equal((await other.post(`/api/orders/${o.id}/accept`)).status, 403);

  assert.equal((await owner.post(`/api/orders/${o.id}/accept`)).status, 200);

  const rider = client();
  await rider.login(DEMO.riders[0][0]);
  assert.equal((await rider.post(`/api/orders/${o.id}/claim`)).status, 409, 'offline rider cannot claim');
  await rider.patch('/api/rider/state', { online: true, commune: 'Ratoma' });
  const state = await rider.get('/api/rider/state');
  assert.ok(state.data.open.some((x) => x.id === o.id));
  assert.equal((await rider.post(`/api/orders/${o.id}/claim`)).status, 200);

  const rider2 = client();
  await rider2.login(DEMO.riders[1][0]);
  await rider2.patch('/api/rider/state', { online: true });
  assert.equal((await rider2.post(`/api/orders/${o.id}/claim`)).status, 409, 'second rider cannot claim');

  assert.equal((await rider.post(`/api/orders/${o.id}/pickup`)).status, 409, 'not ready yet');
  assert.equal((await owner.post(`/api/orders/${o.id}/ready`)).status, 200);
  assert.equal((await rider.post(`/api/orders/${o.id}/pickup`)).status, 200);
  assert.equal((await rider.post(`/api/orders/${o.id}/deliver`, { code: '9999' === o.delivery_code ? '0000' : '9999' })).status, 400);
  const done = await rider.post(`/api/orders/${o.id}/deliver`, { code: o.delivery_code });
  assert.equal(done.status, 200);
  assert.equal(done.data.order.status, 'delivered');
  assert.equal(done.data.order.payment_status, 'paid', 'cash is paid on delivery');

  const earnings = await rider.get('/api/rider/earnings');
  assert.equal(earnings.data.today.trips, 1);
  assert.equal(earnings.data.today.earned, 10000);
  assert.equal(earnings.data.today.cash_collected, 110000);
});

test('server prices the cart and rejects unavailable dishes', async () => {
  const customer = client();
  await customer.login(DEMO.customer);
  const owner = client();
  await owner.login(DEMO.restaurants[0].owner);
  await owner.patch(`/api/partner/dishes/${dishId('Sauce feuille')}`, { available: false });
  const r = await customer.post('/api/orders', {
    restaurant_id: restaurantId('Chez Fanta'), items: [{ dish_id: dishId('Sauce feuille'), qty: 1 }],
    payment_method: 'orange_money', commune: 'Ratoma', address: 'Kipé'
  });
  assert.equal(r.status, 409);
  const foreign = await customer.post('/api/orders', {
    restaurant_id: restaurantId('Chez Fanta'), items: [{ dish_id: dishId('Alloco'), qty: 1 }],
    payment_method: 'cash', commune: 'Ratoma', address: 'Kipé'
  });
  assert.equal(foreign.status, 400, 'dish from another restaurant');
});

test('restaurant sign-up starts a trial and lists the restaurant', async () => {
  const c = client();
  await c.login('620 77 77 77', 'Aïssatou');
  const r = await c.post('/api/partner/restaurants', {
    name: 'Maquis Test', cuisine: 'Grillades', commune: 'Matoto', address: 'Enta', phone: '620777777', plan_id: 'essentiel'
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const me = await c.get('/api/me');
  assert.equal(me.data.user.role, 'owner');
  const billing = await c.get('/api/partner/billing');
  assert.equal(billing.data.subscription.effective_status, 'trial');
  const add = await c.post('/api/partner/dishes', { name: 'Brochettes', price_gnf: 25000 });
  assert.equal(add.status, 201);
  const list = await c.get('/api/restaurants');
  assert.ok(list.data.restaurants.some((x) => x.name === 'Maquis Test'));

  // A cancelled subscription hides the restaurant from customers.
  await c.patch('/api/partner/subscription', { cancel: true });
  const after = await c.get('/api/restaurants');
  assert.ok(!after.data.restaurants.some((x) => x.name === 'Maquis Test'));
});

test('admin endpoints are admin-only; plans, invoices and payment', async () => {
  const customer = client();
  await customer.login(DEMO.customer);
  assert.equal((await customer.get('/api/admin/overview')).status, 403);
  assert.equal((await client().get('/api/admin/overview')).status, 401);

  const admin = client();
  await admin.login(DEMO.admin);
  const ov = await admin.get('/api/admin/overview');
  assert.equal(ov.status, 200);
  assert.ok(ov.data.kpis.orders >= 1);

  const plan = await admin.put('/api/admin/plans/business', { monthly_price_gnf: 900000, commission_bps: 800 });
  assert.equal(plan.data.plan.monthly_price_gnf, 900000);

  const period = new Date().toISOString().slice(0, 7);
  const gen = await admin.post('/api/admin/invoices/generate', { period });
  assert.ok(gen.data.created >= 1);
  const again = await admin.post('/api/admin/invoices/generate', { period });
  assert.equal(again.data.created, 0, 'generating twice creates nothing new');

  const due = await admin.get('/api/admin/invoices?status=due');
  const inv = due.data.invoices.find((i) => i.restaurant_name === 'Le Braisé de Kaloum');
  assert.equal(inv.amount_gnf, 900000);
  assert.equal((await admin.post(`/api/admin/invoices/${inv.id}/pay`)).status, 200);

  const created = await admin.post('/api/admin/riders', { phone: '620 88 88 88', name: 'Mohamed C.' });
  assert.equal(created.status, 201);
  const riders = await admin.get('/api/admin/riders');
  assert.ok(riders.data.riders.some((x) => x.name === 'Mohamed C.'));
});

test('admin can assign a rider; customer can cancel only while pending', async () => {
  const customer = client();
  await customer.login(DEMO.customer);
  const mk = () => customer.post('/api/orders', {
    restaurant_id: restaurantId('Le Braisé de Kaloum'), items: [{ dish_id: dishId('Alloco'), qty: 1 }],
    payment_method: 'mtn_momo', commune: 'Kaloum', address: 'Almamya'
  });
  const a = (await mk()).data.order;
  assert.equal((await customer.post(`/api/orders/${a.id}/cancel`)).data.order.status, 'cancelled');

  const b = (await mk()).data.order;
  const owner = client();
  await owner.login(DEMO.restaurants[1].owner);
  await owner.post(`/api/orders/${b.id}/accept`);
  assert.equal((await customer.post(`/api/orders/${b.id}/cancel`)).status, 409);

  const admin = client();
  await admin.login(DEMO.admin);
  const riderId = db.prepare('SELECT id FROM users WHERE phone = ?').get(DEMO.riders[1][0]).id;
  const r = await admin.post(`/api/orders/${b.id}/assign`, { rider_id: riderId });
  assert.equal(r.data.order.rider_id, riderId);
  assert.equal(r.data.order.payment_status, 'unpaid', 'mobile money stays unpaid until confirmed');
  assert.equal((await admin.post(`/api/orders/${b.id}/mark_paid`)).data.order.payment_status, 'paid');
});

test('mutations must be JSON', async () => {
  const res = await fetch(base + '/api/auth/request-code', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'phone=620000002'
  });
  assert.equal(res.status, 415);
});
