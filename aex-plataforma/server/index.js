require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express    = require('express');
const session    = require('express-session');
const pgSession  = require('connect-pg-simple')(session);
const path       = require('path');
const pool       = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ───────────────────────────────────────────────────────────────
// CORS: frontend é servido pelo mesmo Express — credenciais same-origin,
// não é necessário CORS com credentials. Nenhuma origem externa autorizada.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'aex-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// ── Arquivos estáticos ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── Rotas API ─────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/clients',  require('./routes/clients'));
app.use('/api/admin',    require('./routes/admin'));

// ── Proxy de imagens de produto ───────────────────────────────────────────────
// Evita bloqueio de hotlink/cross-origin no Chrome ao servir via mesmo domínio
app.get('/img/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!/^[\w.-]+-01\.png$/.test(filename)) return res.status(400).end();
  const url = `https://www.aexautomotive.com.br/assets/produtos/${filename}`;
  const https = require('https');
  https.get(url, (upstream) => {
    if (upstream.statusCode !== 200) {
      upstream.resume();
      return res.status(upstream.statusCode).end();
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    upstream.pipe(res);
  }).on('error', () => res.status(502).end());
});

// ── Rota de saúde ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV, ts: new Date().toISOString() });
});

// ── SPA fallback — rotas HTML ─────────────────────────────────────────────────
const pages = {
  '/login':         'login.html',
  '/cadastro':      'cadastro.html',
  '/pedido':        'pedido.html',
  '/meus-pedidos':  'meus-pedidos.html',
  '/admin':         'admin/index.html',
  '/admin/pedidos': 'admin/pedidos.html',
  '/admin/clientes':'admin/clientes.html',
  '/admin/produtos':'admin/produtos.html',
};
Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (_, res) =>
    res.sendFile(path.join(__dirname, '../public', file))
  );
});

// Catálogo público (raiz)
app.get('/', (_, res) =>
  res.sendFile(path.join(__dirname, '../public/index.html'))
);

// ── Iniciar ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[AEX] Servidor rodando na porta ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
