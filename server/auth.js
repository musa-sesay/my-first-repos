import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { HttpError, normalizePhone, text } from './lib.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'kassa_session';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function adminPhones() {
  return (process.env.KASSA_ADMIN_PHONES || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => normalizePhone(p));
}

// No SMS gateway is wired up yet. Outside production the code is logged and
// returned to the client so the flow can be tested end to end.
async function sendSms(phone, message) {
  if (process.env.NODE_ENV === 'production') {
    throw new HttpError(503, 'Envoi de SMS non configuré.');
  }
  console.log(`[sms] ${phone}: ${message}`);
}

export async function requestCode(db, rawPhone) {
  const phone = normalizePhone(rawPhone);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  db.prepare(
    `INSERT INTO otp_codes (phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
     ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`
  ).run(phone, sha256(phone + ':' + code), Date.now() + OTP_TTL_MS);
  await sendSms(phone, `Votre code Kassa : ${code}`);
  return process.env.NODE_ENV === 'production' ? { phone } : { phone, devCode: code };
}

export function verifyCode(db, rawPhone, rawCode, rawName) {
  const phone = normalizePhone(rawPhone);
  const code = String(rawCode ?? '').trim();
  const row = db.prepare('SELECT * FROM otp_codes WHERE phone = ?').get(phone);
  if (!row || row.expires_at < Date.now()) throw new HttpError(400, 'Code expiré. Demandez un nouveau code.');
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'Trop d’essais. Demandez un nouveau code.');
  const expected = Buffer.from(row.code_hash, 'hex');
  const given = Buffer.from(sha256(phone + ':' + code), 'hex');
  if (!timingSafeEqual(expected, given)) {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?').run(phone);
    throw new HttpError(400, 'Code incorrect.');
  }
  db.prepare('DELETE FROM otp_codes WHERE phone = ?').run(phone);

  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    const name = text(rawName, 'nom', { max: 80, optional: true }) || null;
    const id = db.prepare('INSERT INTO users (phone, name) VALUES (?, ?)').run(phone, name).lastInsertRowid;
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
  if (adminPhones().includes(phone) && user.role !== 'admin') {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
    user.role = 'admin';
  }

  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(token), user.id, Date.now() + SESSION_TTL_MS
  );
  return { token, user };
}

export function logout(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function sessionToken(req) {
  return readCookie(req, SESSION_COOKIE);
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/'
  });
}

// Attaches req.user when a valid session cookie is present.
export function loadUser(db) {
  const find = db.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'
  );
  return (req, _res, next) => {
    const token = sessionToken(req);
    req.user = token ? find.get(sha256(token), Date.now()) || null : null;
    next();
  };
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Connexion requise.'));
    if (roles.length && !roles.includes(req.user.role)) return next(new HttpError(403, 'Accès refusé.'));
    next();
  };
}

export function publicUser(u) {
  return u && { id: u.id, phone: u.phone, name: u.name, role: u.role };
}
