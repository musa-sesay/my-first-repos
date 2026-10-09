/* Orange Money Transfer — West Africa concept prototype.
   All rates, fees and limits below are placeholder values for the design. */

// The eight West African markets in scope. Nothing outside this list can be selected.
const COUNTRIES = [
  { code: "SN", flag: "🇸🇳", en: "Senegal",       fr: "Sénégal",        cur: "XOF", dial: "221", len: 9,  re: /^7\d{8}$/,  sample: "77 123 45 67" },
  { code: "CI", flag: "🇨🇮", en: "Côte d'Ivoire", fr: "Côte d'Ivoire",  cur: "XOF", dial: "225", len: 10, re: /^07\d{8}$/, sample: "07 07 12 34 56" },
  { code: "ML", flag: "🇲🇱", en: "Mali",          fr: "Mali",           cur: "XOF", dial: "223", len: 8,  re: /^\d{8}$/,   sample: "76 12 34 56" },
  { code: "BF", flag: "🇧🇫", en: "Burkina Faso",  fr: "Burkina Faso",   cur: "XOF", dial: "226", len: 8,  re: /^\d{8}$/,   sample: "07 12 34 56" },
  { code: "GW", flag: "🇬🇼", en: "Guinea-Bissau", fr: "Guinée-Bissau",  cur: "XOF", dial: "245", len: 9,  re: /^9\d{8}$/,  sample: "955 12 34 56" },
  { code: "GN", flag: "🇬🇳", en: "Guinea",        fr: "Guinée",         cur: "GNF", dial: "224", len: 9,  re: /^6\d{8}$/,  sample: "622 12 34 56" },
  { code: "SL", flag: "🇸🇱", en: "Sierra Leone",  fr: "Sierra Leone",   cur: "SLE", dial: "232", len: 8,  re: /^\d{8}$/,   sample: "76 123 456" },
  { code: "LR", flag: "🇱🇷", en: "Liberia",       fr: "Libéria",        cur: "LRD", dial: "231", len: 9,  re: /^7\d{8}$/,  sample: "77 123 4567" },
];
const byCode = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));

// Indicative units per 1 EUR (XOF is pegged at 655.957).
const PER_EUR = { XOF: 655.957, GNF: 10000, SLE: 25, LRD: 215 };
const DECIMALS = { XOF: 0, GNF: 0, SLE: 2, LRD: 2 };

// Fee schedule (placeholder): domestic, within the XOF zone, cross-currency.
const FEES = { domestic: 0.008, xof: 0.01, cross: 0.02, minXof: 50 };
const LIMITS_XOF = { min: 100, max: 2000000 };

const STARTING_BALANCE_XOF = 248500;

