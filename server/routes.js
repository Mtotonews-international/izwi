// Every action the browser can ask for. Each route checks who is asking before it changes anything.
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const C = require('../public/content.js');
const { db, now, log, UPLOAD_DIR } = require('./db');
const A = require('./auth');
const { fail, need, band, age, canPost } = A;
const { flagOf } = require('./filter');
const { sendSms } = require('./sms');
const { stateFor, canSeeWork, parse } = require('./state');

const r = express.Router();
const MAX_MB = +(process.env.MAX_UPLOAD_MB || 100);
const ALLOWED = /^(audio\/|video\/|image\/(png|jpeg|webp|gif)$|application\/pdf$|text\/plain$)/;
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_q, _f, cb) => cb(null, crypto.randomBytes(16).toString('hex')) }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_q, f, cb) => (ALLOWED.test(f.mimetype) ? cb(null, true) : cb(new A.HttpError(400, 'That kind of file is not allowed. Use audio, video, a picture, a PDF or plain text.')))
});
const h = fn => (req, res, next) => Promise.resolve(fn(req, res)).then(out => { if (!res.headersSent) res.json(out || { ok: true }); }).catch(next);
const str = (v, max, label, min = 1) => {
  const s = String(v ?? '').trim();
  if (s.length < min) fail(400, `${label} is missing.`);
  if (s.length > max) fail(400, `${label} is too long.`);
  return s;
};
const getUser = id => db.prepare('SELECT * FROM users WHERE id=?').get(id);
const mustPost = u => { if (!canPost(u)) fail(403, u.consent !== 'yes' ? 'You cannot post until your guardian says yes.' : 'Your teacher or leader has not confirmed you yet.'); };
const addItem = (u, o) => {
  const flag = flagOf(`${o.title || ''} ${o.body || ''} ${o.content || ''} ${o.credit || ''}`);
  return db.prepare(`INSERT INTO items (kind,user_id,group_id,cause_id,work_id,fmt,cat,title,body,content,credit,audience,file_path,file_name,mime,status,flag,created_at)
    VALUES (@kind,@user_id,@group_id,@cause_id,@work_id,@fmt,@cat,@title,@body,@content,@credit,@audience,@file_path,@file_name,@mime,@status,@flag,@created_at)`)
    .run({ group_id: u.group_id, cause_id: null, work_id: null, fmt: null, cat: null, title: '', body: '', content: '', credit: '', audience: '[]', file_path: null, file_name: null, mime: null, status: 'review', ...o, user_id: u.id, flag, created_at: now() }).lastInsertRowid;
};

/* ---------- state ---------- */
r.get('/state', h(req => stateFor(req.user)));

/* ---------- joining and signing in ---------- */
r.post('/signup', h((req, res) => {
  A.limit('signup:' + req.ip, 20, 60);
  const b = req.body, nickname = str(b.nickname, 20, 'Your nickname', 3);
  if (!/^[\p{L}\p{N}_ ]+$/u.test(nickname)) fail(400, 'Use only letters, numbers and spaces in your nickname.');
  if (nickname.trim().split(/\s+/).length > 2) fail(400, 'Pick a short nickname, not your full name.');
  const secret = str(b.secret, 60, 'Your secret word', 6);
  const by = +b.birthYear, a = new Date().getFullYear() - by;
  if (!(a >= 13 && a <= 18)) fail(400, 'Izwi is open to ages 13 to 18 for now.');
  if (!C.COUNTRIES.includes(b.country)) fail(400, 'Choose your country.');
  if (!C.ROUTES[b.route]) fail(400, 'Choose how you are joining.');
  let g;
  if (b.route === 'own') g = db.prepare("SELECT * FROM groups WHERE kind='open'").get();
  else {
    g = db.prepare('SELECT * FROM groups WHERE code=? AND kind=?').get(String(b.code || '').trim().toUpperCase(), b.route);
    if (!g) fail(400, 'We could not find that code. Check it with your teacher or leader.');
  }
  const username = nickname.toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) fail(400, 'Someone already has that nickname. Try another one.');
  const o = a >= 16 ? 1 : 0;
  const id = db.prepare(`INSERT INTO users (role,username,display,secret_hash,birth_year,country,route,group_id,vouched,avatar,color,share_beyond,created_at)
    VALUES ('member',?,?,?,?,?,?,?,?,?,?,?,?)`).run(username, nickname, A.hashSecret(secret), by, b.country, b.route, g.id, b.route === 'own' ? 1 : 0,
    C.AVATARS.includes(b.avatar) ? b.avatar : C.AVATARS[0], C.COLORS.includes(b.color) ? b.color : C.COLORS[0], o, now()).lastInsertRowid;
  log(id, 'member joined', id, b.route);
  A.startSession(res, id);
}));
r.post('/login', h((req, res) => {
  const username = str(req.body.username, 120, 'Your name').toLowerCase(), key = 'login:' + username;
  A.limit(key);
  const u = db.prepare("SELECT * FROM users WHERE username=? AND role!='guardian'").get(username);
  if (!u || u.disabled || !A.checkSecret(String(req.body.secret || ''), u.secret_hash)) fail(401, 'That name and secret word do not match.');
  A.clearLimit(key);
  A.startSession(res, u.id);
}));
r.post('/logout', h((req, res) => A.endSession(req, res)));

