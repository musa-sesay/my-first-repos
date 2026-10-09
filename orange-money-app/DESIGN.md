# Orange Money Transfer: design & style guide

A concept mobile app for US-based senders moving money to Orange Money wallets,
bank accounts and cash pickup in West & Central Africa.

Open `index.html` in a browser to click through the prototype.

## Screens
| Screen | Purpose |
|---|---|
| Home | USD balance, today's rate, "Send again" contacts, recent activity |
| Send | Recipient, amount in USD → live payout in local currency, delivery method, funding source, fee and total |
| Review | Pre-payment disclosure: amount, fee, taxes, total, rate, amount received, delivery time, 30-minute cancellation notice (per the US CFPB Remittance Transfer Rule) |
| Success | Confirmation plus a three-step delivery tracker |
| People | Saved recipients with search |
| Activity | Monthly totals and full transfer history with status |
| Account | KYC status, sending limit, payment methods, security, referrals |

## Color
| Token | Value | Use |
|---|---|---|
| `--orange` | `#FF7900` | Primary actions, brand, active states |
| `--orange-600` | `#E86A00` | Hover, orange text on light tints |
| `--orange-50` | `#FFF3E8` | Selected/tinted surfaces |
| `--ink` | `#111111` | Primary text |
| `--ink-2` | `#4A4A4A` | Secondary text |
| `--muted` | `#8A8A8A` | Captions, metadata |
| `--bg` | `#F6F3F0` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | Cards |
| `--green` | `#12A150` | Success, delivered, rate up |

A dark theme is included and follows the system setting.

## Type
Inter, with these sizes: 40/800 for the balance, 32/800 for amount inputs, 20/700 for screen titles,
17/700 for section heads, 15/600 for list titles, 12–13 for captions.

## Shape & spacing
Radii are 24 (hero cards), 16 (cards, buttons) and 12 (chips, segments). Screen gutter is 20px.
Cards are flat white on a warm background. Only orange elements carry a soft colored shadow.

## US-market considerations
- Funding by ACH (cheapest), debit card and Apple Pay; prices are shown in USD.
- Tiered KYC limits ($3,000/month, or $10,000 after SSN verification).
- Required remittance disclosures on Review before the user pays.
- Exchange rates in `app.js` are sample values, not live data.
