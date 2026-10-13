// Fills an EMPTY database with sample people and content so you can look around.  npm run seed
// For development only. Never run this on the live site.
const { db, now } = require('../server/db');
const { hashSecret } = require('../server/auth');
const C = require('../public/content.js');
if (process.env.NODE_ENV === 'production') { console.error('Refusing to seed in production.'); process.exit(1); }
if (db.prepare("SELECT COUNT(*) n FROM users").get().n) { console.error('The database already has people in it. Delete the data folder first to start again.'); process.exit(1); }

const user = (role, username, display, secret, extra = {}) => {
  const cols = { role, username, display, secret_hash: hashSecret(secret), consent: 'yes', created_at: now(), ...extra }, k = Object.keys(cols);
  return db.prepare(`INSERT INTO users (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...Object.values(cols)).lastInsertRowid;
};
const mod = user('moderator', 'mod@izwi.test', 'Izwi Moderator', 'moderator-pass');
const teacher = user('leader', 'teacher@izwi.test', 'Teacher', 'teacher-pass');
const gid = db.prepare("INSERT INTO groups (name,kind,org,code,leader_id,created_at) VALUES ('Grade 8 Blue','school','Demo School','DEMO-2026',?,?)").run(teacher, now()).lastInsertRowid;
const kid = (name, year, i, country = 'Kenya') => user('member', name.toLowerCase(), name, 'secret-word', { birth_year: year, country, route: 'school', group_id: gid, vouched: 1, share_beyond: 1, stage: 'done', avatar: C.AVATARS[i], color: C.COLORS[i % C.COLORS.length] });
const y = new Date().getFullYear();
const niko = kid('Niko Hapa', y - 16, 0), ule = kid('Ule Msee', y - 14, 1), amai = kid('Amai A', y - 15, 2), zuri = kid('Zuri T', y - 17, 3), omar = kid('Omar H', y - 16, 4);
for (const [u, t] of [[niko, 'mic'], [ule, 'video'], [amai, 'ai'], [zuri, 'animation'], [omar, 'writing']]) db.prepare('INSERT INTO skills (user_id, track, progress) VALUES (?,?,4)').run(u, t);

const cause = (uid, name, goal, who, why, won = 0) => {
  const id = db.prepare("INSERT INTO causes (user_id,name,goal,why,who,status,won,created_at) VALUES (?,?,?,?,?,'approved',?,?)").run(uid, name, goal, why, who, won, now()).lastInsertRowid;
  db.prepare('INSERT INTO cause_members (cause_id,user_id,member,supporter) VALUES (?,?,1,1)').run(id, uid);
  return id;
};
const c1 = cause(niko, 'The Elephant Movement', 'To stop the sale of elephant tusks', 'The county wildlife office', 'Elephant numbers near our community are falling. Tusks are sold in markets that adults pretend not to see.');
const c2 = cause(omar, 'Cool Schools', 'Shade trees in every school compound', 'The County Director of Education', 'Our classrooms are too hot to learn in by midday. Trees cool the compound and give us somewhere to read.');
const c3 = cause(zuri, 'Safe Road to School', 'A marked crossing outside every primary school', 'The county roads office', 'Many of us cross a main road twice a day with no crossing and no warden.', 1);

const item = (o) => db.prepare(`INSERT INTO items (kind,user_id,group_id,cause_id,fmt,cat,title,body,content,credit,audience,status,created_at) VALUES (@kind,@user_id,${gid},@cause_id,@fmt,@cat,@title,@body,@content,@credit,@audience,'approved','${now()}')`)
  .run({ cause_id: null, fmt: null, cat: null, title: '', body: '', content: '', credit: '', audience: '[]', ...o });
const work = (uid, fmt, cat, title, body, extra = {}) => item({ kind: 'work', user_id: uid, fmt, cat, title, body, audience: '["class","verse"]', ...extra });
work(niko, 'mic', 'Informative', 'Why our river turned brown', 'A four-minute episode asking three neighbours what changed upstream.', { credit: 'Built on an interview idea from Ule Msee. Thank you.' });
work(ule, 'video', 'Entertainment', 'Three shots of my grandmother’s shamba', 'Wide, medium and close. Filmed before school.');
work(amai, 'ai', 'Education', 'I asked an AI about Great Zimbabwe and it got two things wrong', 'What the tool said, what my history teacher said, and how I checked.');
work(zuri, 'animation', 'Informative', 'The walk to school', 'A 20-second animation for the Safe Road to School cause.', { cause_id: c3 });
work(omar, 'writing', 'Education', 'Why our classroom needs a tree', 'An article for the Cool Schools cause.', { cause_id: c2, content: 'By eleven the iron roof is too hot to sit under. We measured it for a week. On four days out of five the classroom was hotter than the field outside.\n\nA tree planted today gives shade in two years. We are asking for twenty.' });
item({ kind: 'post', user_id: ule, cause_id: c1, body: 'I think we can work with the wildlife rangers.' });
item({ kind: 'post', user_id: amai, cause_id: c2, body: 'Our agriculture teacher says moringa grows fast and gives shade in two years.' });
item({ kind: 'update', user_id: omar, cause_id: c2, title: 'Memorandum sent', body: 'Memorandum sent to the decision-maker.' });
item({ kind: 'update', user_id: zuri, cause_id: c3, title: 'Crossing painted', body: 'Crossing painted outside two schools.' });
item({ kind: 'gpost', user_id: teacher, body: 'Did everyone finish the sound lesson?' });
item({ kind: 'gpost', user_id: amai, body: 'Yes. I recorded inside the wardrobe.' });
console.log(`Sample data added.
  Moderator:  mod@izwi.test / moderator-pass
  Teacher:    teacher@izwi.test / teacher-pass   (group code DEMO-2026)
  Members:    niko hapa, ule msee, amai a, zuri t, omar h   (secret word: secret-word)`);
