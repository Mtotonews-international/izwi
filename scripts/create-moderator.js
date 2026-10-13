// Creates a moderator account.  npm run create-moderator -- email@example.org "Display Name" "a long password"
const { db, now, log } = require('../server/db');
const { hashSecret } = require('../server/auth');
const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password || password.length < 10) {
  console.error('Usage: npm run create-moderator -- email "Display Name" "password of 10 or more characters"');
  process.exit(1);
}
const username = email.toLowerCase();
if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) { console.error('That email already has an account.'); process.exit(1); }
const id = db.prepare("INSERT INTO users (role,username,display,secret_hash,consent,created_at) VALUES ('moderator',?,?,?,'yes',?)").run(username, name, hashSecret(password), now()).lastInsertRowid;
log(id, 'moderator created', id);
console.log(`Moderator created: ${username}`);
