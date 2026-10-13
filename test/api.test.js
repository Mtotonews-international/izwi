// End-to-end checks of the rules that keep children safe.  npm test
process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.DATA_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'izwi-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/index');
const { db, now } = require('../server/db');
const { hashSecret } = require('../server/auth');

let base, server;
const Y = new Date().getFullYear();
function client() {
  let cookie = '';
  const call = async (method, url, body, form) => {
    const r = await fetch(base + url, { method, headers: { 'x-izwi': '1', cookie, ...(form || !body ? {} : { 'content-type': 'application/json' }) }, body: form || (body ? JSON.stringify(body) : undefined) });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const ct = r.headers.get('content-type') || '';
    return { status: r.status, body: ct.includes('json') ? await r.json() : await r.text() };
  };
  return { get: u => call('GET', u), post: (u, b) => call('POST', u, b || {}), form: (u, f) => call('POST', u, null, f), state: async () => (await call('GET', '/api/state')).body };
}
const staff = (role, email) => db.prepare("INSERT INTO users (role,username,display,secret_hash,consent,created_at) VALUES (?,?,?,?,'yes',?)").run(role, email, role, hashSecret('long-password'), now()).lastInsertRowid;
const mod = client(), teacher = client(), guardian = client();
let code;

test.before(async () => {
  server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}`;
  staff('moderator', 'mod@test');
  assert.equal((await mod.post('/api/login', { username: 'mod@test', secret: 'long-password' })).status, 200);
  const g = await mod.post('/api/mod/groups', { name: 'Grade 8', kind: 'school', org: 'Test School', leaderName: 'Teacher', leaderEmail: 't@test.org', leaderPassword: 'long-password' });
  code = g.body.code; assert.match(code, /^[A-Z]{3}-\d{4}$/);
  await teacher.post('/api/login', { username: 't@test.org', secret: 'long-password' });
});
test.after(() => server.close());

const join = async (c, nickname, age, route = 'school') => c.post('/api/signup', { nickname, secret: 'secret-word', birthYear: Y - age, country: 'Kenya', route, code, avatar: '', color: '' });
const onboard = async (c, skills = ['mic']) => { for (const stage of ['ready', 'safety', 'rules', 'features', 'work', 'skills']) assert.equal((await c.post('/api/onboarding', { stage })).status, 200, stage); assert.equal((await c.post('/api/onboarding', { skills, stage: 'done' })).status, 200); };
const finish = async (c, track = 'mic') => { for (let i = 0; i < 6; i++) { const s = await c.state(), sk = s.skills.find(x => x.track === track); const C = require('../public/content.js'); const l = C.lessonsOf(track, s.me.band)[sk.progress]; if (!l) break; await c.post('/api/learn', { track, choice: l[4] }); } };
const workForm = (o = {}) => { const f = new FormData(); for (const [k, v] of Object.entries({ fmt: 'mic', title: 'My show', body: 'About rivers', cat: 'Education', aud: '["class","verse"]', content: 'My script', ok: 'true', ...o })) f.set(k, v); return f; };

test('requests without the Izwi header are blocked', async () => {
  const r = await fetch(base + '/api/logout', { method: 'POST' });
  assert.equal(r.status, 403);
});
test('age limits and bad group codes are refused', async () => {
  const c = client();
  assert.equal((await join(c, 'TooYoung', 12)).status, 400);
  assert.equal((await join(c, 'TooOld', 19)).status, 400);
  const r = await c.post('/api/signup', { nickname: 'NoCode', secret: 'secret-word', birthYear: Y - 14, country: 'Kenya', route: 'school', code: 'XXX-0000' });
  assert.equal(r.status, 400);
});

const zawadi = client();
test('a 14 year old cannot move on or post without guardian consent', async () => {
  assert.equal((await join(zawadi, 'Zawadi', 14)).status, 200);
  assert.equal((await zawadi.post('/api/onboarding', { stage: 'ready' })).status, 400);
  assert.equal((await zawadi.post('/api/consent/self')).status, 403);
  assert.equal((await zawadi.post('/api/consent/request', { phone: '0712345678' })).status, 200);
  await onboard(zawadi); await finish(zawadi);
  const s = await zawadi.state();
  assert.equal(s.me.consent, 'sent'); assert.equal(s.me.canPost, false);
  assert.equal(s.skills[0].progress, 3);
  assert.equal((await zawadi.form('/api/works', workForm())).status, 403);
});
test('a wrong quiz answer does not advance a lesson', async () => {
  const c = client(); await join(c, 'Quizzer', 17); await c.post('/api/consent/request', { phone: '0712345678' }); await onboard(c, ['ai']);
  const r = await c.post('/api/learn', { track: 'ai', choice: 0 });
  assert.equal(r.body.correct, false);
  assert.equal((await c.state()).skills[0].progress, 0);
});
test('the guardian signs in with a code and gives consent, the teacher confirms the member', async () => {
  const start = await guardian.post('/api/guardian/start', { phone: '0712 345 678' });
  assert.ok(start.body.devCode);
  assert.equal((await guardian.post('/api/guardian/verify', { phone: '0712345678', code: '000000' })).status, 401);
  assert.equal((await guardian.post('/api/guardian/verify', { phone: '0712345678', code: start.body.devCode })).status, 200);
  const g = await guardian.state(), kid = g.children.find(k => k.nickname === 'Zawadi');
  assert.equal(kid.consent, 'sent');
  await guardian.post(`/api/guardian/child/${kid.id}`, { consent: 'yes' });
  assert.equal((await zawadi.state()).me.canPost, false, 'still needs the teacher');
  const t = await teacher.state(), m = t.members.find(x => x.nickname === 'Zawadi');
  await teacher.post(`/api/leader/vouch/${m.id}`, { ok: true });
  assert.equal((await zawadi.state()).me.canPost, true);
});
test('a work waits for a moderator, and sharing beyond the school needs the guardian', async () => {
  assert.equal((await zawadi.form('/api/works', workForm({ fmt: 'video' }))).status, 403, 'skill not finished');
  const r = await zawadi.form('/api/works', workForm({ title: 'Call 0712 345 678' }));
  assert.equal(r.status, 200);
  let s = await zawadi.state(); const w = s.works.find(x => x.mine);
  assert.equal(w.status, 'review'); assert.deepEqual(w.aud, ['class'], 'verse removed because the guardian has not allowed it');
  const other = client(); await join(other, 'Outsider', 17, 'own'); await other.post('/api/consent/request', { phone: '0799999999' }); await onboard(other);
  assert.equal((await other.state()).works.length, 0);
  const q = (await mod.state()).queue.find(x => x.id === w.id);
  assert.equal(q.flag, 'Possible phone number'); assert.equal(q.band, 'y');
  await mod.post(`/api/mod/item/${w.id}`, { action: 'approve' });
  assert.equal((await other.state()).works.length, 0, 'class-only work stays in the class');
  const mate = client(); await join(mate, 'Classmate', 15); await mate.post('/api/consent/request', { phone: '0712345678' }); await onboard(mate);
  assert.equal((await mate.state()).works.length, 0, 'not confirmed by the teacher yet');
  const m = (await teacher.state()).members.find(x => x.nickname === 'Classmate'); await teacher.post(`/api/leader/vouch/${m.id}`, { ok: true });
  assert.equal((await mate.state()).works.length, 1);
});
test('withdrawing consent hides the work and stops posting', async () => {
  const g = await guardian.state(), kid = g.children.find(k => k.nickname === 'Zawadi');
  await guardian.post(`/api/guardian/child/${kid.id}`, { consent: 'withdrawn' });
  const mate = client(); await mate.post('/api/login', { username: 'classmate', secret: 'secret-word' });
  assert.equal((await mate.state()).works.length, 0);
  assert.equal((await zawadi.post('/api/gposts', { body: 'hello' })).status, 403);
  await guardian.post(`/api/guardian/child/${kid.id}`, { consent: 'yes' });
});
test('group messages go to the teacher first', async () => {
  await zawadi.post('/api/gposts', { body: 'Can we record at break?' });
  const t = await teacher.state(); assert.equal(t.pending.length, 1);
  assert.equal((await mod.state()).queue.filter(x => x.kind === 'gpost').length, 0);
  await teacher.post(`/api/leader/item/${t.pending[0].id}`, { action: 'approve' });
  assert.equal((await zawadi.state()).gposts.at(-1).status, 'approved');
});
test('a cause from a 14 year old needs a co-sign, then a moderator', async () => {
  const r = await zawadi.post('/api/causes', { name: 'Books', goal: 'A library', why: 'We have none', who: 'The head teacher' });
  assert.equal(r.status, 200);
  assert.equal((await mod.state()).queue.filter(x => x.kind === 'cause').length, 0);
  const t = await teacher.state(); await teacher.post(`/api/leader/cause/${t.causes[0].id}`, { action: 'cosign' });
  const q = (await mod.state()).queue.find(x => x.kind === 'cause');
  await mod.post(`/api/mod/cause/${q.id}`, { action: 'approve' });
  const c = (await zawadi.state()).causes[0]; assert.equal(c.status, 'approved'); assert.equal(c.joined, true);
  assert.equal((await zawadi.post(`/api/causes/${c.id}/items`, { kind: 'message', body: 'Hello world' })).status, 403, 'campaign messages open at 16');
  assert.equal((await zawadi.post(`/api/causes/${c.id}/items`, { kind: 'memo', title: 'Books', facts: 'No library', ask: 'One shelf' })).status, 200);
});
test('roles cannot use each other’s pages, and files are private', async () => {
  assert.equal((await zawadi.post('/api/mod/item/1', { action: 'approve' })).status, 403);
  assert.equal((await teacher.post('/api/mod/groups', {})).status, 403);
  const f = workForm({ title: 'With a file' }); f.set('file', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
  const r = await zawadi.form('/api/works', f); assert.equal(r.status, 200);
  assert.equal((await zawadi.get(`/api/files/${r.body.id}`)).body, 'hello');
  const stranger = client(); assert.equal((await stranger.get(`/api/files/${r.body.id}`)).status, 401);
  const mate = client(); await mate.post('/api/login', { username: 'classmate', secret: 'secret-word' });
  assert.equal((await mate.get(`/api/files/${r.body.id}`)).status, 404, 'not approved yet');
  const bad = workForm(); bad.set('file', new Blob(['<script>'], { type: 'text/html' }), 'x.html');
  assert.equal((await zawadi.form('/api/works', bad)).status, 400);
});
test('help: a request to talk reaches the teacher without the reason, a report reaches the moderator', async () => {
  await zawadi.post('/api/help', { kind: 'talk' });
  await zawadi.post('/api/help', { kind: 'report', body: 'Someone was unkind to me' });
  const t = await teacher.state(); assert.equal(t.help.length, 1); assert.deepEqual(Object.keys(t.help[0]).sort(), ['by', 'id']);
  assert.ok((await mod.state()).queue.some(x => x.kind === 'report'));
});
test('an 18 year old gives their own consent', async () => {
  const c = client(); await join(c, 'Eighteen', 18, 'own');
  assert.equal((await c.post('/api/consent/self')).status, 200);
  assert.equal((await c.state()).me.canPost, true);
});