/* ---------- guardians: sign in with a code sent to their phone ---------- */
async function sendCode(phone, text) {
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare('INSERT OR REPLACE INTO otps (phone, code_hash, expires_at, attempts) VALUES (?,?,?,0)').run(phone, A.sha(code), new Date(Date.now() + 10 * 6e4).toISOString());
  await sendSms(phone, text(code));
  return A.PROD ? {} : { devCode: code };       // outside production the code is returned so the flow can be tested without SMS
}
r.post('/guardian/start', h(async req => {
  const phone = A.normalisePhone(req.body.phone);
  A.limit('otp:' + phone, 5, 30);
  if (!db.prepare('SELECT 1 FROM users WHERE username=?').get('g:' + phone)) return { ok: true };    // same answer whether or not the number is known
  return { ok: true, ...(await sendCode(phone, c => `Your Izwi code is ${c}. It works for 10 minutes. Do not share it.`)) };
}));
r.post('/guardian/verify', h((req, res) => {
  const phone = A.normalisePhone(req.body.phone);
  A.limit('otpv:' + phone, 8, 30);
  const o = db.prepare('SELECT * FROM otps WHERE phone=?').get(phone), u = db.prepare('SELECT * FROM users WHERE username=?').get('g:' + phone);
  if (!o || !u || o.expires_at < now() || o.code_hash !== A.sha(String(req.body.code || '').trim())) fail(401, 'That code is not right, or it has run out. Ask for a new one.');
  db.prepare('DELETE FROM otps WHERE phone=?').run(phone);
  A.startSession(res, u.id);
}));
const myChild = (g, id) => { const k = getUser(id); if (!k || k.guardian_id !== g.id) fail(404, 'Child not found.'); return k; };
r.post('/guardian/child/:id', need('guardian'), h(req => {
  const k = myChild(req.user, req.params.id), b = req.body;
  if (b.consent === 'yes' || b.consent === 'withdrawn') {
    db.prepare('UPDATE users SET consent=?, consent_at=? WHERE id=?').run(b.consent, now(), k.id);
    log(req.user.id, 'guardian consent ' + b.consent, k.id);
  }
  if (typeof b.shareBeyond === 'boolean') db.prepare('UPDATE users SET share_beyond=? WHERE id=?').run(+b.shareBeyond, k.id);
  if (typeof b.smsSummary === 'boolean') db.prepare('UPDATE users SET sms_summary=? WHERE id=?').run(+b.smsSummary, k.id);
  if (b.helpDone) db.prepare("UPDATE help_requests SET status='closed' WHERE user_id=? AND kind='talk'").run(k.id);
}));
r.post('/guardian/cause/:id', need('guardian'), h(req => {
  const c = db.prepare("SELECT * FROM causes WHERE id=? AND status='cosign' AND cosign_by='guardian'").get(req.params.id);
  if (!c) fail(404, 'Cause not found.');
  myChild(req.user, c.user_id);
  cosign(req.user, c, req.body.action);
}));
function cosign(actor, c, action) {
  if (action === 'cosign') db.prepare("UPDATE causes SET status='review' WHERE id=?").run(c.id);
  else db.prepare("UPDATE causes SET status='returned', reason=? WHERE id=?").run(`Talk it through with your ${actor.role === 'guardian' ? 'guardian' : 'teacher or leader'} first`, c.id);
  log(actor.id, 'cause ' + (action === 'cosign' ? 'co-signed' : 'sent back'), c.id);
}

