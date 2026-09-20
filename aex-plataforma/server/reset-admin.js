require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('./db');

const NOVA_SENHA = 'AexAdmin@2026';

async function main() {
  const hash = bcrypt.hashSync(NOVA_SENHA, 12);
  const r = await pool.query(
    `UPDATE admins SET senha_hash = $1, ativo = true WHERE email = $2 RETURNING email, nome, ativo`,
    [hash, 'raphaelbmaciel@gmail.com']
  );
  if (r.rowCount === 0) {
    const all = await pool.query('SELECT id, email, nome, ativo FROM admins');
    console.log('Admin não encontrado. Admins na tabela:', all.rows);
  } else {
    console.log('✅ Senha atualizada para:', NOVA_SENHA, '| Admin:', r.rows[0].nome, '| ativo:', r.rows[0].ativo);
  }
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
