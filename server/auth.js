// Sign-in sessions, roles and the small helpers every route needs.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, now } = require('./db');

const PROD = process.env.NODE_ENV === 'production';
const COOKIE = 'izwi_sid';
const DAYS = 14;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const hashSecret = s => bcrypt.hashSync(s, 10);
const checkSecret = (s, hash) => !!hash && bcrypt.compareSync(s, hash);

const year = () => new Date().getFullYear();
const age = u => year() - u.birth_year;
const band = u => (age(u) >= 16 ? 'o' : 'y');           // y: 13 to 15, o: 16 to 18
const hasConsent = u => u.consent === 'yes';
// A member may post once consent is in place and, on the school and community routes, a teacher or leader has confirmed them.
const canPost = u => u.role === 'member' && !u.disabled && hasConsent(u) && (u.route === 'own' || !!u.vouched);

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)').run(sha(token), userId, expires);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${DAYS * 86400}${PROD ? '; Secure' : ''}`);
}
function endSession(req, res) {
  const t = readCookie(req);
  if (t) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(t));
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}
function readCookie(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|; )${COOKIE}=([a-f0-9]{64})`));
  return m ? m[1] : null;
}
// Runs on every request. Sets req.user when the visitor is signed in.
function loadUser(req, _res, next) {
  const t = readCookie(req);
  if (t) {
    const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(sha(t), now());
    if (row && !row.disabled) req.user = row;
  }
  next();
}
const need = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please sign in first.'));
  if (roles.length && !roles.includes(req.user.role)) return next(new HttpError(403, 'This page is not for your account.'));
  next();
};
// Browsers do not let other websites add this header, so it blocks forged requests.
const csrf = (req, _res, next) => {
  if (req.method !== 'GET' && req.headers['x-izwi'] !== '1') return next(new HttpError(403, 'Request blocked.'));
  next();
};
// Slows down guessing of secret words and codes. In memory, which is enough for one server.
const hits = new Map();
function limit(key, max = 10, minutes = 15) {
  const t = Date.now(), rec = hits.get(key) || { n: 0, until: t + minutes * 6e4 };
  if (t > rec.until) { rec.n = 0; rec.until = t + minutes * 6e4; }
  rec.n++; hits.set(key, rec);
  if (rec.n > max) fail(429, 'Too many tries. Wait a few minutes and try again.');
}
const clearLimit = key => hits.delete(key);

function normalisePhone(raw) {
  let p = String(raw || '').replace(/[\s()-]/g, '');
  const cc = process.env.DEFAULT_COUNTRY_CODE || '+254';
  if (/^0\d{9}$/.test(p)) p = cc + p.slice(1);
  if (!/^\+\d{9,15}$/.test(p)) fail(400, 'That phone number does not look right. Use the format 07XX XXX XXX.');
  return p;
}

module.exports = { HttpError, fail, sha, hashSecret, checkSecret, age, band, canPost, hasConsent, startSession, endSession, loadUser, need, csrf, limit, clearLimit, normalisePhone, PROD };