/* ---------- consent requested by the member ---------- */
r.post('/consent/request', need('member'), h(async req => {
  const u = req.user;
  if (age(u) >= 18) fail(400, 'At 18 you give your own consent.');
  const phone = A.normalisePhone(req.body.phone);
  A.limit('consent:' + u.id, 5, 60);
  let g = db.prepare('SELECT * FROM users WHERE username=?').get('g:' + phone);
  if (!g) g = getUser(db.prepare("INSERT INTO users (role,username,display,phone,created_at) VALUES ('guardian',?,?,?,?)").run('g:' + phone, 'Guardian', phone, now()).lastInsertRowid);
  db.prepare("UPDATE users SET guardian_id=?, consent=CASE WHEN consent='yes' THEN 'yes' ELSE 'sent' END WHERE id=?").run(g.id, u.id);
  const base = process.env.PUBLIC_URL || 'http://localhost:3000';
  await sendSms(phone, `Hello Parent or Guardian. ${u.display} wants to join Izwi, a safe platform for children by Mtoto News. Read what it is and say yes or no here: ${base}/#guardian`);
  log(u.id, 'consent requested', u.id);
}));
r.post('/consent/self', need('member'), h(req => {
  if (age(req.user) < 18) fail(403, 'A parent or guardian needs to say yes for you.');
  db.prepare("UPDATE users SET consent='yes', consent_at=?, share_beyond=1 WHERE id=?").run(now(), req.user.id);
}));

/* ---------- onboarding ---------- */
r.post('/onboarding', need('member'), h(req => {
  const u = req.user, b = req.body;
  if (b.readiness && typeof b.readiness === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(b.readiness)) if (+k >= 0 && +k < C.READY.length && [0, 1, 2].includes(v)) clean[k] = v;
    db.prepare('UPDATE users SET readiness=? WHERE id=?').run(JSON.stringify(clean), u.id);
  }
  if (b.read && C.TOPICS.some(t => t[0] === b.read)) {
    const sr = parse(u.safety_read, {}); sr[b.read] = true;
    db.prepare('UPDATE users SET safety_read=? WHERE id=?').run(JSON.stringify(sr), u.id);
  }
  if (Array.isArray(b.skills)) for (const t of b.skills) if (C.T[t]) db.prepare('INSERT OR IGNORE INTO skills (user_id, track) VALUES (?,?)').run(u.id, t);
  if (b.stage) {
    const cur = C.STAGES.indexOf(u.stage), to = C.STAGES.indexOf(b.stage);
    if (to < 0 || to > cur + 1) fail(400, 'Finish this step first.');
    if (cur === 0 && to === 1 && u.consent === 'none') fail(400, 'Ask your guardian first.');
    if (b.stage === 'features' && cur === C.STAGES.indexOf('rules')) db.prepare('UPDATE users SET rules_accepted_at=? WHERE id=?').run(now(), u.id);
    if (b.stage === 'done' && !db.prepare('SELECT 1 FROM skills WHERE user_id=?').get(u.id)) fail(400, 'Choose at least one skill.');
    if (to > cur) db.prepare('UPDATE users SET stage=? WHERE id=?').run(b.stage, u.id);
  }
}));
const onboarded = (req, _res, next) => (req.user.stage === 'done' ? next() : next(new A.HttpError(403, 'Finish joining first.')));
const member = [need('member'), onboarded];

