require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('./db');

const NOVA_SENHA = 'AexAdmin@2026';

async function main() {
  const hash = bcrypt.hashSync(NOVA_SENHA, 12);
  const r = await pool.query(
    `UPDATE admins SET senha_hash = $1 WHERE email = $2 RETURNING email, nome`,
    [hash, 'raphaelbmaciel@gmail.com']
  );
  if (r.rowCount === 0) { console.log('Admin não encontrado.'); }
  else { console.log('✅ Senha atualizada para:', NOVA_SENHA, '| Admin:', r.rows[0].nome); }
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
