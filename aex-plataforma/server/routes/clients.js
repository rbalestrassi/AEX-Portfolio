const express  = require('express');
const pool     = require('../db');
const { requireAdmin, requireGestor } = require('../middleware/auth');
const router   = express.Router();

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

module.exports = router;
