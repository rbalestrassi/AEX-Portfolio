const express   = require('express');
const pool      = require('../db');
const { requireClientAprovado } = require('../middleware/auth');
const emailSvc  = require('../services/email');
const waSvc     = require('../services/whatsapp');
const router    = express.Router();

// Gera número do pedido no formato AEX-AAAA-NNNN
// Usa MAX para ser seguro mesmo com deleções; a constraint UNIQUE no banco
// garante que em caso de colisão (race condition) o INSERT falha e fazemos retry.
async function gerarNumeroPedido() {
  const ano = new Date().getFullYear();
  const prefix = `AEX-${ano}-`;
  const r = await pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM $1) AS INTEGER)), 0) + 1 AS seq
     FROM pedidos WHERE numero LIKE $2`,
    [prefix.length + 1, `${prefix}%`]
  );
  const seq = parseInt(r.rows[0].seq) || 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// POST /api/orders — criar pedido
router.post('/', requireClientAprovado, async (req, res) => {
  const { itens, observacao } = req.body;
  const cliente = req.session.cliente;

  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'O pedido deve ter ao menos um item.' });
  }

  try {
    const desconto = cliente.desconto || 0;

    // Tenta inserir com retry em caso de colisão de número (race condition)
    let pedido;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const numero = await gerarNumeroPedido();
      try {
        const r = await pool.query(
          `INSERT INTO pedidos (numero, cliente_id, itens, observacao, desconto_aplicado)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [numero, cliente.id, JSON.stringify(itens), observacao || null, desconto]
        );
        pedido = r.rows[0];
        break;
      } catch (e) {
        if (e.code !== '23505') throw e; // só retry em violação de unique
        if (tentativa === 4) throw e;
      }
    }

    // Notificações assíncronas (não bloqueia a resposta)
    const totalItens = itens.reduce((s, i) => s + (i.quantidade || 1), 0);
    const listaItens = itens.map(i => `• ${i.codigo} — ${i.nome} (${i.quantidade || 1}x)`).join('\n');

    emailSvc.pedidoConfirmado({ cliente, pedido, itens, listaItens }).catch(e =>
      console.error('[EMAIL] pedidoConfirmado:', e.message)
    );
    emailSvc.novoPedidoAdmin({ cliente, pedido, itens, listaItens }).catch(e =>
      console.error('[EMAIL] novoPedidoAdmin:', e.message)
    );
    waSvc.pedidoConfirmado({ cliente, pedido, totalItens }).catch(e =>
      console.error('[WA] pedidoConfirmado:', e.message)
    );
    waSvc.novoPedidoAdmin({ cliente, pedido, listaItens }).catch(e =>
      console.error('[WA] novoPedidoAdmin:', e.message)
    );

    res.status(201).json({ ok: true, pedido: { id: pedido.id, numero: pedido.numero, status: pedido.status } });
  } catch (err) {
    console.error('[ORDERS] criar erro:', err.message);
    res.status(500).json({ error: 'Erro ao registrar pedido.' });
  }
});

// GET /api/orders — pedidos do cliente logado
router.get('/', requireClientAprovado, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, numero, itens, observacao, desconto_aplicado, status, criado_em, atualizado_em FROM pedidos WHERE cliente_id = $1 ORDER BY criado_em DESC',
      [req.session.cliente.id]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar pedidos.' });
  }
});

// GET /api/orders/:id — detalhe do pedido
router.get('/:id', requireClientAprovado, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM pedidos WHERE id = $1 AND cliente_id = $2',
      [req.params.id, req.session.cliente.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Pedido não encontrado.' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar pedido.' });
  }
});

module.exports = router;
