const express  = require('express');
const bcrypt   = require('bcryptjs');
const pool     = require('../db');
const router   = express.Router();

// POST /api/auth/cadastro — cadastro de novo cliente
router.post('/cadastro', async (req, res) => {
  const { cnpj, razao_social, nome_fantasia, responsavel, whatsapp, email, senha } = req.body;

  if (!cnpj || !razao_social || !responsavel || !whatsapp || !email || !senha) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
  }

  try {
    const existe = await pool.query(
      'SELECT id FROM clientes WHERE email = $1 OR cnpj = $2',
      [email, cnpj]
    );
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'Email ou CNPJ já cadastrado.' });
    }

    const hash = await bcrypt.hash(senha, 12);
    await pool.query(
      `INSERT INTO clientes (cnpj, razao_social, nome_fantasia, responsavel, whatsapp, email, senha_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [cnpj, razao_social, nome_fantasia || null, responsavel, whatsapp, email, hash]
    );

    res.status(201).json({ ok: true, message: 'Cadastro realizado! Aguarde aprovação da AEX para fazer pedidos.' });
  } catch (err) {
    console.error('[AUTH] cadastro erro:', err.message);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

// POST /api/auth/login — login de cliente
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'Informe email e senha.' });

  try {
    const r = await pool.query('SELECT * FROM clientes WHERE email = $1', [email]);
    const cliente = r.rows[0];
    if (!cliente) return res.status(401).json({ error: 'Email ou senha incorretos.' });

    const ok = await bcrypt.compare(senha, cliente.senha_hash);
    if (!ok) return res.status(401).json({ error: 'Email ou senha incorretos.' });

    req.session.cliente = {
      id:           cliente.id,
      nome:         cliente.responsavel,
      razao_social: cliente.razao_social,
      email:        cliente.email,
      whatsapp:     cliente.whatsapp,
      cnpj:         cliente.cnpj,
      status:       cliente.status,
      desconto:     parseFloat(cliente.desconto_percentual),
    };

    res.json({ ok: true, cliente: req.session.cliente });
  } catch (err) {
    console.error('[AUTH] login erro:', err.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/auth/admin/login — login de admin
router.post('/admin/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'Informe email e senha.' });

  try {
    const r = await pool.query('SELECT * FROM admins WHERE email = $1 AND ativo = true', [email]);
    const admin = r.rows[0];
    if (!admin) return res.status(401).json({ error: 'Email ou senha incorretos.' });

    const ok = await bcrypt.compare(senha, admin.senha_hash);
    if (!ok) return res.status(401).json({ error: 'Email ou senha incorretos.' });

    req.session.admin = {
      id:    admin.id,
      nome:  admin.nome,
      email: admin.email,
      nivel: admin.nivel,
    };

    res.json({ ok: true, admin: req.session.admin });
  } catch (err) {
    console.error('[AUTH] admin login erro:', err.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/me — retorna sessão atual
router.get('/me', (req, res) => {
  if (req.session.admin)   return res.json({ tipo: 'admin',   ...req.session.admin });
  if (req.session.cliente) return res.json({ tipo: 'cliente', ...req.session.cliente });
  res.status(401).json({ error: 'Não autenticado.' });
});

module.exports = router;
