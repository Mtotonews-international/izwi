// Builds what each signed-in person is allowed to see. The browser asks for this after every action.
// All visibility rules live here, on the server. The browser only draws what it is given.
const C = require('../public/content.js');
const { db } = require('./db');
const { age, band, canPost, PROD } = require('./auth');

const J = 'SELECT i.*, u.display, u.avatar, u.color, u.country AS ucountry, u.consent, u.disabled, u.share_beyond, u.birth_year, u.route, u.role AS urole FROM items i JOIN users u ON u.id=i.user_id';
const ownerOk = r => r.urole !== 'member' || (r.consent === 'yes' && !r.disabled);
const adultWord = kind => ({ school: 'teacher', community: 'group leader' }[kind] || '');
const groupOf = id => db.prepare('SELECT * FROM groups WHERE id=?').get(id);
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

function me(u) {
  const base = { id: u.id, role: u.role, nickname: u.display, avatar: u.avatar, color: u.color };
  if (u.role !== 'member') return base;
  return { ...base, birthYear: u.birth_year, age: age(u), band: band(u), country: u.country, route: u.route, consent: u.consent, canPost: canPost(u),
    vouched: !!u.vouched, shareBeyond: !!u.share_beyond, stage: u.stage, readiness: parse(u.readiness, {}), safetyRead: parse(u.safety_read, {}) };
}

// Can this member see this approved work?
function canSeeWork(r, v, orgOf) {
  if (r.user_id === v.id) return true;
  if (r.status !== 'approved' || !ownerOk(r)) return false;
  const aud = parse(r.audience, []);
  if (aud.includes('verse') && r.share_beyond) return true;
  if (aud.includes('community') && r.share_beyond && r.ucountry === v.country) return true;
  // Group content opens only after the teacher or leader has confirmed the member.
  const inGroup = v.route === 'own' || !!v.vouched;
  if (inGroup && aud.includes('class') && r.group_id === v.group_id) return true;
  if (inGroup && aud.includes('school') && orgOf(r.group_id) && orgOf(r.group_id) === orgOf(v.group_id)) return true;
  return false;
}
const workOut = (r, viewerId) => ({ id: r.id, fmt: r.fmt, cat: r.cat, title: r.title, body: r.body, content: r.content, credit: r.credit, by: r.display, avatar: r.avatar, color: r.color,
  country: r.ucountry, causeId: r.cause_id, aud: parse(r.audience, []), status: r.status, reason: r.reason, mine: r.user_id === viewerId, hasFile: !!r.file_path, mime: r.mime, fileName: r.file_name });

function memberState(u) {
  const g = groupOf(u.group_id), orgs = {};
  const orgOf = id => (id in orgs ? orgs[id] : (orgs[id] = (groupOf(id) || {}).org || ''));
  const counts = {}, mineR = {};
  for (const r of db.prepare('SELECT item_id, kind, COUNT(*) n FROM reactions GROUP BY item_id, kind').all()) (counts[r.item_id] ||= [0, 0, 0])[r.kind] = r.n;
  for (const r of db.prepare('SELECT item_id, kind FROM reactions WHERE user_id=?').all(u.id)) mineR[r.item_id] = r.kind;
  const fb = {};
  for (const r of db.prepare(`${J} WHERE i.kind='feedback' ORDER BY i.id`).all())
    if (r.user_id === u.id || (r.status === 'approved' && ownerOk(r))) (fb[r.work_id] ||= []).push({ by: r.display, body: r.body, status: r.status, mine: r.user_id === u.id });
  const works = db.prepare(`${J} WHERE i.kind='work' ORDER BY i.id DESC`).all().filter(r => canSeeWork(r, u, orgOf))
    .map(r => ({ ...workOut(r, u.id), r: counts[r.id] || [0, 0, 0], myReact: mineR[r.id] ?? null, feedback: fb[r.id] || [] }));
  const gposts = db.prepare(`${J} WHERE i.kind='gpost' AND i.group_id=? ORDER BY i.id DESC LIMIT 60`).all(u.group_id).reverse()
    .filter(r => r.user_id === u.id || ((u.route === 'own' || u.vouched) && r.status === 'approved' && ownerOk(r)))
    .map(r => ({ id: r.id, by: r.display, avatar: r.avatar, color: r.color, body: r.body, status: r.status, reason: r.reason, mine: r.user_id === u.id, staff: r.urole !== 'member' }));
  return { role: 'member', me: me(u), group: { name: g.name, kind: g.kind, adult: adultWord(g.kind) },
    skills: db.prepare('SELECT track, progress FROM skills WHERE user_id=?').all(u.id), works, gposts, causes: causesFor(u) };
}