const I18N = {
  en: {
    tabHome: "Home", tabSend: "Send", tabHistory: "History", tabProfile: "Profile",
    hello: "Good morning", balance: "Available balance", show: "Show", hide: "Hide",
    send: "Send", receive: "Receive", airtime: "Airtime", bills: "Bills",
    corridorTitle: "Send across West Africa", corridorSub: "8 countries · instant to Orange Money wallets",
    recent: "Recent transfers", seeAll: "See all", noTx: "No transfers yet.",
    whereTo: "Where are you sending?", searchCountry: "Search country",
    regionNote: "Transfers are available to Orange Money wallets in West Africa only.",
    domestic: "Domestic", sameCur: "Same currency", noMatch: "No West African country matches",
    recipient: "Recipient", mobile: "Orange Money number", recipName: "Recipient name (optional)",
    namePh: "e.g. Aminata Diallo", recents: "Recent in", numHint: n => `${n} digits, e.g. `,
    badNum: n => `Enter a valid ${n}-digit Orange number.`, cont: "Continue",
    amount: "Amount", youSend: "You send", theyGet: "They receive",
    fee: "Transfer fee", rate: "Exchange rate", total: "Total debited", feeFromMe: "I pay the fee",
    noFeeFromMe: "Fee is taken from the amount sent",
    minErr: a => `Minimum is ${a}.`, maxErr: a => `Maximum per transfer is ${a}.`,
    balErr: "Not enough balance for this transfer and fee.",
    review: "Review transfer", sendingTo: "Sending to", arrives: "Arrives instantly",
    confirmPin: "Confirm and enter PIN", edit: "Edit",
    pinTitle: "Enter your PIN", pinSub: "4-digit Orange Money PIN",
    sent: "Transfer sent", sentSub: (a, n) => `${a} is on its way to ${n}.`,
    ref: "Reference", date: "Date", done: "Done", sendAgain: "Send again", share: "Share receipt",
    history: "History", profile: "Profile", lang: "Language", homeCountry: "My wallet country",
    theme: "Appearance", auto: "Auto", light: "Light", dark: "Dark",
    oos: "Not part of this design — only the transfer flow is built.",
    copied: "Receipt copied to clipboard", step: (a, b) => `Step ${a} of ${b}`,
    to: "To", phone: "Phone", country: "Country",
  },
  fr: {
    tabHome: "Accueil", tabSend: "Envoyer", tabHistory: "Historique", tabProfile: "Profil",
    hello: "Bonjour", balance: "Solde disponible", show: "Afficher", hide: "Masquer",
    send: "Envoyer", receive: "Recevoir", airtime: "Crédit", bills: "Factures",
    corridorTitle: "Envoyer en Afrique de l'Ouest", corridorSub: "8 pays · instantané vers Orange Money",
    recent: "Transferts récents", seeAll: "Tout voir", noTx: "Aucun transfert pour le moment.",
    whereTo: "Vers quel pays ?", searchCountry: "Rechercher un pays",
    regionNote: "Les transferts sont disponibles uniquement vers les comptes Orange Money d'Afrique de l'Ouest.",
    domestic: "National", sameCur: "Même devise", noMatch: "Aucun pays d'Afrique de l'Ouest ne correspond",
    recipient: "Bénéficiaire", mobile: "Numéro Orange Money", recipName: "Nom du bénéficiaire (facultatif)",
    namePh: "ex. Aminata Diallo", recents: "Récents –", numHint: n => `${n} chiffres, ex. `,
    badNum: n => `Saisissez un numéro Orange valide à ${n} chiffres.`, cont: "Continuer",
    amount: "Montant", youSend: "Vous envoyez", theyGet: "Il/elle reçoit",
    fee: "Frais de transfert", rate: "Taux de change", total: "Total débité", feeFromMe: "Je paie les frais",
    noFeeFromMe: "Les frais sont déduits du montant envoyé",
    minErr: a => `Le minimum est ${a}.`, maxErr: a => `Le maximum par transfert est ${a}.`,
    balErr: "Solde insuffisant pour ce transfert et les frais.",
    review: "Vérifier le transfert", sendingTo: "Envoi à", arrives: "Réception instantanée",
    confirmPin: "Confirmer et saisir le code", edit: "Modifier",
    pinTitle: "Saisissez votre code", pinSub: "Code secret Orange Money à 4 chiffres",
    sent: "Transfert envoyé", sentSub: (a, n) => `${a} est en route vers ${n}.`,
    ref: "Référence", date: "Date", done: "Terminé", sendAgain: "Renvoyer", share: "Partager le reçu",
    history: "Historique", profile: "Profil", lang: "Langue", homeCountry: "Pays de mon compte",
    theme: "Apparence", auto: "Auto", light: "Clair", dark: "Sombre",
    oos: "Hors du périmètre de cette maquette — seul le transfert est conçu.",
    copied: "Reçu copié dans le presse-papiers", step: (a, b) => `Étape ${a} sur ${b}`,
    to: "À", phone: "Téléphone", country: "Pays",
  },
};

const RECENT_CONTACTS = {
  SN: [["Aminata Diallo", "771234567"], ["Moussa Ndiaye", "781112233"]],
  CI: [["Koffi Yao", "0707123456"], ["Awa Koné", "0708998877"]],
  ML: [["Oumar Traoré", "76123456"]],
  BF: [["Salif Ouédraogo", "07123456"]],
  GW: [["Fatumata Baldé", "955123456"]],
  GN: [["Mamadou Camara", "622123456"], ["Kadiatou Bah", "628765432"]],
  SL: [["Fatmata Kamara", "76123456"]],
  LR: [["James Kollie", "771234567"]],
};

