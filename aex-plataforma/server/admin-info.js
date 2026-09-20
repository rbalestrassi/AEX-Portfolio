require('dotenv').config();
const pool = require('./db');

async function main() {
  const admins = await pool.query('SELECT email, nome FROM admins');
  console.log('\n=== ADMINS ===');
  admins.rows.forEach(r => console.log(' email:', r.email, '| nome:', r.nome));

  const upd = await pool.query(
    `UPDATE produtos SET imagem = 'https://www.aexautomotive.com.br/assets/produtos/' || codigo || '-01.png'`
  );
  console.log('\n=== IMAGENS ===');
  console.log(' Produtos atualizados:', upd.rowCount);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