function causesFor(u) {
  const rows = db.prepare('SELECT c.*, u.display, u.consent, u.disabled FROM causes c JOIN users u ON u.id=c.user_id ORDER BY c.id').all()
    .filter(c => c.user_id === u.id || (c.status === 'approved' && c.consent === 'yes' && !c.disabled));
  const cm = {};
  for (const r of db.prepare('SELECT cause_id, SUM(member) m, SUM(supporter) s FROM cause_members GROUP BY cause_id').all()) cm[r.cause_id] = r;
  const mineM = {};
  for (const r of db.prepare('SELECT * FROM cause_members WHERE user_id=?').all(u.id)) mineM[r.cause_id] = r;
  const items = db.prepare(`${J} WHERE i.cause_id IS NOT NULL AND i.kind IN ('post','update','memo','message','doc') ORDER BY i.id`).all()
    .filter(r => r.user_id === u.id || (r.status === 'approved' && ownerOk(r)));
  return rows.map(c => {
    const its = items.filter(i => i.cause_id === c.id).map(i => ({ id: i.id, kind: i.kind, title: i.title, body: i.body, by: i.display, avatar: i.avatar, color: i.color, status: i.status, reason: i.reason, mine: i.user_id === u.id, hasFile: !!i.file_path, fileName: i.file_name }));
    return { id: c.id, name: c.name, goal: c.goal, why: c.why, who: c.who, by: c.display, status: c.status, cosignBy: c.cosign_by, won: !!c.won, reason: c.reason, mine: c.user_id === u.id,
      mem: (cm[c.id] || {}).m || 0, sup: (cm[c.id] || {}).s || 0, joined: !!(mineM[c.id] || {}).member, supported: !!(mineM[c.id] || {}).supporter,
      posts: its.filter(i => i.kind === 'post'), updates: its.filter(i => i.kind === 'update'), sent: its.filter(i => ['memo', 'message', 'doc'].includes(i.kind)) };
  });
}

const progressOf = m => db.prepare('SELECT track, progress FROM skills WHERE user_id=?').all(m.id).map(s => ({ track: s.track, progress: Math.min(s.progress, C.need(band(m))), need: C.need(band(m)) }));

function leaderState(u) {
  const g = db.prepare('SELECT * FROM groups WHERE leader_id=?').get(u.id);
  if (!g) return { role: 'leader', me: me(u), group: null, members: [], gposts: [], pending: [], causes: [], help: [] };
  const members = db.prepare("SELECT * FROM users WHERE role='member' AND group_id=? AND disabled=0 ORDER BY display").all(g.id);
  const ids = new Set(members.map(m => m.id));
  return { role: 'leader', me: me(u), group: { id: g.id, name: g.name, kind: g.kind, code: g.code, org: g.org, adult: adultWord(g.kind) },
    members: members.map(m => ({ id: m.id, nickname: m.display, avatar: m.avatar, color: m.color, band: band(m), vouched: !!m.vouched, consent: m.consent, skills: progressOf(m) })),
    gposts: db.prepare(`${J} WHERE i.kind='gpost' AND i.group_id=? AND i.status='approved' ORDER BY i.id DESC LIMIT 30`).all(g.id).reverse().map(r => ({ id: r.id, by: r.display, avatar: r.avatar, color: r.color, body: r.body, staff: r.urole !== 'member' })),
    pending: db.prepare(`${J} WHERE i.status='leader' AND i.group_id=? ORDER BY i.id`).all(g.id).map(r => ({ id: r.id, by: r.display, avatar: r.avatar, color: r.color, body: r.body, flag: r.flag })),
    causes: db.prepare("SELECT c.*, u.display, u.birth_year FROM causes c JOIN users u ON u.id=c.user_id WHERE c.status='cosign' AND c.cosign_by='leader'").all().filter(c => ids.has(c.user_id))
      .map(c => ({ id: c.id, name: c.name, goal: c.goal, why: c.why, who: c.who, by: c.display })),
    help: db.prepare("SELECT h.id, h.created_at, u.display, u.id AS uid FROM help_requests h JOIN users u ON u.id=h.user_id WHERE h.kind='talk' AND h.status='open'").all().filter(h => ids.has(h.uid)).map(h => ({ id: h.id, by: h.display })) };
}