/* ---------- learn ---------- */
r.post('/skills', member, h(req => {
  if (!C.T[req.body.track]) fail(400, 'Unknown skill.');
  db.prepare('INSERT OR IGNORE INTO skills (user_id, track) VALUES (?,?)').run(req.user.id, req.body.track);
}));
r.post('/learn', member, h(req => {
  const u = req.user, s = db.prepare('SELECT * FROM skills WHERE user_id=? AND track=?').get(u.id, req.body.track);
  if (!s) fail(400, 'Add this skill first.');
  const L = C.lessonsOf(s.track, band(u)), l = L[s.progress];
  if (!l) fail(400, 'You have finished this skill.');
  if (l[2] && +req.body.choice !== l[4]) return { ok: true, correct: false };
  db.prepare('UPDATE skills SET progress=progress+1 WHERE user_id=? AND track=?').run(u.id, s.track);
  return { ok: true, correct: true, badge: s.progress + 1 >= C.need(band(u)) };
}));

/* ---------- create and the Toto Verse ---------- */
r.post('/works', member, upload.single('file'), h(req => {
  const u = req.user, b = req.body, clean = () => req.file && fs.unlink(req.file.path, () => {});
  try {
    mustPost(u);
    if (!C.T[b.fmt]) fail(400, 'Choose what you are making.');
    const s = db.prepare('SELECT progress FROM skills WHERE user_id=? AND track=?').get(u.id, b.fmt);
    if (!s || s.progress < C.need(band(u))) fail(403, 'Finish the skill first to unlock this.');
    if (b.ok !== 'true') fail(400, 'Tick the safety box before sending.');
    let aud = parse(b.aud, []).filter(a => C.AUD.some(x => x[0] === a));
    if (!u.share_beyond) aud = aud.filter(a => a !== 'community' && a !== 'verse');
    if (!aud.length) fail(400, 'Choose who to share it with.');
    if (!req.file && !String(b.content || '').trim()) fail(400, 'Add your file, your recording or your words.');
    const cause = b.causeId ? db.prepare("SELECT id FROM causes WHERE id=? AND status='approved'").get(b.causeId) : null;
    const id = addItem(u, { kind: 'work', fmt: b.fmt, cat: C.CATS.includes(b.cat) ? b.cat : C.CATS[0], title: str(b.title, 80, 'The title'), body: str(b.body, 300, 'What it is about'),
      content: str(b.content, 6000, 'Your writing', 0), credit: str(b.credit, 140, 'The credit', 0), audience: JSON.stringify(aud), cause_id: cause ? cause.id : null,
      file_path: req.file ? req.file.filename : null, file_name: req.file ? req.file.originalname.slice(0, 120) : null, mime: req.file ? req.file.mimetype : null });
    return { ok: true, id };
  } catch (e) { clean(); throw e; }
}));
const myItem = (u, id, kind) => { const i = db.prepare('SELECT * FROM items WHERE id=? AND user_id=? AND kind=?').get(id, u.id, kind); if (!i) fail(404, 'Not found.'); return i; };
r.post('/works/:id/delete', member, h(req => {
  const i = myItem(req.user, req.params.id, 'work');
  if (i.file_path) fs.unlink(path.join(UPLOAD_DIR, i.file_path), () => {});
  db.prepare('DELETE FROM items WHERE id=?').run(i.id);
}));
const visibleWork = (u, id) => {
  const w = db.prepare(`SELECT i.*, o.consent, o.disabled, o.share_beyond, o.country AS ucountry, o.role AS urole FROM items i JOIN users o ON o.id=i.user_id WHERE i.id=? AND i.kind='work'`).get(id);
  const orgOf = gid => (db.prepare('SELECT org FROM groups WHERE id=?').get(gid) || {}).org || '';
  if (!w || !canSeeWork(w, u, orgOf)) fail(404, 'Not found.');
  return w;
};
r.post('/works/:id/react', member, h(req => {
  const w = visibleWork(req.user, req.params.id), k = +req.body.kind;
  if (w.status !== 'approved') fail(400, 'Not yet.');
  if ([0, 1, 2].includes(k)) db.prepare('INSERT OR REPLACE INTO reactions (item_id, user_id, kind) VALUES (?,?,?)').run(w.id, req.user.id, k);
  else db.prepare('DELETE FROM reactions WHERE item_id=? AND user_id=?').run(w.id, req.user.id);
}));
r.post('/works/:id/feedback', member, h(req => {
  const u = req.user; mustPost(u);
  if (band(u) !== 'o') fail(403, 'Written feedback opens at 16.');
  const w = visibleWork(u, req.params.id);
  addItem(u, { kind: 'feedback', work_id: w.id, body: str(req.body.body, 200, 'Your feedback') });
}));

