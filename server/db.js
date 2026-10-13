// Database: one SQLite file. Tables are created on first start.
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(process.env.DB_FILE || path.join(DATA_DIR, 'izwi.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('school','community','open')),
  org TEXT NOT NULL DEFAULT '',           -- school or organisation name. Groups with the same org share the "School" audience
  code TEXT UNIQUE,                       -- join code handed out by the teacher or leader
  leader_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('member','leader','guardian','moderator')),
  username TEXT NOT NULL UNIQUE,          -- member: nickname in lower case. leader and moderator: email. guardian: "g:" + phone
  display TEXT NOT NULL,
  secret_hash TEXT,
  birth_year INTEGER,
  country TEXT,
  route TEXT CHECK (route IN ('school','community','own')),
  group_id INTEGER REFERENCES groups(id),
  vouched INTEGER NOT NULL DEFAULT 0,     -- 1 when the teacher or leader confirmed the member is in their group
  avatar TEXT, color TEXT,
  consent TEXT NOT NULL DEFAULT 'none' CHECK (consent IN ('none','sent','yes','withdrawn')),
  consent_at TEXT,
  guardian_id INTEGER REFERENCES users(id),
  share_beyond INTEGER NOT NULL DEFAULT 0,
  sms_summary INTEGER NOT NULL DEFAULT 1,
  readiness TEXT NOT NULL DEFAULT '{}',
  safety_read TEXT NOT NULL DEFAULT '{}',
  stage TEXT NOT NULL DEFAULT 'consent',
  rules_accepted_at TEXT,
  phone TEXT,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS otps (
  phone TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS skills (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track TEXT NOT NULL, progress INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, track)
);
CREATE TABLE IF NOT EXISTS causes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, goal TEXT NOT NULL, why TEXT NOT NULL, who TEXT NOT NULL,
  status TEXT NOT NULL,                   -- cosign, review, approved, returned, escalated
  cosign_by TEXT,                         -- leader or guardian, for members aged 13 to 15
  won INTEGER NOT NULL DEFAULT 0,
  flag TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cause_members (
  cause_id INTEGER NOT NULL REFERENCES causes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member INTEGER NOT NULL DEFAULT 0, supporter INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (cause_id, user_id)
);
-- Everything a member makes is an item: a work, a group post, a cause post, an update, a memorandum, a campaign message, a document, feedback.
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,                     -- work, gpost, post, update, memo, message, doc, feedback
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(id),
  cause_id INTEGER REFERENCES causes(id) ON DELETE CASCADE,
  work_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  fmt TEXT, cat TEXT,
  title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', credit TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '[]',
  file_path TEXT, file_name TEXT, mime TEXT,
  status TEXT NOT NULL,                   -- leader, review, approved, returned, escalated
  flag TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '',
  reviewed_by INTEGER, reviewed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_status ON items(status, kind);
CREATE TABLE IF NOT EXISTS reactions (
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind INTEGER NOT NULL,
  PRIMARY KEY (item_id, user_id)
);
CREATE TABLE IF NOT EXISTS help_requests (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('talk','report')),
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',    -- open, closed, escalated
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '', at TEXT NOT NULL
);
`);

const now = () => new Date().toISOString();

// Members who join on their own are placed in one open group that Izwi moderators look after.
if (!db.prepare("SELECT id FROM groups WHERE kind='open'").get()) {
  db.prepare("INSERT INTO groups (name, kind, created_at) VALUES ('Izwi open group','open',?)").run(now());
}

const log = (actorId, action, target = '', detail = '') =>
  db.prepare('INSERT INTO audit_log (actor_id, action, target, detail, at) VALUES (?,?,?,?,?)').run(actorId, action, String(target), String(detail), now());

module.exports = { db, now, log, DATA_DIR, UPLOAD_DIR };