function guardianState(u) {
  const kids = db.prepare("SELECT * FROM users WHERE role='member' AND guardian_id=? AND disabled=0").all(u.id);
  return { role: 'guardian', me: me(u), children: kids.map(k => {
    const g = groupOf(k.group_id);
    return { id: k.id, nickname: k.display, avatar: k.avatar, color: k.color, age: age(k), band: band(k), consent: k.consent, shareBeyond: !!k.share_beyond, smsSummary: !!k.sms_summary,
      group: { name: g.name, kind: g.kind, adult: adultWord(g.kind) },
      works: db.prepare("SELECT id, title, fmt, status, file_path FROM items WHERE kind='work' AND user_id=? ORDER BY id DESC").all(k.id).map(w => ({ id: w.id, title: w.title, fmt: w.fmt, status: w.status, hasFile: !!w.file_path })),
      causes: db.prepare("SELECT c.name FROM cause_members m JOIN causes c ON c.id=m.cause_id WHERE m.user_id=? AND m.member=1").all(k.id).map(c => c.name),
      skills: db.prepare('SELECT track FROM skills WHERE user_id=?').all(k.id).map(s => s.track),
      cosign: db.prepare("SELECT id, name, goal, why, who FROM causes WHERE user_id=? AND status='cosign' AND cosign_by='guardian'").all(k.id),
      help: db.prepare("SELECT id FROM help_requests WHERE user_id=? AND kind='talk' AND status='open'").all(k.id).length > 0 && k.route === 'own' };
  }) };
}

function modState(u) {
  const q = [];
  for (const r of db.prepare(`${J} WHERE i.status='review' ORDER BY i.id`).all()) {
    const c = r.cause_id && db.prepare('SELECT name FROM causes WHERE id=?').get(r.cause_id);
    q.push({ t: 'item', id: r.id, kind: r.kind, fmt: r.fmt, title: r.title, body: r.body, content: r.content, credit: r.credit, by: r.display, avatar: r.avatar, color: r.color,
      band: r.urole === 'member' ? band(r) : '', route: r.route || '', flag: r.flag, causeName: c ? c.name : '', hasFile: !!r.file_path, mime: r.mime, fileName: r.file_name, aud: parse(r.audience, []) });
  }
  for (const c of db.prepare("SELECT c.*, u.display, u.avatar, u.color, u.birth_year, u.route FROM causes c JOIN users u ON u.id=c.user_id WHERE c.status='review' ORDER BY c.id").all())
    q.push({ t: 'cause', id: c.id, kind: 'cause', title: c.name, body: `${c.goal}. ${c.why} Who decides: ${c.who}`, by: c.display, avatar: c.avatar, color: c.color, band: band(c), route: c.route, flag: c.flag });
  for (const h of db.prepare("SELECT h.*, u.display, u.avatar, u.color, u.birth_year, u.route FROM help_requests h JOIN users u ON u.id=h.user_id WHERE h.status='open' AND (h.kind='report' OR u.route='own') ORDER BY h.id").all())
    q.push({ t: 'help', id: h.id, kind: h.kind === 'report' ? 'report' : 'talk', title: '', body: h.kind === 'report' ? h.body : 'This member asked to talk to someone. They joined on their own, so there is no teacher or leader.', by: h.display, avatar: h.avatar, color: h.color, band: band(h), route: h.route, flag: h.kind === 'report' ? 'Member report' : 'Asked to talk' });
  const n = s => db.prepare('SELECT COUNT(*) n FROM items WHERE status=?').get(s).n + db.prepare('SELECT COUNT(*) n FROM causes WHERE status=?').get(s).n;
  return { role: 'moderator', me: me(u), queue: q,
    stats: { review: q.length, approved: n('approved'), returned: n('returned'), escalated: n('escalated') + db.prepare("SELECT COUNT(*) n FROM help_requests WHERE status='escalated'").get().n, members: db.prepare("SELECT COUNT(*) n FROM users WHERE role='member' AND disabled=0").get().n },
    groups: db.prepare("SELECT g.*, u.username AS leader, (SELECT COUNT(*) FROM users m WHERE m.group_id=g.id AND m.role='member') AS members FROM groups g LEFT JOIN users u ON u.id=g.leader_id ORDER BY g.id").all()
      .map(g => ({ id: g.id, name: g.name, kind: g.kind, org: g.org, code: g.code, leader: g.leader, members: g.members })),
    causes: db.prepare("SELECT id, name, won FROM causes WHERE status='approved' ORDER BY id").all().map(c => ({ id: c.id, name: c.name, won: !!c.won })),
    log: db.prepare('SELECT a.action, a.target, a.detail, a.at, u.display FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 40').all() };
}

function stateFor(u) {
  const s = !u ? { role: null } : ({ member: memberState, leader: leaderState, guardian: guardianState, moderator: modState })[u.role](u);
  s.dev = !PROD;
  return s;
}
module.exports = { stateFor, canSeeWork, ownerOk, J, parse };