/* ---------- group ---------- */
r.post('/gposts', need('member', 'leader'), h(req => {
  const u = req.user, body = str(req.body.body, 280, 'Your message');
  if (u.role === 'leader') {
    const g = db.prepare('SELECT id FROM groups WHERE leader_id=?').get(u.id);
    if (!g) fail(400, 'You have no group yet.');
    db.prepare("INSERT INTO items (kind,user_id,group_id,body,status,created_at) VALUES ('gpost',?,?,?,'approved',?)").run(u.id, g.id, body, now());
    return;
  }
  if (u.stage !== 'done') fail(403, 'Finish joining first.');
  mustPost(u);
  addItem(u, { kind: 'gpost', body, status: u.route === 'own' ? 'review' : 'leader' });
}));

/* ---------- causes ---------- */
r.post('/causes', member, h(req => {
  const u = req.user, b = req.body; mustPost(u);
  const y = band(u) === 'y', text = `${b.name} ${b.goal} ${b.why} ${b.who}`;
  const id = db.prepare('INSERT INTO causes (user_id,name,goal,why,who,status,cosign_by,flag,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(u.id, str(b.name, 50, 'The name'), str(b.goal, 100, 'The issue'), str(b.why, 400, 'Why it matters'), str(b.who, 80, 'Who decides'),
      y ? 'cosign' : 'review', y ? (u.route === 'own' ? 'guardian' : 'leader') : null, flagOf(text), now()).lastInsertRowid;
  db.prepare('INSERT INTO cause_members (cause_id, user_id, member) VALUES (?,?,1)').run(id, u.id);
  return { ok: true, id };
}));
const liveCause = id => { const c = db.prepare("SELECT * FROM causes WHERE id=? AND status='approved'").get(id); if (!c) fail(404, 'Cause not found.'); return c; };
const toggle = col => h(req => {
  const c = liveCause(req.params.id), u = req.user;
  db.prepare('INSERT OR IGNORE INTO cause_members (cause_id, user_id) VALUES (?,?)').run(c.id, u.id);
  db.prepare(`UPDATE cause_members SET ${col}=1-${col} WHERE cause_id=? AND user_id=?`).run(c.id, u.id);
});
r.post('/causes/:id/join', member, toggle('member'));
r.post('/causes/:id/support', member, toggle('supporter'));
const inCause = (u, c) => { if (!(db.prepare('SELECT member FROM cause_members WHERE cause_id=? AND user_id=?').get(c.id, u.id) || {}).member) fail(403, 'Join the cause first.'); };
r.post('/causes/:id/items', member, h(req => {
  const u = req.user, c = liveCause(req.params.id), b = req.body; mustPost(u); inCause(u, c);
  if (!C.KINDS.includes(b.kind)) fail(400, 'Unknown kind.');
  if (b.kind === 'message' && band(u) !== 'o') fail(403, 'Campaign messages open at 16.');
  if (b.kind === 'memo') {
    const facts = str(b.facts, 400, 'The facts'), affect = str(b.affect, 400, 'How it affects children', 0), ask = str(b.ask, 400, 'What you ask for');
    addItem(u, { kind: 'memo', cause_id: c.id, title: str(b.title, 80, 'The heading'), body: `${facts}${affect ? ' ' + affect : ''} We ask: ${ask}`, content: JSON.stringify({ facts, affect, ask }) });
  } else {
    const body = str(b.body, b.kind === 'update' ? 140 : 280, 'Your text');
    addItem(u, { kind: b.kind, cause_id: c.id, title: b.kind === 'post' ? '' : body.slice(0, 60), body });
  }
}));
r.post('/causes/:id/docs', member, upload.single('file'), h(req => {
  const u = req.user;
  try {
    const c = liveCause(req.params.id); mustPost(u); inCause(u, c);
    if (!req.file) fail(400, 'Choose a document first.');
    addItem(u, { kind: 'doc', cause_id: c.id, title: req.file.originalname.slice(0, 80), body: 'Document shared with the cause.', file_path: req.file.filename, file_name: req.file.originalname.slice(0, 120), mime: req.file.mimetype });
  } catch (e) { if (req.file) fs.unlink(req.file.path, () => {}); throw e; }
}));

