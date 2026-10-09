# ChopChop — food delivery across Africa

A mobile-first food delivery web app with a warm, textile-inspired design.
It is plain HTML/CSS/JS, so there is no build step and nothing to install.

## Run it

Open `index.html` in a browser, or serve the folder:

```sh
npx serve food-delivery    # or: python3 -m http.server -d food-delivery
```

## What's inside

- **8 cities**: Freetown, Lagos, Accra, Nairobi, Dakar, Addis Ababa, Kigali and Johannesburg.
  Prices are shown in each city's currency (SLE, NGN, GHS, KES, XOF, ETB, RWF, ZAR).
- **Local kitchens and dishes** such as cassava leaf, jollof, suya, waakye, nyama choma,
  thiéboudienne, injera platters, brochettes and kota.
- **Browse** by craving (rice, grills, stews, street food, plant-based, drinks) and search dishes or kitchens.
- **Basket** with quantity steppers, delivery and service fees, and promo codes (`KARIBU`, `CHOPFREE`).
- **Checkout** with each country's mobile money (Orange Money, M-Pesa, MTN MoMo, Wave, telebirr…), plus card or cash on delivery.
- **Live order tracking** (simulated): status timeline, rider on a map, and order history.
- Light and dark themes, keyboard focus styles and reduced-motion support. The basket and orders are saved in `localStorage`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell: header, tab bar, city picker |
| `styles.css` | Design tokens (terracotta, kente gold, forest green, sand) and components |
| `data.js` | Cities, currencies, payment methods, restaurants and menus |
| `app.js` | Hash router, views, basket, checkout and tracking logic |
