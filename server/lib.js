// Shared helpers: HTTP errors, input checks and domain constants.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const COMMUNES = ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto'];
export const PAYMENT_METHODS = ['orange_money', 'mtn_momo', 'cash', 'card'];
export const BILLING_METHODS = ['orange_money', 'mtn_momo', 'card'];
export const TRIAL_DAYS = Number(process.env.KASSA_TRIAL_DAYS || 14);

// Guinean mobile numbers: +224 followed by 9 digits starting with 6.
export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  const local = digits.startsWith('224') ? digits.slice(3) : digits;
  if (!/^6\d{8}$/.test(local)) throw new HttpError(400, 'Numéro de téléphone invalide (format : 6XX XX XX XX).');
  return '+224' + local;
}

export function text(value, field, { max = 200, optional = false } = {}) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) {
    if (optional) return '';
    throw new HttpError(400, `Champ requis : ${field}.`);
  }
  if (s.length > max) throw new HttpError(400, `Champ trop long : ${field}.`);
  return s;
}

export function int(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `Valeur invalide : ${field}.`);
  return n;
}

export function oneOf(value, list, field) {
  if (!list.includes(value)) throw new HttpError(400, `Valeur invalide : ${field}.`);
  return value;
}

export function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

// A trial past its end date counts as unpaid until the restaurant pays.
export function effectiveSubscriptionStatus(sub, now = new Date()) {
  if (!sub) return null;
  if (sub.status === 'trial' && sub.trial_ends_at && new Date(sub.trial_ends_at + 'Z') < now) return 'past_due';
  return sub.status;
}

export function isListable(sub) {
  const s = effectiveSubscriptionStatus(sub);
  return s === 'trial' || s === 'active';
}

export function sqlDate(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
