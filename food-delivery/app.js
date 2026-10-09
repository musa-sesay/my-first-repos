// ChopChop — a small, dependency-free single-page food delivery app.
// Routing is hash-based so it runs from any static host (or straight from disk).

(() => {
  "use strict";

  // ---------- Persistence ----------
  const STORE_KEY = "chopchop:v1";
  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  };
  const saved = load();
  const state = {
    city: CITIES.some(c => c.id === saved.city) ? saved.city : "freetown",
    cart: saved.cart || { restaurantId: null, items: {} },
    orders: Array.isArray(saved.orders) ? saved.orders : [],
    promo: null,
    category: null,
  };
  const persist = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ city: state.city, cart: state.cart, orders: state.orders }));
    } catch { /* storage unavailable — app still works for this session */ }
  };

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const city = () => CITIES.find(c => c.id === state.city);
  const restaurant = id => RESTAURANTS.find(r => r.id === id);
  const cityRestaurants = () => RESTAURANTS.filter(r => r.city === state.city);

  // Convert a USD base price to a "nice" local price for the current city.
  const local = usd => {
    const { rate, step } = city();
    return Math.max(step, Math.round((usd * rate) / step) * step);
  };
  const money = amount => {
    const { currency, step } = city();
    try {
      return new Intl.NumberFormat("en", {
        style: "currency", currency, currencyDisplay: "narrowSymbol",
        minimumFractionDigits: step < 1 ? 2 : 0, maximumFractionDigits: step < 1 ? 2 : 0,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  };

  const PROMOS = {
    KARIBU: { label: "20% off your food (max 5 USD)", apply: (sub) => Math.min(sub * 0.2, local(5)) },
    CHOPFREE: { label: "Free delivery", apply: (sub, delivery) => delivery },
  };

  const cartCount = () => Object.values(state.cart.items).reduce((a, b) => a + b, 0);
  const cartTotals = () => {
    const r = restaurant(state.cart.restaurantId);
    if (!r) return null;
    const subtotal = r.menu.reduce((sum, d) => sum + (state.cart.items[d.id] || 0) * local(d.price), 0);
    const delivery = local(r.fee);
    const service = Math.max(city().step, Math.round((subtotal * 0.05) / city().step) * city().step);
    const discount = state.promo ? Math.round(PROMOS[state.promo].apply(subtotal, delivery) / city().step) * city().step : 0;
    return { r, subtotal, delivery, service, discount, total: subtotal + delivery + service - discount };
  };

  let toastTimer;
  const toast = msg => {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  };

  // ---------- Cart actions ----------
  const setQty = (restaurantId, dishId, qty) => {
    if (state.cart.restaurantId && state.cart.restaurantId !== restaurantId && cartCount() > 0 && qty > 0) {
      const current = restaurant(state.cart.restaurantId);
      if (!confirm(`Your basket has items from ${current.name}. Start a new basket?`)) return false;
      state.cart = { restaurantId, items: {} };
      state.promo = null;
    }
    state.cart.restaurantId = restaurantId;
    if (qty > 0) state.cart.items[dishId] = qty;
    else delete state.cart.items[dishId];
    if (cartCount() === 0) { state.cart = { restaurantId: null, items: {} }; state.promo = null; }
    persist();
    updateChrome();
    return true;
  };

  // ---------- Shared fragments ----------
  const icon = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  };

  const cover = (r, extra = "") =>
    `<div class="cover ${extra}" style="--h:${r.hue}"><span class="cover__emoji" aria-hidden="true">${r.emoji}</span>`;

  const restaurantCard = r => `
    <a class="card" href="#/r/${r.id}">
      ${cover(r)}
        ${r.featured ? '<span class="cover__badge">Top rated</span>' : ""}
        <span class="cover__eta">${r.eta[0]}–${r.eta[1]} min</span>
      </div>
      <div class="card__body">
        <div class="card__title"><h3>${esc(r.name)}</h3><span class="rating">★ ${r.rating}</span></div>
        <div class="card__meta">${esc(r.tagline)}</div>
        <div class="card__meta">Delivery ${money(local(r.fee))}<span class="dot">•</span>${r.reviews.toLocaleString()} reviews</div>
      </div>
    </a>`;

  const stepper = (r, d) => {
    const qty = state.cart.restaurantId === r.id ? state.cart.items[d.id] || 0 : 0;
    return qty
      ? `<div class="stepper" role="group" aria-label="Quantity of ${esc(d.name)}">
          <button data-qty="${qty - 1}" data-r="${r.id}" data-d="${d.id}" aria-label="Remove one">−</button>
          <output>${qty}</output>
          <button data-qty="${qty + 1}" data-r="${r.id}" data-d="${d.id}" aria-label="Add one">+</button>
        </div>`
      : `<button class="add" data-qty="1" data-r="${r.id}" data-d="${d.id}" aria-label="Add ${esc(d.name)}">Add</button>`;
  };

  const empty = (art, title, text, cta = '<a class="btn btn--sm" href="#/">Browse kitchens</a>') => `
    <div class="empty"><div class="empty__art" aria-hidden="true">${art}</div><h2>${title}</h2><p>${text}</p>
      <div style="display:flex;justify-content:center">${cta}</div></div>`;

  // ---------- Views ----------
  const views = {
    home() {
      const c = city();
      const all = cityRestaurants();
      const list = state.category ? all.filter(r => r.cats.includes(state.category)) : all;
      const featured = RESTAURANTS.filter(r => r.featured && r.city !== state.city).slice(0, 5);
      return `
        <section class="hero kente">
          <div class="hero__eyebrow">${c.flag} Now serving ${esc(c.name)}</div>
          <h1>Taste of home, delivered hot.</h1>
          <p>Jollof, suya, injera, nyama choma — from kitchens you love, paid with mobile money.</p>
          <form class="search" role="search" data-search>
            ${icon.search}
            <input name="q" type="search" placeholder="Search dishes or kitchens" aria-label="Search dishes or kitchens" />
          </form>
        </section>

        <section class="section" aria-labelledby="catsH">
          <div class="section__head"><h2 id="catsH">What are you craving?</h2></div>
          <div class="chips">
            ${CATEGORIES.map(cat => `
              <button class="chip" data-cat="${cat.id}" aria-pressed="${state.category === cat.id}">
                <span class="chip__emoji" aria-hidden="true">${cat.emoji}</span>${cat.label}
              </button>`).join("")}
          </div>
        </section>

        <section class="section" aria-label="Offers">
          <div class="promos">
            <div class="promo kente" style="color:#fff;position:relative;overflow:hidden">
              <div style="position:absolute;inset:0;background:rgba(34,26,20,.7)"></div>
              <strong style="position:relative">20% off your first chop</strong>
              <span style="position:relative">Welcome to the family.</span>
              <code style="position:relative;color:#3B2A05;background:var(--gold)">KARIBU</code>
            </div>
            <div class="promo promo--green"><strong>Free delivery</strong><span>On any order this weekend.</span><code>CHOPFREE</code></div>
            <div class="promo promo--gold"><strong>Pay with ${esc(PAYMENT_METHODS[c.id][0])}</strong><span>Fast, safe checkout — no card needed.</span></div>
          </div>
        </section>

        <section class="section" aria-labelledby="nearH">
          <div class="section__head">
            <h2 id="nearH">${state.category ? esc(CATEGORIES.find(x => x.id === state.category).label) : "Kitchens"} in ${esc(c.name)}</h2>
            ${state.category ? '<a href="#/" data-cat-clear>Clear</a>' : ""}
          </div>
          <div class="list">
            ${list.length ? list.map(restaurantCard).join("") : `<p class="muted">No kitchens for this category in ${esc(c.name)} yet — try another craving.</p>`}
          </div>
        </section>

        <section class="section" aria-labelledby="pan">
          <div class="section__head"><h2 id="pan">Loved across Africa</h2></div>
          <p class="muted" style="margin-top:-6px">Switch city to order from these kitchens.</p>
          <div class="featured">${featured.map(r => restaurantCard(r).replace("</h3>", ` <small style="font-weight:500;color:var(--ink-3)">${CITIES.find(x => x.id === r.city).flag}</small></h3>`)).join("")}</div>
        </section>`;
    },

    search(params) {
      const q = (params.get("q") || "").trim().toLowerCase();
      const pool = cityRestaurants();
      const results = q ? pool.flatMap(r => {
        const nameHit = (r.name + " " + r.tagline).toLowerCase().includes(q);
        const dishes = r.menu.filter(d => (d.name + " " + d.desc).toLowerCase().includes(q));
        return nameHit || dishes.length ? [{ r, dishes }] : [];
      }) : [];
      return `
        <h1 class="page-title">Search</h1>
        <form class="search" role="search" data-search>
          ${icon.search}
          <input name="q" type="search" value="${esc(params.get("q") || "")}" placeholder="Try “jollof”, “injera”, “suya”…" aria-label="Search dishes or kitchens" autofocus />
        </form>
        <div class="section">
          ${!q ? `<div class="chips" style="flex-wrap:wrap;margin:0;padding:0">${["Jollof", "Suya", "Pilau", "Fufu", "Injera", "Kota", "Plantain"].map(s => `<a class="chip" style="width:auto;padding:10px 14px;text-decoration:none" href="#/search?q=${encodeURIComponent(s)}">${s}</a>`).join("")}</div>`
          : results.length ? `<div class="list">${results.map(({ r, dishes }) => `
              <div>${restaurantCard(r)}
                ${dishes.length ? `<div class="panel" style="margin-top:8px">${dishes.map(d => `
                  <div class="line-item"><div><div class="line-item__name">${esc(d.name)}</div><div class="line-item__price">${money(local(d.price))}</div></div>${stepper(r, d)}</div>`).join("")}</div>` : ""}
              </div>`).join("")}</div>`
          : empty("🔍", "No matches", `We couldn't find “${esc(q)}” in ${esc(city().name)}. Try another dish.`, "")}
        </div>`;
    },

    restaurant(params, id) {
      const r = restaurant(id);
      if (!r) return empty("🤷🏾", "Kitchen not found", "It may have moved or closed.");
      const groups = CATEGORIES.map(cat => ({ cat, dishes: r.menu.filter(d => d.cat === cat.id) })).filter(g => g.dishes.length);
      const wrongCity = r.city !== state.city;
      const rc = CITIES.find(x => x.id === r.city);
      return `
        ${cover(r, "rest-hero")}
          <a class="back" href="#/" aria-label="Back">${icon.back}</a>
        </div>
        <div class="rest-info">
          <h1>${esc(r.name)}</h1>
          <p>${esc(r.tagline)} · ${rc.flag} ${esc(rc.name)}</p>
          <div class="stats">
            <div><strong>★ ${r.rating}</strong><span>${r.reviews.toLocaleString()} reviews</span></div>
            <div><strong>${r.eta[0]}–${r.eta[1]}</strong><span>minutes</span></div>
            <div><strong>${money(local(r.fee))}</strong><span>delivery</span></div>
          </div>
        </div>
        ${wrongCity ? `<div class="panel" style="margin-top:14px;background:var(--gold-50)">
            <strong>This kitchen delivers in ${esc(rc.name)}.</strong>
            <p class="muted" style="margin:4px 0 10px">Switch your city to order from it.</p>
            <button class="btn btn--sm" data-switch-city="${rc.id}">Deliver to ${esc(rc.name)}</button></div>` : ""}
        ${groups.map(({ cat, dishes }) => `
          <section class="menu-group">
            <h2>${cat.emoji} ${cat.label}</h2>
            ${dishes.map(d => `
              <div class="dish">
                <div>
                  <h3>${esc(d.name)} ${d.popular ? '<span class="tag">Popular</span>' : ""}</h3>
                  <p>${esc(d.desc)}</p>
                  <span class="dish__price">${money(local(d.price))}</span>
                </div>
                ${wrongCity ? "" : stepper(r, d)}
              </div>`).join("")}
          </section>`).join("")}`;
    },

    cart() {
      const t = cartTotals();
      if (!t) return `<h1 class="page-title">Your basket</h1>` + empty("🧺", "Your basket is empty", "Good food is waiting. Find something delicious.");
      const { r } = t;
      return `
        <h1 class="page-title">Your basket</h1>
        <div class="panel">
          <h2>${r.emoji} ${esc(r.name)}</h2>
          ${r.menu.filter(d => state.cart.items[d.id]).map(d => `
            <div class="line-item">
              <div><div class="line-item__name">${esc(d.name)}</div><div class="line-item__price">${money(local(d.price) * state.cart.items[d.id])}</div></div>
              ${stepper(r, d)}
            </div>`).join("")}
          <a href="#/r/${r.id}" style="display:inline-block;margin-top:8px;color:var(--clay);font-weight:700;text-decoration:none">+ Add more items</a>
        </div>
        <div class="panel">
          <h2>Promo code</h2>
          <form class="promo-row" data-promo>
            <div class="field" style="flex:1;margin:0"><input name="code" placeholder="e.g. KARIBU" aria-label="Promo code" value="${state.promo || ""}" autocapitalize="characters" /></div>
            <button class="btn btn--sm btn--ghost" type="submit">Apply</button>
          </form>
          ${state.promo ? `<p class="muted" style="margin:8px 0 0;color:var(--forest)">✓ ${PROMOS[state.promo].label}</p>` : ""}
        </div>
        ${summary(t)}
        <a class="btn" href="#/checkout">Go to checkout · ${money(t.total)}</a>`;
    },

    checkout() {
      const t = cartTotals();
      if (!t) { location.hash = "#/cart"; return ""; }
      const c = city();
      const methods = [
        ...PAYMENT_METHODS[c.id].map(m => ({ id: m, icon: "📱", sub: "Mobile money · confirm on your phone" })),
        { id: "Card", icon: "💳", sub: "Visa, Mastercard, Verve" },
        { id: "Cash on delivery", icon: "💵", sub: `Pay the rider in ${c.currency}` },
      ];
      return `
        <a href="#/cart" style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;text-decoration:none;color:var(--ink-2);font-weight:600">← Basket</a>
        <h1 class="page-title">Checkout</h1>
        <form data-checkout>
          <div class="panel">
            <h2>Delivery details</h2>
            <div class="field"><label for="name">Full name</label><input id="name" name="name" required autocomplete="name" placeholder="Aminata Kamara" /></div>
            <div class="field"><label for="phone">Phone number</label><input id="phone" name="phone" type="tel" required autocomplete="tel" placeholder="${phoneHint(c.id)}" /></div>
            <div class="field"><label for="addr">Address or landmark</label><textarea id="addr" name="address" rows="2" required placeholder="e.g. Opposite the big mosque, blue gate, 2nd floor"></textarea></div>
            <div class="field" style="margin:0"><label for="note">Note for rider (optional)</label><input id="note" name="note" placeholder="Call when you reach the junction" /></div>
          </div>
          <div class="panel">
            <h2>Pay with</h2>
            <div class="pay-options">
              ${methods.map((m, i) => `
                <label class="pay-option">
                  <input type="radio" name="pay" value="${esc(m.id)}" ${i === 0 ? "checked" : ""} />
                  <span class="pay-option__icon" aria-hidden="true">${m.icon}</span>
                  <span><strong>${esc(m.id)}</strong><small>${m.sub}</small></span>
                </label>`).join("")}
            </div>
          </div>
          ${summary(t)}
          <button class="btn" type="submit">Place order · ${money(t.total)}</button>
        </form>`;
    },

    track(params, id) {
      const o = state.orders.find(x => x.id === id);
      if (!o) return empty("📦", "Order not found", "We couldn't find that order.");
      const s = orderStatus(o);
      const r = restaurant(o.restaurantId);
      // Rider moves from the kitchen (left) to the customer (right) along a curve.
      const p = s.progress;
      const x = 18 + p * 64, y = (1 - p) ** 2 * 70 + 2 * (1 - p) * p * -10 + p ** 2 * 70;
      return `
        <div class="track-map" role="img" aria-label="Map showing rider progress">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="route" vector-effect="non-scaling-stroke" d="M18 70 Q50 -10 82 70"/></svg>
          <span class="pin" style="left:18%;top:70%">🏪</span>
          <span class="pin" style="left:82%;top:70%">🏠</span>
          <span class="rider" style="left:${x}%;top:${y}%">🛵</span>
        </div>
        <div class="panel">
          <div class="muted" style="margin:0">${s.index >= 4 ? "Delivered" : "Arriving in"}</div>
          <div class="eta-big">${s.index >= 4 ? "Enjoy your meal! 🎉" : `${s.minutesLeft} min`}</div>
          <ol class="steps">
            ${STATUS_STEPS.map((step, i) => `
              <li class="${i < s.index ? "done" : i === s.index ? (i === 4 ? "done" : "current") : ""}">
                ${step.label}<small>${step.sub.replace("{r}", esc(r.name)).replace("{rider}", esc(o.rider))}</small>
              </li>`).join("")}
          </ol>
        </div>
        <div class="panel rider-card">
          <span class="avatar" aria-hidden="true">${esc(o.rider[0])}</span>
          <div class="rider-card__info"><strong>${esc(o.rider)}</strong><br /><small>Your rider · ★ 4.9 · Motorbike</small></div>
          <a class="btn btn--sm btn--ghost" href="tel:${esc(o.phone)}" aria-label="Call rider">📞 Call</a>
        </div>
        <div class="panel">
          <h2>Order #${esc(o.id.toUpperCase())} · ${esc(r.name)}</h2>
          ${o.lines.map(l => `<div class="summary-row"><span>${l.qty}× ${esc(l.name)}</span><span>${l.price}</span></div>`).join("")}
          <div class="summary-row summary-row--total"><span>Paid via ${esc(o.pay)}</span><span>${o.total}</span></div>
        </div>`;
    },

    orders() {
      if (!state.orders.length) return `<h1 class="page-title">Your orders</h1>` + empty("🛵", "No orders yet", "When you order, you can track your rider here.");
      return `
        <h1 class="page-title">Your orders</h1>
        <div class="panel">
          ${state.orders.map(o => {
            const r = restaurant(o.restaurantId);
            const s = orderStatus(o);
            const done = s.index >= 4;
            return `<a class="order-row line-item" href="#/track/${o.id}">
              ${cover(r)}</div>
              <div class="order-row__info"><strong>${esc(r.name)}</strong><small>${new Date(o.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · ${o.total}</small></div>
              <span class="status-pill ${done ? "status-pill--done" : ""}">${STATUS_STEPS[Math.min(s.index, 4)].label}</span>
            </a>`;
          }).join("")}
        </div>`;
    },
  };

  const summary = t => `
    <div class="panel">
      <h2>Summary</h2>
      <div class="summary-row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      <div class="summary-row"><span>Delivery fee</span><span>${money(t.delivery)}</span></div>
      <div class="summary-row"><span>Service fee</span><span>${money(t.service)}</span></div>
      ${t.discount ? `<div class="summary-row summary-row--discount"><span>Promo (${state.promo})</span><span>−${money(t.discount)}</span></div>` : ""}
      <div class="summary-row summary-row--total"><span>Total</span><span>${money(t.total)}</span></div>
    </div>`;

  const phoneHint = id => ({
    freetown: "+232 76 123 456", lagos: "+234 803 123 4567", accra: "+233 24 123 4567", nairobi: "+254 712 345 678",
    dakar: "+221 77 123 45 67", addis: "+251 91 123 4567", kigali: "+250 788 123 456", joburg: "+27 82 123 4567",
  }[id]);

  // ---------- Order lifecycle (simulated, sped up for the demo) ----------
  const STATUS_STEPS = [
    { label: "Order confirmed", sub: "{r} has received your order", at: 0 },
    { label: "Preparing your food", sub: "The kitchen is cooking it fresh", at: 15 },
    { label: "Picked up", sub: "{rider} has collected your order", at: 40 },
    { label: "On the way", sub: "{rider} is riding to you", at: 55 },
    { label: "Delivered", sub: "Enjoy, and don't forget to rate!", at: 120 },
  ];
  const orderStatus = o => {
    const secs = (Date.now() - o.createdAt) / 1000;
    let index = 0;
    STATUS_STEPS.forEach((s, i) => { if (secs >= s.at) index = i; });
    const travel = Math.min(1, Math.max(0, (secs - STATUS_STEPS[2].at) / (STATUS_STEPS[4].at - STATUS_STEPS[2].at)));
    const minutesLeft = Math.max(1, Math.round(o.eta * (1 - secs / STATUS_STEPS[4].at)));
    return { index, progress: travel, minutesLeft };
  };

  const placeOrder = form => {
    const t = cartTotals();
    const data = new FormData(form);
    const order = {
      id: Math.random().toString(36).slice(2, 8),
      restaurantId: t.r.id,
      createdAt: Date.now(),
      eta: t.r.eta[1],
      rider: RIDERS[Math.floor(Math.random() * RIDERS.length)],
      phone: String(data.get("phone")),
      pay: String(data.get("pay")),
      total: money(t.total),
      lines: t.r.menu.filter(d => state.cart.items[d.id]).map(d => ({
        name: d.name, qty: state.cart.items[d.id], price: money(local(d.price) * state.cart.items[d.id]),
      })),
    };
    state.orders.unshift(order);
    state.cart = { restaurantId: null, items: {} };
    state.promo = null;
    persist();
    updateChrome();
    toast(order.pay === "Cash on delivery" ? "Order placed! Pay the rider on arrival." : `Check your phone to approve the ${order.pay} payment.`);
    location.hash = `#/track/${order.id}`;
  };

  // ---------- Router ----------
  let tickTimer;
  const route = () => {
    clearInterval(tickTimer);
    const [path, query] = location.hash.replace(/^#/, "").split("?");
    const parts = (path || "/").split("/").filter(Boolean);
    const params = new URLSearchParams(query || "");
    const view = $("#view");

    let html, tab;
    switch (parts[0]) {
      case undefined: html = views.home(); tab = "home"; break;
      case "search": html = views.search(params); tab = "search"; break;
      case "r": html = views.restaurant(params, parts[1]); tab = "home"; break;
      case "cart": html = views.cart(); tab = "cart"; break;
      case "checkout": html = views.checkout(); tab = "cart"; break;
      case "track":
        html = views.track(params, parts[1]); tab = "orders";
        tickTimer = setInterval(() => { view.innerHTML = views.track(params, parts[1]); }, 3000);
        break;
      case "orders": html = views.orders(); tab = "orders"; break;
      default: html = empty("🧭", "Page not found", "Let's get you back to the food.");
    }
    view.innerHTML = html;
    document.querySelectorAll(".tabbar a").forEach(a => {
      if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    updateChrome(tab);
    if (parts[0] !== "search") window.scrollTo(0, 0);
  };

  // Header city, cart bar and tab badge.
  const updateChrome = (tab = document.querySelector(".tabbar a[aria-current]")?.dataset.tab) => {
    const c = city();
    $("#cityFlag").textContent = c.flag;
    $("#cityName").textContent = c.name;
    const count = cartCount();
    const badge = $("#tabBadge");
    badge.hidden = !count;
    badge.textContent = count;
    const bar = $("#cartBar");
    const onCartFlow = tab === "cart" || tab === "orders";
    bar.hidden = !count || onCartFlow;
    if (count) {
      $("#cartBarCount").textContent = count;
      $("#cartBarTotal").textContent = money(cartTotals().subtotal);
    }
  };

  // ---------- City sheet ----------
  const sheet = $("#citySheet");
  const renderCities = () => {
    $("#cityGrid").innerHTML = CITIES.map(c => `
      <button class="city-btn" data-city="${c.id}" aria-pressed="${c.id === state.city}">
        <span class="city-btn__flag" aria-hidden="true">${c.flag}</span>
        <span><strong>${esc(c.name)}</strong><small>${esc(c.country)} · ${c.currency}</small></span>
      </button>`).join("");
  };
  const setCity = id => {
    if (id === state.city) return;
    if (cartCount() && !confirm("Changing city will empty your basket. Continue?")) return;
    state.city = id;
    state.cart = { restaurantId: null, items: {} };
    state.promo = null;
    state.category = null;
    persist();
    toast(`Now delivering in ${city().name} ${city().flag}`);
    // Stay on a restaurant page that belongs to the new city; otherwise go home.
    const onRestaurant = location.hash.match(/^#\/r\/([\w-]+)/);
    if (!(onRestaurant && restaurant(onRestaurant[1])?.city === id) && location.hash !== "#/") location.hash = "#/";
    else route();
  };
  $("#cityPicker").addEventListener("click", () => { renderCities(); sheet.showModal(); });
  sheet.addEventListener("click", e => {
    if (e.target === sheet) return sheet.close(); // backdrop click
    const btn = e.target.closest("[data-city]");
    if (btn) { sheet.close(); setCity(btn.dataset.city); }
  });

  // ---------- Delegated events ----------
  document.addEventListener("click", e => {
    const qtyBtn = e.target.closest("[data-qty]");
    if (qtyBtn) {
      const { r, d } = qtyBtn.dataset;
      const qty = Number(qtyBtn.dataset.qty);
      if (setQty(r, d, qty)) {
        if (qty === 1 && !qtyBtn.closest(".stepper")) toast(`Added ${restaurant(r).menu.find(x => x.id === d).name}`);
        const y = window.scrollY;
        route();
        window.scrollTo(0, y);
      }
      return;
    }
    const cat = e.target.closest("[data-cat]");
    if (cat) { state.category = state.category === cat.dataset.cat ? null : cat.dataset.cat; const y = window.scrollY; route(); window.scrollTo(0, y); return; }
    if (e.target.closest("[data-cat-clear]")) { e.preventDefault(); state.category = null; route(); return; }
    const sw = e.target.closest("[data-switch-city]");
    if (sw) setCity(sw.dataset.switchCity);
  });

  document.addEventListener("submit", e => {
    const form = e.target;
    if (form.matches("[data-search]")) {
      e.preventDefault();
      const q = new FormData(form).get("q").trim();
      location.hash = `#/search${q ? `?q=${encodeURIComponent(q)}` : ""}`;
    } else if (form.matches("[data-promo]")) {
      e.preventDefault();
      const code = String(new FormData(form).get("code")).trim().toUpperCase();
      if (!code) { state.promo = null; route(); return; }
      if (PROMOS[code]) { state.promo = code; toast(`Promo applied: ${PROMOS[code].label}`); }
      else toast("That promo code isn't valid");
      route();
    } else if (form.matches("[data-checkout]")) {
      e.preventDefault();
      placeOrder(form);
    }
  });

  window.addEventListener("hashchange", route);
  route();
})();
