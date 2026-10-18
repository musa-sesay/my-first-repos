# Kassa

Food delivery for Conakry, Guinea, as a SaaS for restaurants. One Node.js server and database run four web apps (the interface is in French, prices in GNF):

| App | URL | Who uses it |
|---|---|---|
| Customer app | `/` | Customers: browse restaurants, order, pay, track the delivery |
| Kassa Pro | `/pro` | Restaurants: pricing plans and sign-up (starts a free trial) |
| Restaurant dashboard | `/partner` | Restaurant owners: live orders, menu, subscription and invoices, settings |
| Rider app | `/rider` | Riders: go online, accept jobs, pick up, deliver with the customer's code, earnings |
| Admin | `/admin` | Kassa team: overview, order dispatch, riders, restaurants and subscriptions, plan prices, invoices |

## Run it

Needs Node.js 22.13 or newer (it uses the built-in `node:sqlite`, so there is nothing to compile).

```bash
npm install
npm run seed     # demo accounts, 3 restaurants with menus
npm start        # http://localhost:3000
npm test         # API tests
```

Sign-in is by phone number and a 6-digit SMS code. No SMS gateway is connected yet, so outside production the code is printed in the server log and shown in the sign-in dialog.

Demo accounts created by `npm run seed`:

| Role | Phone |
|---|---|
| Admin | 620 00 00 01 |
| Customer | 620 00 00 02 |
| Riders | 620 00 00 11, 620 00 00 12 |
| Chez Fanta (Pro, on trial) | 620 00 01 01 |
| Le Braisé de Kaloum (Business) | 620 00 01 02 |
| Saveurs du Fouta (Essentiel) | 620 00 01 03 |

### Settings

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `KASSA_DB` | `data/kassa.db` | SQLite file |
| `KASSA_ADMIN_PHONES` | — | Comma-separated numbers that become admins when they sign in |
| `KASSA_TRIAL_DAYS` | `14` | Length of the free trial for new restaurants |
| `NODE_ENV` | — | `production` hides the SMS code and marks the cookie `Secure` |

## How it works

**Order flow.** The customer orders; the server prices the cart from the database and creates a 4-digit hand-over code that only the customer sees. The restaurant accepts and marks the order ready. A rider claims it (or an admin assigns one), picks it up, and confirms delivery with the customer's code. Cash orders count as paid on delivery. All status changes go through one state machine in `server/orders.js`, which also checks who may do what.

**Subscriptions.** Restaurants sign up on `/pro`, choose Essentiel, Pro or Business, and start a trial. Customers only see restaurants whose subscription is on trial or active; an expired trial counts as unpaid. Each month the admin generates invoices (plan price plus commission on delivered orders) and marks them paid, which reactivates an unpaid restaurant. Essentiel limits the menu to 40 dishes. Pro and Business restaurants are listed first.

**Code layout.**

```
server/
  app.js          Express app: auth, catalogue and customer order routes
  auth.js         SMS-code sign-in, sessions (hashed tokens, httpOnly cookie), role checks
  orders.js       Order creation and the status state machine
  routes/         partner.js, rider.js, admin.js
  db.js           Schema and default plans
  seed.js         Demo data
public/           The four apps: plain HTML, CSS and ES modules, no build step
test/             API tests (node:test)
```

## Not done yet

These need business decisions or third-party accounts:

- **Plan prices and commission**: empty until set in Admin › Formules & tarifs. The Pro site shows "Prix à venir" until then.
- **SMS gateway** for sign-in codes (`sendSms` in `server/auth.js`).
- **Orange Money / MTN MoMo / card payments**: the method is recorded, but nothing is charged. An admin marks mobile-money orders as paid by hand. Subscription invoices are also marked paid by hand.
- **Rider pay**: the rider currently earns the order's delivery fee (`RIDER_PAY` in `server/routes/rider.js`).
- **Maps and live GPS**, push notifications, dish photos, and Pular/Soussou/Maninka translations.
- **One restaurant per owner**: Business's multiple locations and own riders are not built.
