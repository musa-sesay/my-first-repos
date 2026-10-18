import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','owner','rider','admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pitch TEXT NOT NULL,
  monthly_price_gnf INTEGER,
  commission_bps INTEGER,
  max_dishes INTEGER,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  name TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  commune TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_open INTEGER NOT NULL DEFAULT 1,
  delivery_fee_gnf INTEGER NOT NULL DEFAULT 10000,
  prep_minutes INTEGER NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY,
  restaurant_id INTEGER NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL CHECK (status IN ('trial','active','past_due','cancelled')),
  trial_ends_at TEXT,
  billing_method TEXT NOT NULL DEFAULT 'orange_money',
  deduct_from_payouts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('subscription','commission')),
  period TEXT NOT NULL,
  amount_gnf INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due','paid','void')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (restaurant_id, kind, period)
);

CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Plats',
  price_gnf INTEGER NOT NULL CHECK (price_gnf > 0),
  available INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rider_status (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  online INTEGER NOT NULL DEFAULT 0,
  commune TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  rider_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','ready','picked_up','delivered','refused','cancelled')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('orange_money','mtn_momo','cash','card')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  subtotal_gnf INTEGER NOT NULL,
  delivery_fee_gnf INTEGER NOT NULL,
  total_gnf INTEGER NOT NULL,
  commission_gnf INTEGER NOT NULL DEFAULT 0,
  commune TEXT NOT NULL,
  address TEXT NOT NULL,
  landmark TEXT NOT NULL DEFAULT '',
  delivery_code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS orders_restaurant ON orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_rider ON orders(rider_id, status);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id INTEGER NOT NULL REFERENCES dishes(id),
  name TEXT NOT NULL,
  unit_price_gnf INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0)
);
`;

// Plan prices and commissions are business decisions that have not been made
// yet: they start empty and the admin sets them from the dashboard.
const DEFAULT_PLANS = [
  ['essentiel', 'Essentiel', 'Vitrine sur l’app Kassa, jusqu’à 40 plats, livreurs Kassa, versement chaque semaine.', 40, 1],
  ['pro', 'Pro', 'Plats illimités, mise en avant dans votre commune, promotions, statistiques détaillées.', null, 2],
  ['business', 'Business', 'Plusieurs adresses, vos propres livreurs, comptes équipe, conseiller dédié.', null, 3]
];

export function openDb(path = process.env.KASSA_DB || 'data/kassa.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  const insertPlan = db.prepare(
    'INSERT OR IGNORE INTO plans (id, name, pitch, max_dishes, sort) VALUES (?, ?, ?, ?, ?)'
  );
  for (const p of DEFAULT_PLANS) insertPlan.run(...p);
  return db;
}

export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