const state = {
  lang: "en",
  home: "SN",
  tab: "home",
  view: "home",
  hideBalance: false,
  balanceXof: STARTING_BALANCE_XOF, // stored in XOF, shown in the home country's currency
  history: [
    { to: "GN", name: "Mamadou Camara", phone: "622123456", sent: 50000, sentCur: "XOF", got: 762245, gotCur: "GNF", fee: 1000, ref: "OM-7Q2K9X", at: Date.now() - 864e5 },
    { to: "CI", name: "Koffi Yao", phone: "0707123456", sent: 25000, sentCur: "XOF", got: 25000, gotCur: "XOF", fee: 250, ref: "OM-4M8TZA", at: Date.now() - 3 * 864e5 },
    { to: "SL", name: "Fatmata Kamara", phone: "76123456", sent: 15000, sentCur: "XOF", got: 563.37, gotCur: "SLE", fee: 300, ref: "OM-9PL3RB", at: Date.now() - 6 * 864e5 },
  ],
  flow: null,
};

const newFlow = () => ({ dest: null, phone: "", name: "", amount: "", senderPays: true, pin: "", query: "" });

/* ---------- Helpers ---------- */
const $ = sel => document.querySelector(sel);
const t = key => I18N[state.lang][key];
const cname = c => c[state.lang];
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const homeCur = () => byCode[state.home].cur;

