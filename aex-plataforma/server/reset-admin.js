require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('./db');

const NOVA_SENHA = 'AexAdmin@2026';

async function main() {
  const hash = bcrypt.hashSync(NOVA_SENHA, 12);
  const r = await pool.query(
    `UPDATE admins SET senha_hash = $1, ativo = true, nivel = 'gestor' WHERE email = $2 RETURNING email, nome, ativo, nivel`,
    [hash, 'raphaelbmaciel@gmail.com']
  );
  if (r.rowCount === 0) {
    const all = await pool.query('SELECT id, email, nome, ativo, nivel FROM admins');
    console.log('Admin não encontrado. Admins na tabela:', all.rows);
  } else {
    const row = r.rows[0];
    console.log('✅ Senha atualizada para:', NOVA_SENHA, '| Admin:', row.nome, '| ativo:', row.ativo, '| nivel:', row.nivel);
  }
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
