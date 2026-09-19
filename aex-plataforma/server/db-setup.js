require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('./db');
const bcrypt = require('bcryptjs');

async function setup() {
  const client = await pool.connect();
  try {
    console.log('[SETUP] Criando tabelas...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('operacional','gestor')),
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[SETUP] ✓ tabela admins');

    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        cnpj VARCHAR(18) UNIQUE NOT NULL,
        razao_social VARCHAR(255) NOT NULL,
        nome_fantasia VARCHAR(255),
        responsavel VARCHAR(255) NOT NULL,
        whatsapp VARCHAR(20) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        desconto_percentual DECIMAL(5,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','bloqueado')),
        aprovado_por INTEGER REFERENCES admins(id),
        aprovado_em TIMESTAMP,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[SETUP] ✓ tabela clientes');

    await client.query(`
      CREATE TABLE IF NOT EXISTS produtos (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(20) UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        linha VARCHAR(20) NOT NULL,
        linhas JSONB DEFAULT '[]',
        modelo_compressor VARCHAR(50),
        tensao VARCHAR(10),
        refrigerante VARCHAR(20) DEFAULT 'R-134a',
        saida VARCHAR(30),
        polia VARCHAR(30),
        fixacao VARCHAR(50),
        tipo_oleo VARCHAR(20) DEFAULT 'PAG 46',
        conectores VARCHAR(10),
        codigo_oem TEXT,
        peso_liquido VARCHAR(10),
        peso_bruto VARCHAR(10),
        dimensoes TEXT,
        alinhamento TEXT,
        veiculos TEXT,
        observacoes TEXT,
        recomendacoes TEXT,
        imagens JSONB DEFAULT '[]',
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[SETUP] ✓ tabela produtos');

    await client.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        numero VARCHAR(20) UNIQUE NOT NULL,
        cliente_id INTEGER REFERENCES clientes(id),
        itens JSONB NOT NULL,
        observacao TEXT,
        desconto_aplicado DECIMAL(5,2) DEFAULT 0.00,
        status VARCHAR(30) DEFAULT 'recebido'
          CHECK (status IN ('recebido','separando','enviado','entregue')),
        atualizado_por INTEGER REFERENCES admins(id),
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[SETUP] ✓ tabela pedidos');

    await client.query(`
      CREATE TABLE IF NOT EXISTS historico_pedidos (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER REFERENCES pedidos(id),
        status_anterior VARCHAR(30),
        status_novo VARCHAR(30) NOT NULL,
        admin_id INTEGER REFERENCES admins(id),
        observacao TEXT,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[SETUP] ✓ tabela historico_pedidos');

    // Admin inicial
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminSenha = process.env.ADMIN_SENHA;
    const adminNome  = process.env.ADMIN_NOME || 'Administrador';

    if (adminEmail && adminSenha) {
      const existe = await client.query('SELECT id FROM admins WHERE email = $1', [adminEmail]);
      if (existe.rows.length === 0) {
        const hash = await bcrypt.hash(adminSenha, 12);
        await client.query(
          'INSERT INTO admins (nome, email, senha_hash, nivel) VALUES ($1, $2, $3, $4)',
          [adminNome, adminEmail, hash, 'gestor']
        );
        console.log(`[SETUP] ✓ admin inicial criado: ${adminEmail}`);
      } else {
        console.log(`[SETUP] Admin já existe: ${adminEmail}`);
      }
    } else {
      console.log('[SETUP] ⚠ ADMIN_EMAIL ou ADMIN_SENHA não definidos no .env — admin inicial não criado');
    }

    console.log('[SETUP] ✅ Setup concluído com sucesso!');
  } catch (err) {
    console.error('[SETUP] ❌ Erro:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
