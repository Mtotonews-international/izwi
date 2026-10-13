// Starts the Izwi web server.  npm start
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const A = require('./auth');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'], mediaSrc: ["'self'", 'blob:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"]
    } },
    crossOriginEmbedderPolicy: false
  }));
  // The microphone is allowed for the in-app podcast recorder. Camera and location are switched off.
  app.use((_req, res, next) => { res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()'); next(); });
  app.use(express.json({ limit: '200kb' }));
  app.use(A.loadUser);
  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, A.csrf, require('./routes'));
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: A.PROD ? '1h' : 0 }));
  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 413 ? 'That file is too big.' : status === 500 ? 'Something went wrong on our side. Try again.' : err.message });
  });
  return app;
}

if (require.main === module) {
  const port = +(process.env.PORT || 3000);
  createApp().listen(port, () => console.log(`Izwi is running at http://localhost:${port}`));
}
module.exports = { createApp };
