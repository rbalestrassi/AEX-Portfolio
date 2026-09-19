const express = require('express');
const pool    = require('../db');
const router  = express.Router();

// GET /api/products — lista todos os produtos ativos
router.get('/', async (req, res) => {
  try {
    const { linha, q } = req.query;
    let sql = 'SELECT * FROM produtos WHERE ativo = true';
    const params = [];

    if (linha && linha !== 'todas') {
      params.push(linha);
      // JSONB @> requer um array JSON — passamos como string e fazemos o cast
      params.push(JSON.stringify([linha]));
      sql += ` AND (linha = $${params.length - 1} OR linhas @> $${params.length}::jsonb)`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (nome ILIKE $${params.length} OR veiculos ILIKE $${params.length} OR codigo ILIKE $${params.length})`;
    }

    sql += ' ORDER BY id ASC';
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch (err) {
    console.error('[PRODUCTS] erro:', err.message);
    res.status(500).json({ error: 'Erro ao carregar produtos.' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM produtos WHERE id = $1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar produto.' });
  }
});

module.exports = router;