function round(n, cur) {
  const f = 10 ** DECIMALS[cur];
  return Math.round(n * f) / f;
}
function convert(n, from, to) {
  return round((n / PER_EUR[from]) * PER_EUR[to], to);
}
function fmt(n, cur) {
  const d = DECIMALS[cur];
  const s = new Intl.NumberFormat(state.lang === "fr" ? "fr-FR" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  return `${s} ${cur === "XOF" ? "FCFA" : cur}`;
}
function fmtPhone(c, p) {
  return `+${c.dial} ${p.replace(/(\d{2,3})(?=(\d{2})+$)/g, "$1 ").trim()}`;
}
function fmtDate(ts) {
  return new Intl.DateTimeFormat(state.lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(ts);
}
function parseAmount(s) {
  const n = parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function feeKind(from, to) {
  if (from.code === to.code) return "domestic";
  return from.cur === "XOF" && to.cur === "XOF" ? "xof" : "cross";
}

// Everything the amount, review and receipt screens show comes from this one quote.
function quote(f) {
  const from = byCode[state.home];
  const to = f.dest;
  const cur = from.cur;
  const amount = round(parseAmount(f.amount), cur);
  const minFee = convert(FEES.minXof, "XOF", cur);
  const fee = amount > 0 ? round(Math.max(minFee, amount * FEES[feeKind(from, to)]), cur) : 0;
  const net = f.senderPays ? amount : Math.max(0, round(amount - fee, cur));
  const debit = f.senderPays ? round(amount + fee, cur) : amount;
  const payout = convert(net, cur, to.cur);
  const min = convert(LIMITS_XOF.min, "XOF", cur);
  const max = convert(LIMITS_XOF.max, "XOF", cur);
  const balance = convert(state.balanceXof, "XOF", cur);
  let error = "";
  if (amount > 0 && amount < min) error = t("minErr")(fmt(min, cur));
  else if (amount > max) error = t("maxErr")(fmt(max, cur));
  else if (debit > balance) error = t("balErr");
  return { from, to, cur, amount, fee, net, debit, payout, error, ok: amount > 0 && !error && net > 0 };
}

function rateLine(fromCur, toCur) {
  if (fromCur === toCur) return "1 : 1";
  const unit = DECIMALS[fromCur] === 0 ? 1000 : 1;
  const v = (unit / PER_EUR[fromCur]) * PER_EUR[toCur];
  return `${fmt(unit, fromCur)} = ${new Intl.NumberFormat("en-US", { maximumFractionDigits: v >= 100 ? 0 : 2 }).format(v)} ${toCur}`;
}

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- Views ---------- */
function topbar(title, back, step) {
  return `
    <div class="topbar">
      ${back ? `<button class="back" data-go="${back}" aria-label="Back">←</button>` : ""}
      <h2>${title}</h2>
      ${step ? `<span class="chip">${t("step")(step, 4)}</span>` : ""}
    </div>
    ${step ? `<div class="steps">${[1, 2, 3, 4].map(i => `<span class="${i <= step ? "on" : ""}"></span>`).join("")}</div>` : ""}`;
}

function txRow(tx) {
  const c = byCode[tx.to];
  return `
    <div class="tx">
      <span class="flag">${c.flag}</span>
      <div class="who"><strong>${esc(tx.name || fmtPhone(c, tx.phone))}</strong><span>${cname(c)} · ${fmtDate(tx.at)}</span></div>
      <div class="val">−${fmt(tx.sent, tx.sentCur)}<span>+${fmt(tx.got, tx.gotCur)}</span></div>
    </div>`;
}

const views = {
  home() {
    const cur = homeCur();
    const bal = convert(state.balanceXof, "XOF", cur);
    const [whole, unit] = fmt(bal, cur).split(/ (?=\S+$)/);
    return `
      <div class="home-head">
        <div class="row">
          <div><div class="hello">${t("hello")},</div><div class="name">Musa</div></div>
          <div class="logo" aria-hidden="true">OM</div>
        </div>
      </div>
      <div class="card balance">
        <div class="label"><span>${t("balance")} · ${byCode[state.home].flag}</span>
          <button class="eye" data-act="toggle-balance">${state.hideBalance ? t("show") : t("hide")}</button></div>
        <div class="amt">${state.hideBalance ? "••••••" : whole} <small>${unit}</small></div>
      </div>
      <div class="pad">
        <div class="actions">
          <button class="action primary" data-act="start-send"><span class="ic">➤</span>${t("send")}</button>
          <button class="action" data-act="oos"><span class="ic">↓</span>${t("receive")}</button>
          <button class="action" data-act="oos"><span class="ic">✆</span>${t("airtime")}</button>
          <button class="action" data-act="oos"><span class="ic">▤</span>${t("bills")}</button>
        </div>
        <button class="card corridor" data-act="start-send" style="width:100%;text-align:left;margin-top:16px">
          <div style="flex:1"><strong>${t("corridorTitle")}</strong><p>${t("corridorSub")}</p></div>
          <span class="flags" aria-hidden="true">${COUNTRIES.slice(0, 4).map(c => c.flag).join("")}</span>
        </button>
        <div class="section-title" style="display:flex;justify-content:space-between">
          <span>${t("recent")}</span>
          <button class="eye" data-tab-go="history">${t("seeAll")}</button>
        </div>
        <div class="card">${state.history.slice(0, 3).map(txRow).join("") || `<div class="empty">${t("noTx")}</div>`}</div>
      </div>`;
  },

  country() {
    const f = state.flow;
    const q = f.query.trim().toLowerCase();
    const home = byCode[state.home];
    const list = COUNTRIES.filter(c => !q || c.en.toLowerCase().includes(q) || c.fr.toLowerCase().includes(q) || c.dial.includes(q));
    return `
      ${topbar(t("whereTo"), "home", 1)}
      <div class="pad">
        <input class="search" id="country-q" type="search" placeholder="${t("searchCountry")}" value="${esc(f.query)}" aria-label="${t("searchCountry")}">
        <div class="region-note"><span aria-hidden="true">🌍</span><span>${t("regionNote")}</span></div>
        <div class="card" style="margin-top:12px" id="country-list">
          ${list.map(c => `
            <button class="country" data-country="${c.code}">
              <span class="flag">${c.flag}</span>
              <span class="cname"><strong>${cname(c)}</strong><span>+${c.dial} · ${c.cur}</span></span>
              ${c.code === home.code ? `<span class="chip">${t("domestic")}</span>` : c.cur === home.cur ? `<span class="chip ok">${t("sameCur")}</span>` : ""}
            </button>`).join("") || `<div class="empty">${t("noMatch")} “${esc(f.query)}”.</div>`}
        </div>
      </div>`;
  },

  recipient() {
    const f = state.flow;
    const c = f.dest;
    const contacts = RECENT_CONTACTS[c.code] || [];
    return `
      ${topbar(t("recipient"), "country", 2)}
      <div class="pad">
        <div class="field">
          <label for="phone">${t("mobile")}</label>
          <div class="phone-input">
            <span class="prefix"><span class="flag" style="font-size:18px">${c.flag}</span>+${c.dial}</span>
            <input id="phone" inputmode="numeric" autocomplete="tel-national" maxlength="${c.len}" placeholder="${c.sample}" value="${esc(f.phone)}">
          </div>
          <div class="hint" id="phone-hint">${t("numHint")(c.len)}${c.sample}</div>
        </div>
        <div class="field">
          <label for="rname">${t("recipName")}</label>
          <input id="rname" autocomplete="name" placeholder="${t("namePh")}" value="${esc(f.name)}">
        </div>
        ${contacts.length ? `
          <div class="section-title">${t("recents")} ${cname(c)}</div>
          <div class="contacts">
            ${contacts.map(([n, p]) => `
              <button class="contact" data-contact="${esc(n)}|${p}">
                <span class="avatar">${esc(n.split(" ").map(w => w[0]).join(""))}</span>
                <span>${esc(n.split(" ")[0])}</span>
              </button>`).join("")}
          </div>` : ""}
      </div>
      <div class="footer-cta"><button class="btn" id="to-amount" ${c.re.test(f.phone) ? "" : "disabled"}>${t("cont")}</button></div>`;
  },

  amount() {
    const f = state.flow;
    const q = quote(f);
    return `
      ${topbar(t("amount"), "recipient", 3)}
      <div class="pad">
        <div class="card">
          <div class="amount-box">
            <label for="amt">${t("youSend")}</label>
            <div class="amount-row">
              <input id="amt" inputmode="decimal" placeholder="0" value="${esc(f.amount)}" aria-describedby="amt-err">
              <span class="cur"><span class="flag" style="font-size:18px">${q.from.flag}</span>${q.cur === "XOF" ? "FCFA" : q.cur}</span>
            </div>
            <div class="quick">
              ${[5000, 10000, 25000, 50000].map(v => convert(v, "XOF", q.cur)).map(v => `<button data-quick="${v}">${fmt(v, q.cur)}</button>`).join("")}
            </div>
          </div>
          <div class="amount-box">
            <label>${t("theyGet")} · ${esc(f.name || fmtPhone(q.to, f.phone))}</label>
            <div class="amount-row">
              <span class="out" id="payout">${fmt(q.payout, q.to.cur).split(" ")[0]}</span>
              <span class="cur"><span class="flag" style="font-size:18px">${q.to.flag}</span>${q.to.cur === "XOF" ? "FCFA" : q.to.cur}</span>
            </div>
          </div>
        </div>
        <div class="hint err" id="amt-err" role="alert" style="font-size:13px;margin-top:8px;color:var(--err)">${q.error}</div>
        <div class="card" style="margin-top:12px">
          <div class="toggle">
            <span id="fee-mode">${f.senderPays ? t("feeFromMe") : t("noFeeFromMe")}</span>
            <button class="switch" role="switch" aria-checked="${f.senderPays}" aria-labelledby="fee-mode" data-act="toggle-fee"></button>
          </div>
        </div>
        <div class="card breakdown" style="margin-top:12px" id="breakdown">${breakdown(q)}</div>
      </div>
      <div class="footer-cta"><button class="btn" id="to-review" ${q.ok ? "" : "disabled"}>${t("cont")}</button></div>`;
  },

  review() {
    const f = state.flow;
    const q = quote(f);
    return `
      ${topbar(t("review"), "amount", 4)}
      <div class="review-hero">
        <p>${t("sendingTo")}</p>
        <div class="big">${fmt(q.payout, q.to.cur)}</div>
        <div class="route"><span>${q.from.flag} ${cname(q.from)}</span><span class="arrow">→</span><span>${q.to.flag} ${cname(q.to)}</span></div>
        <p style="margin-top:8px">⚡ ${t("arrives")}</p>
      </div>
      <div class="pad">
        <div class="card breakdown">
          <div class="line"><span>${t("to")}</span><span>${esc(f.name || "—")}</span></div>
          <div class="line"><span>${t("phone")}</span><span>${fmtPhone(q.to, f.phone)}</span></div>
          ${breakdown(q)}
        </div>
      </div>
      <div class="footer-cta" style="display:grid;gap:8px">
        <button class="btn" data-go="pin">${t("confirmPin")}</button>
        <button class="btn ghost" data-go="amount">${t("edit")}</button>
      </div>`;
  },

  pin() {
    const n = state.flow.pin.length;
    return `
      ${topbar("", "review")}
      <div class="pin-wrap">
        <h3>${t("pinTitle")}</h3>
        <p>${t("pinSub")}</p>
        <div class="dots" aria-label="${n} of 4 digits entered">${[0, 1, 2, 3].map(i => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</div>
        <div class="keypad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button data-key="${d}">${d}</button>`).join("")}
          <button class="blank" tabindex="-1" aria-hidden="true"></button>
          <button data-key="0">0</button>
          <button data-key="del" aria-label="Delete">⌫</button>
        </div>
      </div>`;
  },

  success() {
    const tx = state.history[0];
    const c = byCode[tx.to];
    return `
      <div class="success">
        <div class="tick" aria-hidden="true">✓</div>
        <h3>${t("sent")}</h3>
        <p>${t("sentSub")(fmt(tx.got, tx.gotCur), esc(tx.name || fmtPhone(c, tx.phone)))}</p>
      </div>
      <div class="pad">
        <div class="card breakdown">
          <div class="line"><span>${t("ref")}</span><span class="ref">${tx.ref}</span></div>
          <div class="line"><span>${t("date")}</span><span>${fmtDate(tx.at)}</span></div>
          <div class="line"><span>${t("country")}</span><span>${c.flag} ${cname(c)}</span></div>
          <div class="line"><span>${t("phone")}</span><span>${fmtPhone(c, tx.phone)}</span></div>
          <div class="line"><span>${t("youSend")}</span><span>${fmt(tx.sent, tx.sentCur)}</span></div>
          <div class="line"><span>${t("fee")}</span><span>${fmt(tx.fee, tx.sentCur)}</span></div>
          <div class="line total"><span>${t("theyGet")}</span><span>${fmt(tx.got, tx.gotCur)}</span></div>
        </div>
      </div>
      <div class="footer-cta" style="display:grid;gap:8px">
        <button class="btn" data-act="finish">${t("done")}</button>
        <button class="btn ghost" data-act="share">${t("share")}</button>
      </div>`;
  },

  history() {
    return `
      ${topbar(t("history"))}
      <div class="pad"><div class="card">${state.history.map(txRow).join("") || `<div class="empty">${t("noTx")}</div>`}</div></div>`;
  },

  profile() {
    const theme = document.documentElement.dataset.theme || "auto";
    return `
      ${topbar(t("profile"))}
      <div class="pad">
        <div class="card">
          <div class="profile-row"><span>${t("lang")}</span>
            <span class="seg">${["en", "fr"].map(l => `<button data-lang="${l}" class="${state.lang === l ? "on" : ""}">${l.toUpperCase()}</button>`).join("")}</span></div>
          <div class="profile-row"><label for="home-c">${t("homeCountry")}</label>
            <select class="select" id="home-c">${COUNTRIES.map(c => `<option value="${c.code}" ${c.code === state.home ? "selected" : ""}>${c.flag} ${cname(c)}</option>`).join("")}</select></div>
          <div class="profile-row"><span>${t("theme")}</span>
            <span class="seg">${["auto", "light", "dark"].map(m => `<button data-theme="${m}" class="${theme === m ? "on" : ""}">${t(m)}</button>`).join("")}</span></div>
        </div>
      </div>`;
  },
};

function breakdown(q) {
  return `
    <div class="line"><span>${t("youSend")}</span><span>${fmt(q.amount, q.cur)}</span></div>
    <div class="line"><span>${t("fee")}</span><span>${fmt(q.fee, q.cur)}</span></div>
    <div class="line"><span>${t("rate")}</span><span>${rateLine(q.cur, q.to.cur)}</span></div>
    <div class="line total"><span>${t("total")}</span><span>${fmt(q.debit, q.cur)}</span></div>`;
}

/* ---------- Rendering & navigation ---------- */
const FLOW_VIEWS = ["country", "recipient", "amount", "review", "pin", "success"];

function render() {
  document.documentElement.lang = state.lang;
  $("#screen").innerHTML = views[state.view]();
  $("#screen").scrollTop = 0;
  $("#tabbar").classList.toggle("hidden", FLOW_VIEWS.includes(state.view) && state.view !== "country");
  document.querySelectorAll("#tabbar button").forEach(b => b.classList.toggle("active", b.dataset.tab === state.tab));
  document.querySelectorAll("[data-i18n]").forEach(el => (el.textContent = t(el.dataset.i18n)));
}

function go(view) {
  if (view === "home") { state.tab = "home"; state.flow = null; }
  if (view === "pin") state.flow.pin = "";
  state.view = view;
  render();
}

function startSend() {
  state.flow = newFlow();
  state.tab = "send";
  go("country");
}

function completeTransfer() {
  if (state.view !== "pin") return;
  const q = quote(state.flow);
  state.balanceXof = Math.max(0, state.balanceXof - convert(q.debit, q.cur, "XOF"));
  const ref = "OM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  state.history.unshift({
    to: q.to.code, name: state.flow.name.trim(), phone: state.flow.phone,
    sent: q.amount, sentCur: q.cur, got: q.payout, gotCur: q.to.cur, fee: q.fee, ref, at: Date.now(),
  });
  state.view = "success";
  render();
}

// Partial updates keep focus inside inputs while typing.
function refreshAmount() {
  const q = quote(state.flow);
  $("#payout").textContent = fmt(q.payout, q.to.cur).split(" ")[0];
  $("#breakdown").innerHTML = breakdown(q);
  $("#amt-err").textContent = q.error;
  $("#to-review").disabled = !q.ok;
}

function refreshPhone() {
  const c = state.flow.dest;
  const p = state.flow.phone;
  const valid = c.re.test(p);
  const showErr = p.length >= c.len && !valid;
  $("#phone").classList.toggle("bad", showErr);
  const hint = $("#phone-hint");
  hint.classList.toggle("err", showErr);
  hint.textContent = showErr ? t("badNum")(c.len) : t("numHint")(c.len) + c.sample;
  $("#to-amount").disabled = !valid;
}

document.addEventListener("click", e => {
  const el = e.target.closest("button");
  if (!el) return;
  const d = el.dataset;

  if (d.tab) {
    if (d.tab === "send") return startSend();
    state.tab = d.tab; state.flow = null; state.view = d.tab; return render();
  }
  if (d.tabGo) { state.tab = d.tabGo; state.view = d.tabGo; return render(); }
  if (d.go) return go(d.go);
  if (d.country) { state.flow.dest = byCode[d.country]; state.flow.phone = ""; return go("recipient"); }
  if (d.contact) {
    const [n, p] = d.contact.split("|");
    state.flow.name = n; state.flow.phone = p;
    return go("amount");
  }
  if (d.quick) { state.flow.amount = d.quick; $("#amt").value = d.quick; return refreshAmount(); }
  if (d.key) {
    const f = state.flow;
    if (d.key === "del") f.pin = f.pin.slice(0, -1);
    else if (f.pin.length < 4) f.pin += d.key;
    render();
    if (f.pin.length === 4) setTimeout(completeTransfer, 350);
    return;
  }
  if (d.lang) { state.lang = d.lang; return render(); }
  if (d.theme) {
    if (d.theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = d.theme;
    return render();
  }
  if (el.id === "to-amount") return go("amount");
  if (el.id === "to-review") return go("review");

  switch (d.act) {
    case "start-send": return startSend();
    case "toggle-balance": state.hideBalance = !state.hideBalance; return render();
    case "toggle-fee": state.flow.senderPays = !state.flow.senderPays; return render();
    case "oos": return toast(t("oos"));
    case "finish": return go("home");
    case "share": {
      const tx = state.history[0];
      const text = `Orange Money · ${tx.ref} · ${fmt(tx.got, tx.gotCur)} → ${fmtPhone(byCode[tx.to], tx.phone)}`;
      navigator.clipboard?.writeText(text).then(() => toast(t("copied")), () => toast(text));
      return;
    }
  }
});

document.addEventListener("input", e => {
  const f = state.flow;
  if (e.target.id === "country-q") {
    f.query = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const input = $("#country-q");
    input.focus();
    input.setSelectionRange(pos, pos);
  } else if (e.target.id === "phone") {
    f.phone = e.target.value.replace(/\D/g, "").slice(0, f.dest.len);
    e.target.value = f.phone;
    refreshPhone();
  } else if (e.target.id === "rname") {
    f.name = e.target.value;
  } else if (e.target.id === "amt") {
    const dec = DECIMALS[homeCur()];
    let v = e.target.value.replace(/[^\d.,]/g, "");
    if (!dec) v = v.replace(/[.,]/g, "");
    f.amount = v;
    e.target.value = v;
    refreshAmount();
  }
});

document.addEventListener("change", e => {
  if (e.target.id === "home-c") { state.home = e.target.value; render(); }
});

document.addEventListener("keydown", e => {
  if (state.view !== "pin") return;
  if (/^\d$/.test(e.key)) $(`[data-key="${e.key}"]`)?.click();
  else if (e.key === "Backspace") $(`[data-key="del"]`)?.click();
});

render();
