# Putting Izwi on a server

Izwi is one Node.js program with one data folder. It needs no separate database server.

## What you need
- A server with Node.js 20 or newer. A small virtual machine is enough for a pilot of a few hundred members.
- A domain name, for example izwi.africa, and HTTPS. Caddy or Nginx with Let's Encrypt in front of Node works well.
- A disk for the `data` folder. Uploaded audio and video fill it quickly, so watch the space.

## Steps
1. Copy the project to the server. Do not copy `node_modules` or `data`.
2. Run `npm install --omit=dev`.
3. Set the environment variables from `.env.example`. At the least: `NODE_ENV=production`, `PUBLIC_URL=https://your-domain`, `DATA_DIR=/var/lib/izwi`, and the SMS settings.
4. Create the first moderator: `npm run create-moderator -- email "Name" "password"`.
5. Start it with a process manager so it restarts by itself, for example `pm2 start server/index.js --name izwi` or a systemd service.
6. Point the web server at `http://localhost:3000` and turn on HTTPS.
7. Open the site, sign in as the moderator and create the first group.

## Looking after it
- Back up `DATA_DIR` daily. It holds `izwi.db` and the `uploads` folder.
- To update: copy the new code, run `npm install --omit=dev`, run `npm test` on a copy first, then restart.
- The database tables are created at first start. When a table changes in a later version, write the change as an `ALTER TABLE` in `server/db.js` so existing data is kept.

## Limits to know about
- Sign-in rate limits are kept in memory, so they reset on restart and do not work across several servers. One server is assumed.
- SQLite handles a pilot comfortably. Move to PostgreSQL before running more than one server.
- Files are stored on the server's disk. Move them to object storage when the disk becomes the limit.
