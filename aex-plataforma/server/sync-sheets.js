const https = require('https');
const pool  = require('./db');

const SHEET_ID  = '1pNr-14QJXRs83f8-0s0QTOpvvVxIQ-qO';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AEX-Sync/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchCSV(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  }).filter(r => r['Código']);
}

function parseRow(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += c;
  }
  result.push(cur);
  return result;
}

function parsePreco(s) {
  if (!s) return null;
  const n = s.replace(/[R$\s.]/g, '').replace(',', '.');
  const v = parseFloat(n);
  return isNaN(v) ? null : v;
}

function parseIPI(s) {
  if (!s) return 3.25;
  const n = parseFloat(s.replace('%', '').replace(',', '.'));
  return isNaN(n) ? 3.25 : n;
}

function parseLinha(s) {
  if (!s) return { principal: 'Linha Leve', todas: ['Linha Leve'] };
  const mapa = {
    'leve':       'Linha Leve',
    'pesada':     'Linha Pesada',
    'agr':        'Linha Agrícola',
    'rodovi':     'Rodoviário',
    'aérea': 'Aérea',
    'elétric':'Elétrica/Híbrida',
    'premium':    'Premium',
  };
  const partes = s.split('/').map(p => p.trim()).filter(Boolean);
  const linhas = partes.map(p => {
    const lower = p.toLowerCase();
    for (const [key, val] of Object.entries(mapa)) {
      if (lower.includes(key)) return val;
    }
    return p;
  });
  return { principal: linhas[0] || 'Linha Leve', todas: linhas };
}

async function syncProdutos() {
  console.log('[SYNC] Buscando planilha...');
  const csv = await fetchCSV(SHEET_URL);
  const rows = parseCSV(csv);
  console.log(`[SYNC] ${rows.length} produtos encontrados`);

  const client = await pool.connect();
  let inseridos = 0, atualizados = 0, erros = 0;

  try {
    for (const row of rows) {
      try {
        const { principal, todas } = parseLinha(row['Linha'] || '');
        const codigo = row['Código'];
        const partNum = row['Cod. Interno'] || row['Part-number'] || null;
        const imagem = partNum
          ? `https://www.aexautomotive.com.br/assets/produtos/AEX-${partNum}-01.png`
          : null;
        await client.query(`
          INSERT INTO produtos
            (codigo, nome, linha, linhas, preco, ipi, marca, part_number,
             veiculos, tipo_oleo, gas, tensao, codigo_oem, polia, modelo_compressor, imagem, ativo)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true)
          ON CONFLICT (codigo) DO UPDATE SET
            nome              = EXCLUDED.nome,
            linha             = EXCLUDED.linha,
            linhas            = EXCLUDED.linhas,
            preco             = EXCLUDED.preco,
            ipi               = EXCLUDED.ipi,
            marca             = EXCLUDED.marca,
            part_number       = EXCLUDED.part_number,
            veiculos          = EXCLUDED.veiculos,
            tipo_oleo         = EXCLUDED.tipo_oleo,
            gas               = EXCLUDED.gas,
            tensao            = EXCLUDED.tensao,
            codigo_oem        = EXCLUDED.codigo_oem,
            polia             = EXCLUDED.polia,
            modelo_compressor = EXCLUDED.modelo_compressor,
            imagem            = EXCLUDED.imagem
        `, [
          codigo,
          row['Descrição'],
          principal,
          JSON.stringify(todas),
          parsePreco(row['Valor']),
          parseIPI(row['IPI']),
          row['Marca'] || 'AEX AUTOMOTIVE AIR',
          row['Cod. Interno'] || row['Part-number'] || null,
          row['Veículos'] || null,
          row['Óleo'] || 'PAG 46',
          row['Gás'] || 'R134a',
          row['Voltagem'] || '12v',
          row['Código OEM'] || null,
          row['Polia'] || null,
          row['Modelo'] || null,
          imagem,
        ]);
        // check if it was insert or update
        inseridos++;
      } catch (e) {
        console.error(`[SYNC] Erro no produto ${row['Código']}:`, e.message);
        erros++;
      }
    }
  } finally {
    client.release();
  }

  const resultado = { total: rows.length, sincronizados: inseridos, erros };
  console.log('[SYNC] ✅ Concluído:', resultado);
  return resultado;
}

module.exports = { syncProdutos };

if (require.main === module) {
  syncProdutos().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
