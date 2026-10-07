const express  = require('express');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const pool     = require('../db');
const { requireAdmin, requireGestor, requireClient } = require('../middleware/auth');
const router   = express.Router();

function gerarSenhaTemp() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const len = 8;
  let s = 'AEX@';
  const bytes = crypto.randomBytes(len * 2);
  let i = 0;
  while (s.length - 4 < len) {
    const b = bytes[i++];
    if (b < chars.length * Math.floor(256 / chars.length)) {
      s += chars[b % chars.length];
    }
  }
  return s;
}

// POST /api/clients — criar cliente (gestor)
router.post('/', requireGestor, async (req, res) => {
  const { cnpj, razao_social, nome_fantasia, responsavel, whatsapp, email, desconto } = req.body;
  if (!cnpj || !razao_social || !responsavel || !whatsapp || !email) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }
  try {
    const existe = await pool.query(
      'SELECT id FROM clientes WHERE email = $1 OR cnpj = $2',
      [email, cnpj]
    );
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'Email ou CNPJ já cadastrado.' });
    }

    const senhaTemp = gerarSenhaTemp();
    const hash = await bcrypt.hash(senhaTemp, 12);
    const desc = parseFloat(desconto) || 0;

    const r = await pool.query(
      `INSERT INTO clientes (cnpj, razao_social, nome_fantasia, responsavel, whatsapp, email, senha_hash, status, desconto_percentual, aprovado_por, aprovado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'aprovado', $8, $9, NOW())
       RETURNING id, cnpj, razao_social, responsavel, email, whatsapp, status, desconto_percentual, criado_em`,
      [cnpj, razao_social, nome_fantasia || null, responsavel, whatsapp, email, hash, desc, req.session.admin.id]
    );

    res.status(201).json({ ok: true, cliente: r.rows[0], senha_temp: senhaTemp });
  } catch (err) {
    console.error('[CLIENTS] criar erro:', err.message);
    res.status(500).json({ error: 'Erro ao criar cliente.' });
  }
});

// GET /api/clients — lista clientes (admin operacional: só aprovados; gestor: todos)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const isGestor = req.session.admin.nivel === 'gestor';
    const sql = isGestor
      ? 'SELECT id, cnpj, razao_social, nome_fantasia, responsavel, whatsapp, email, desconto_percentual, status, criado_em FROM clientes ORDER BY criado_em DESC'
      : 'SELECT id, cnpj, razao_social, responsavel, whatsapp, email, desconto_percentual, status, criado_em FROM clientes WHERE status = $1 ORDER BY razao_social ASC';
    const params = isGestor ? [] : ['aprovado'];
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar clientes.' });
  }
});

// PATCH /api/clients/:id/status — aprovar ou bloquear (gestor)
router.patch('/:id/status', requireGestor, async (req, res) => {
  const { status } = req.body;
  if (!['aprovado', 'bloqueado', 'pendente'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }
  try {
    const r = await pool.query(
      `UPDATE clientes SET status = $1, aprovado_por = $2, aprovado_em = NOW()
       WHERE id = $3 RETURNING id, razao_social, status`,
      [status, req.session.admin.id, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Cliente não encontrado.' });
    res.json({ ok: true, cliente: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

// PATCH /api/clients/:id/desconto — aplicar desconto (gestor)
router.patch('/:id/desconto', requireGestor, async (req, res) => {
  const desconto = parseFloat(req.body.desconto);
  if (isNaN(desconto) || desconto < 0 || desconto > 100) {
    return res.status(400).json({ error: 'Desconto inválido (0–100).' });
  }
  try {
    const r = await pool.query(
      'UPDATE clientes SET desconto_percentual = $1 WHERE id = $2 RETURNING id, razao_social, desconto_percentual',
      [desconto, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Cliente não encontrado.' });
    res.json({ ok: true, cliente: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao aplicar desconto.' });
  }
});

// POST /api/clients/:id/resetar-senha — gera nova senha temporária (gestor)
router.post('/:id/resetar-senha', requireGestor, async (req, res) => {
  try {
    const existe = await pool.query('SELECT id FROM clientes WHERE id = $1', [req.params.id]);
    if (!existe.rows[0]) return res.status(404).json({ error: 'Cliente não encontrado.' });

    const senhaTemp = gerarSenhaTemp();
    const hash = await bcrypt.hash(senhaTemp, 12);
    await pool.query('UPDATE clientes SET senha_hash = $1 WHERE id = $2', [hash, req.params.id]);

    res.json({ ok: true, senha_temp: senhaTemp });
  } catch (err) {
    console.error('[CLIENTS] reset senha erro:', err.message);
    res.status(500).json({ error: 'Erro ao resetar senha.' });
  }
});

// POST /api/clients/alterar-senha — cliente altera a própria senha
router.post('/alterar-senha', requireClient, async (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (!senha_atual || !nova_senha) {
    return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
  }
  if (nova_senha.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }
  try {
    const r = await pool.query('SELECT senha_hash FROM clientes WHERE id = $1', [req.session.cliente.id]);
    const ok = await bcrypt.compare(senha_atual, r.rows[0].senha_hash);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta.' });

    const hash = await bcrypt.hash(nova_senha, 12);
    await pool.query('UPDATE clientes SET senha_hash = $1 WHERE id = $2', [hash, req.session.cliente.id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[CLIENTS] alterar senha erro:', err.message);
    res.status(500).json({ error: 'Erro ao alterar senha.' });
  }
});

module.exports = router;
