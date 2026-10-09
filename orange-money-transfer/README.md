# Orange Money Transfer — West Africa (concept design)

A clickable mobile prototype of an Orange Money transfer flow that only allows
sending to the eight West African markets where Orange Money operates:

| Country | Dial code | Currency |
|---|---|---|
| Senegal | +221 | XOF (FCFA) |
| Côte d'Ivoire | +225 | XOF (FCFA) |
| Mali | +223 | XOF (FCFA) |
| Burkina Faso | +226 | XOF (FCFA) |
| Guinea-Bissau | +245 | XOF (FCFA) |
| Guinea | +224 | GNF |
| Sierra Leone | +232 | SLE |
| Liberia | +231 | LRD |

## Open it

Open `index.html` in a browser. No build step or dependencies.
On a desktop it shows inside a phone frame with design notes; on a phone it fills the screen.

## Flow

1. **Home**: wallet balance (can be hidden), quick actions, recent transfers.
2. **Destination**: the eight countries only, searchable, tagged *Domestic* or *Same currency* (XOF zone).
3. **Recipient**: dial code is fixed by country; number length/prefix validated per country; recent contacts.
4. **Amount**: live payout in the recipient's currency, fee, exchange rate and total debited,
   with a toggle for who pays the fee; min/max and balance checks.
5. **Review**, then a 4-digit **PIN** (any 4 digits work in the demo).
6. **Receipt** with a transfer reference; the transfer is added to History.

Profile lets you switch language (EN/FR), the sender's wallet country, and light/dark theme.

## Placeholder values

Exchange rates, fees (0.8% domestic, 1% within the XOF zone, 2% cross-currency, minimum 50 FCFA)
and limits (100 – 2,000,000 FCFA per transfer) are illustrative only and live at the top of `app.js`.
This is an unofficial concept, not affiliated with Orange.
