# Money transfer app: West Africa concept

An interactive, single-file prototype of an Orange Money–style wallet, limited to the
West African markets where Orange runs mobile money:

| Country | Dial | Currency | Language |
|---|---|---|---|
| Senegal | +221 | XOF | French |
| Côte d'Ivoire | +225 | XOF | French |
| Mali | +223 | XOF | French |
| Burkina Faso | +226 | XOF | French |
| Guinea | +224 | GNF | French |
| Guinea-Bissau | +245 | XOF | Portuguese |
| Sierra Leone | +232 | SLE | English |
| Liberia | +231 | LRD | English |

Open the files in any browser. No build step and no dependencies.

- `screens.html`: **mobile app design board** with 20 screens grouped by flow (onboarding, wallet, send money, more services and error states), followed by the style guide (colours, type, components, rules)
- `index.html`: interactive click-through prototype

## What's in it
- **Home**: balance (can be hidden), quick actions, favourites, recent activity
- **Send flow** (4 steps): destination country → recipient number (checked against each country's number length) → amount, with fee and FX preview → confirm → PIN → receipt
- **Cross-border**: transfers inside the UEMOA zone need no conversion. Transfers to GNF, SLE or LRD show the exchange rate and the amount received.
- **History** with sent and received filters, and a **Profile** screen
- **Home-country switch**: changes the currency, the language (FR/EN/PT) and the number formats
- Light and dark themes, and a mobile-friendly layout

> Unofficial concept for study only. Not affiliated with or endorsed by Orange.
> Fees and exchange rates are sample values. No real transactions or PINs are handled.