/* ---------- help ---------- */
r.post('/help', need('member'), h(req => {
  const u = req.user, kind = req.body.kind === 'report' ? 'report' : 'talk';
  A.limit('help:' + u.id, 10, 60);
  if (kind === 'talk' && db.prepare("SELECT 1 FROM help_requests WHERE user_id=? AND kind='talk' AND status='open'").get(u.id)) return;
  db.prepare('INSERT INTO help_requests (user_id, kind, body, created_at) VALUES (?,?,?,?)').run(u.id, kind, kind === 'report' ? str(req.body.body, 600, 'What happened') : '', now());
  log(u.id, 'help ' + kind, u.id);
}));

/* ---------- teacher or group leader ---------- */
const leaderGroup = u => { const g = db.prepare('SELECT * FROM groups WHERE leader_id=?').get(u.id); if (!g) fail(400, 'You have no group yet.'); return g; };
const inMyGroup = (u, id) => { const m = getUser(id), g = leaderGroup(u); if (!m || m.role !== 'member' || m.group_id !== g.id) fail(404, 'Member not found.'); return m; };
r.post('/leader/vouch/:id', need('leader'), h(req => {
  const m = inMyGroup(req.user, req.params.id);
  if (req.body.ok) db.prepare('UPDATE users SET vouched=1 WHERE id=?').run(m.id);
  else db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(m.id);
  log(req.user.id, req.body.ok ? 'member confirmed' : 'member removed from group', m.id);
}));
r.post('/leader/item/:id', need('leader'), h(req => {
  const g = leaderGroup(req.user), i = db.prepare("SELECT * FROM items WHERE id=? AND status='leader' AND group_id=?").get(req.params.id, g.id);
  if (!i) fail(404, 'Not found.');
  if (req.body.action === 'approve') db.prepare("UPDATE items SET status='approved', reviewed_by=?, reviewed_at=? WHERE id=?").run(req.user.id, now(), i.id);
  else if (req.body.action === 'escalate') db.prepare("UPDATE items SET status='review', flag='Sent up by the teacher or leader' WHERE id=?").run(i.id);
  else db.prepare("UPDATE items SET status='returned', reason='Your teacher or leader wants to talk about this first', reviewed_by=?, reviewed_at=? WHERE id=?").run(req.user.id, now(), i.id);
  log(req.user.id, 'group message ' + req.body.action, i.id);
}));
r.post('/leader/cause/:id', need('leader'), h(req => {
  const c = db.prepare("SELECT * FROM causes WHERE id=? AND status='cosign' AND cosign_by='leader'").get(req.params.id);
  if (!c) fail(404, 'Cause not found.');
  inMyGroup(req.user, c.user_id);
  cosign(req.user, c, req.body.action);
}));
r.post('/leader/help/:id', need('leader'), h(req => {
  const hr = db.prepare("SELECT * FROM help_requests WHERE id=? AND kind='talk'").get(req.params.id);
  if (!hr) fail(404, 'Not found.');
  inMyGroup(req.user, hr.user_id);
  db.prepare("UPDATE help_requests SET status=? WHERE id=?").run(req.body.escalate ? 'escalated' : 'closed', hr.id);
  log(req.user.id, req.body.escalate ? 'help request escalated' : 'help request closed', hr.id);
}));

