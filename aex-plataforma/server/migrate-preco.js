require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[MIGRATE] Adicionando colunas de preço...');
    await client.query(`
      ALTER TABLE produtos
        ADD COLUMN IF NOT EXISTS preco NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS ipi NUMERIC(5,2) DEFAULT 3.25,
        ADD COLUMN IF NOT EXISTS marca VARCHAR(100),
        ADD COLUMN IF NOT EXISTS part_number VARCHAR(50),
        ADD COLUMN IF NOT EXISTS gas VARCHAR(20),
        ADD COLUMN IF NOT EXISTS imagem TEXT;
    `);
    console.log('[MIGRATE] ✅ Colunas adicionadas com sucesso!');
  } catch (err) {
    console.error('[MIGRATE] ❌ Erro:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
