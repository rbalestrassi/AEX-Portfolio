const express  = require('express');
const bcrypt   = require('bcryptjs');
const pool     = require('../db');
const { requireAdmin, requireGestor } = require('../middleware/auth');
const waSvc    = require('../services/whatsapp');
const emailSvc = require('../services/email');
const router   = express.Router();

// GET /api/admin/pedidos — todos os pedidos
router.get('/pedidos', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.*, c.razao_social, c.responsavel, c.whatsapp AS cliente_whatsapp, c.email AS cliente_email
      FROM pedidos p
      JOIN clientes c ON c.id = p.cliente_id
      ORDER BY p.criado_em DESC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar pedidos.' });
  }
});

// PATCH /api/admin/pedidos/:id/status — atualizar status do pedido
router.patch('/pedidos/:id/status', requireAdmin, async (req, res) => {
  const { status, observacao } = req.body;
  const statusValidos = ['recebido', 'separando', 'enviado', 'entregue'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    // Busca pedido atual com dados do cliente
    const atual = await pool.query(`
      SELECT p.*, c.razao_social, c.responsavel, c.whatsapp, c.email
      FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = $1
    `, [req.params.id]);
    if (!atual.rows[0]) return res.status(404).json({ error: 'Pedido não encontrado.' });

    const pedido  = atual.rows[0];
    const anterior = pedido.status;

    // Atualiza pedido
    const r = await pool.query(
      `UPDATE pedidos SET status = $1, atualizado_por = $2, atualizado_em = NOW()
       WHERE id = $3 RETURNING *`,
      [status, req.session.admin.id, req.params.id]
    );

    // Registra histórico
    await pool.query(
      `INSERT INTO historico_pedidos (pedido_id, status_anterior, status_novo, admin_id, observacao)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, anterior, status, req.session.admin.id, observacao || null]
    );

    // Notifica cliente
    const cliente = {
      nome:     pedido.responsavel,
      whatsapp: pedido.whatsapp,
      email:    pedido.email,
    };
    waSvc.atualizacaoStatus({ cliente, pedido: r.rows[0] }).catch(e =>
      console.error('[WA] atualizacaoStatus:', e.message)
    );
    emailSvc.atualizacaoStatus({ cliente, pedido: r.rows[0] }).catch(e =>
      console.error('[EMAIL] atualizacaoStatus:', e.message)
    );

    res.json({ ok: true, pedido: r.rows[0] });
  } catch (err) {
    console.error('[ADMIN] status erro:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

// GET /api/admin/historico/:pedidoId — histórico de um pedido
router.get('/historico/:pedidoId', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT h.*, a.nome AS admin_nome
      FROM historico_pedidos h
      LEFT JOIN admins a ON a.id = h.admin_id
      WHERE h.pedido_id = $1
      ORDER BY h.criado_em ASC
    `, [req.params.pedidoId]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar histórico.' });
  }
});

// GET /api/admin/admins — lista admins (gestor)
router.get('/admins', requireGestor, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, nome, email, nivel, ativo, criado_em FROM admins ORDER BY id');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar admins.' });
  }
});

// POST /api/admin/admins — criar admin (gestor)
router.post('/admins', requireGestor, async (req, res) => {
  const { nome, email, senha, nivel } = req.body;
  if (!nome || !email || !senha || !['operacional','gestor'].includes(nivel)) {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }
  try {
    const hash = await bcrypt.hash(senha, 12);
    const r = await pool.query(
      'INSERT INTO admins (nome, email, senha_hash, nivel) VALUES ($1, $2, $3, $4) RETURNING id, nome, email, nivel',
      [nome, email, hash, nivel]
    );
    res.status(201).json({ ok: true, admin: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email já cadastrado.' });
    res.status(500).json({ error: 'Erro ao criar admin.' });
  }
});

// GET /api/admin/dashboard — métricas rápidas
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const [pedidos, clientes, pendentes] = await Promise.all([
      pool.query('SELECT status, COUNT(*) FROM pedidos GROUP BY status'),
      pool.query("SELECT COUNT(*) FROM clientes WHERE status = 'aprovado'"),
      pool.query("SELECT COUNT(*) FROM clientes WHERE status = 'pendente'"),
    ]);
    res.json({
      pedidos:         pedidos.rows,
      clientes_ativos: parseInt(clientes.rows[0].count),
      cadastros_pendentes: parseInt(pendentes.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar dashboard.' });
  }
});

module.exports = router;
