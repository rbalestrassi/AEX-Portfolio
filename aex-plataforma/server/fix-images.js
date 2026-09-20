require('dotenv').config();
const pool = require('./db');

async function main() {
  // Fix image URLs: use part_number (e.g. 6502) not codigo (e.g. AEX20.01)
  const upd = await pool.query(`
    UPDATE produtos
    SET imagem = 'https://www.aexautomotive.com.br/assets/produtos/AEX-' || part_number || '-01.png'
    WHERE part_number IS NOT NULL AND part_number != ''
    RETURNING codigo, part_number, imagem
  `);
  console.log(`\n✅ ${upd.rowCount} produtos com imagem corrigida`);
  if (upd.rowCount > 0) {
    console.log('Exemplo:', upd.rows[0]);
  }

  // Show products with no image (no part_number)
  const sem = await pool.query(`SELECT COUNT(*) FROM produtos WHERE imagem IS NULL OR imagem = ''`);
  console.log(`⚠️  ${sem.rows[0].count} produtos sem imagem (sem part_number)`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