/* ---------- moderator ---------- */
const reason = b => (C.REASONS.includes(b.reason) ? b.reason : C.REASONS[3]);
r.post('/mod/item/:id', need('moderator'), h(req => {
  const i = db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id), a = req.body.action;
  if (!i) fail(404, 'Not found.');
  if (a === 'approve') db.prepare("UPDATE items SET status='approved', flag='', reviewed_by=?, reviewed_at=? WHERE id=?").run(req.user.id, now(), i.id);
  else if (a === 'return') db.prepare("UPDATE items SET status='returned', reason=?, reviewed_by=?, reviewed_at=? WHERE id=?").run(reason(req.body), req.user.id, now(), i.id);
  else if (a === 'escalate') db.prepare("UPDATE items SET status='escalated', reviewed_by=?, reviewed_at=? WHERE id=?").run(req.user.id, now(), i.id);
  else fail(400, 'Unknown action.');
  log(req.user.id, `${i.kind} ${a}`, i.id, a === 'return' ? reason(req.body) : '');
}));
r.post('/mod/cause/:id', need('moderator'), h(req => {
  const c = db.prepare('SELECT * FROM causes WHERE id=?').get(req.params.id), a = req.body.action;
  if (!c) fail(404, 'Not found.');
  if (a === 'approve') db.prepare("UPDATE causes SET status='approved', flag='' WHERE id=?").run(c.id);
  else if (a === 'return') db.prepare("UPDATE causes SET status='returned', reason=? WHERE id=?").run(reason(req.body), c.id);
  else if (a === 'escalate') db.prepare("UPDATE causes SET status='escalated' WHERE id=?").run(c.id);
  else if (a === 'won') db.prepare('UPDATE causes SET won=1-won WHERE id=?').run(c.id);
  else fail(400, 'Unknown action.');
  log(req.user.id, `cause ${a}`, c.id);
}));
r.post('/mod/help/:id', need('moderator'), h(req => {
  db.prepare('UPDATE help_requests SET status=? WHERE id=?').run(req.body.action === 'escalate' ? 'escalated' : 'closed', req.params.id);
  log(req.user.id, `help request ${req.body.action === 'escalate' ? 'escalated' : 'handled'}`, req.params.id);
}));
r.post('/mod/groups', need('moderator'), h(req => {
  const b = req.body, kind = b.kind === 'community' ? 'community' : 'school';
  const email = str(b.leaderEmail, 120, 'The leader email').toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'That email does not look right.');
  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(email)) fail(400, 'That email already has an account.');
  const password = str(b.leaderPassword, 100, 'The password', 10);
  const leaderId = db.prepare("INSERT INTO users (role,username,display,secret_hash,consent,created_at) VALUES ('leader',?,?,?,'yes',?)")
    .run(email, str(b.leaderName, 40, 'The leader name'), A.hashSecret(password), now()).lastInsertRowid;
  let code;
  const letters = () => Array.from({ length: 3 }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ'[crypto.randomInt(23)]).join('');
  do code = `${letters()}-${crypto.randomInt(1000, 10000)}`;
  while (db.prepare('SELECT 1 FROM groups WHERE code=?').get(code));
  const id = db.prepare('INSERT INTO groups (name,kind,org,code,leader_id,created_at) VALUES (?,?,?,?,?,?)').run(str(b.name, 60, 'The group name'), kind, str(b.org, 80, 'The school or organisation', 0), code, leaderId, now()).lastInsertRowid;
  log(req.user.id, 'group created', id, code);
  return { ok: true, code };
}));

/* ---------- files: only people allowed to see the item can open its file ---------- */
r.get('/files/:id', need(), (req, res, next) => {
  try {
    const u = req.user, i = db.prepare(`SELECT i.*, o.consent, o.disabled, o.share_beyond, o.country AS ucountry, o.role AS urole, o.guardian_id FROM items i JOIN users o ON o.id=i.user_id WHERE i.id=?`).get(req.params.id);
    if (!i || !i.file_path) fail(404, 'Not found.');
    const orgOf = gid => (db.prepare('SELECT org FROM groups WHERE id=?').get(gid) || {}).org || '';
    const ok = u.role === 'moderator' || i.user_id === u.id || (u.role === 'guardian' && i.guardian_id === u.id)
      || (u.role === 'member' && i.kind === 'work' && canSeeWork(i, u, orgOf))
      || (u.role === 'member' && i.kind === 'doc' && i.status === 'approved' && (db.prepare('SELECT member FROM cause_members WHERE cause_id=? AND user_id=?').get(i.cause_id, u.id) || {}).member);
    if (!ok) fail(404, 'Not found.');
    res.setHeader('Content-Type', i.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(i.file_name || 'file')}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(path.join(UPLOAD_DIR, i.file_path));
  } catch (e) { next(e); }
});

module.exports = r;
