// Sample rates for the prototype only, not live market data.
const COUNTRIES = {
  SL: { name: "Sierra Leone",  cur: "SLE", rate: 22850 },
  GN: { name: "Guinea",        cur: "GNF", rate: 8620 },
  SN: { name: "Senegal",       cur: "XOF", rate: 565 },
  CI: { name: "Côte d’Ivoire", cur: "XOF", rate: 565 },
  ML: { name: "Mali",          cur: "XOF", rate: 565 },
  CM: { name: "Cameroon",      cur: "XAF", rate: 565 },
  LR: { name: "Liberia",       cur: "LRD", rate: 192 },
};

const TX = [
  { who: "Aminata Kamara", flag: "🇸🇱", c: "#FF7900", ini: "AK", usd: 200, recv: "4,570,000 SLE", when: "Today, 8:12 AM", status: "ok" },
  { who: "Ibrahim Bah",    flag: "🇬🇳", c: "#2B6CB0", ini: "IB", usd: 150, recv: "1,293,000 GNF", when: "Oct 6", status: "pending" },
  { who: "Fatou Sow",      flag: "🇸🇳", c: "#38A169", ini: "FS", usd: 300, recv: "169,500 XOF",   when: "Oct 2", status: "ok" },
  { who: "Kofi Diallo",    flag: "🇨🇮", c: "#805AD5", ini: "KD", usd: 100, recv: "56,500 XOF",    when: "Sep 28", status: "ok" },
  { who: "Mariama Sesay",  flag: "🇸🇱", c: "#D69E2E", ini: "MS", usd: 100, recv: "2,285,000 SLE", when: "Sep 21", status: "ok" },
];

const $ = (s) => document.querySelector(s);
const usd = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => Math.round(n).toLocaleString("en-US");

function txItem(t) {
  const label = t.status === "ok" ? "Delivered" : "In progress";
  return `<li>
    <span class="av-sm" style="--c:${t.c}">${t.ini}</span>
    <div class="tx-body"><b>${t.who} ${t.flag}</b><small>${t.when} · <span class="status ${t.status}">${label}</span></small></div>
    <div class="tx-amt">−${usd(t.usd)}<small>${t.recv}</small></div>
  </li>`;
}
$("#home-tx").innerHTML = TX.slice(0, 3).map(txItem).join("");
$("#all-tx").innerHTML = TX.map(txItem).join("");

// ----- Navigation -----
const phone = $(".phone");
const FLOW = ["send", "review", "success"];
function go(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  document.querySelectorAll(".tabbar button:not(.fab)").forEach((b) => b.classList.toggle("on", b.dataset.go === id));
  phone.classList.toggle("flow", FLOW.includes(id));
  $("#" + id).scrollTop = 0;
}
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-go]");
  if (el) go(el.dataset.go);
});

// ----- Quote calculator -----
const state = { fee: 2.99, eta: "Within minutes", method: "Orange Money" };
function quote() {
  const amt = parseFloat($("#amt").value.replace(/[^0-9.]/g, "")) || 0;
  const c = COUNTRIES[$("#country").value];
  const recv = num(amt * c.rate);
  const total = amt + state.fee;
  const rate = `1 USD = ${num(c.rate)} ${c.cur}`;

  $("#recv").textContent = recv;
  $("#rate-label").textContent = rate;
  $("#fee").textContent = usd(state.fee);
  $("#total").innerHTML = `<b>${usd(total)}</b>`;
  $("#eta").textContent = state.eta;

  $("#r-recv").textContent = `${recv} ${c.cur}`;
  $("#r-eta").textContent = state.eta;
  $("#r-amt").textContent = usd(amt);
  $("#r-fee").textContent = usd(state.fee);
  $("#r-total").textContent = usd(total);
  $("#r-rate").textContent = rate;
  $("#r-dest").textContent = `${state.method} · ${c.name}`;
  document.querySelector('#review .cta').textContent = `Send ${usd(total)}`;
  $("#s-msg").textContent = `Aminata will receive ${recv} ${c.cur} via ${state.method} in ${c.name}. Estimated: ${state.eta.toLowerCase()}.`;
}
$("#amt").addEventListener("input", quote);
$("#country").addEventListener("change", quote);
document.querySelectorAll(".seg-opt").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".seg-opt").forEach((x) => x.classList.toggle("on", x === b));
    state.fee = parseFloat(b.dataset.fee);
    state.eta = b.dataset.eta;
    state.method = b.textContent.replace(/^\S+\s/, "");
    quote();
  })
);
quote();
