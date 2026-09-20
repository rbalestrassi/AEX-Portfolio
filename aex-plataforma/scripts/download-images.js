// Roda no Mac: node scripts/download-images.js
// Baixa todas as imagens de produto do site principal e salva em public/assets/produtos/
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const OUT_DIR = path.join(__dirname, '../public/assets/produtos');
fs.mkdirSync(OUT_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
  });
}

async function main() {
  // Busca lista de produtos da API em produção
  const apiUrl = 'https://pedidos.aexautomotive.com.br/api/products';
  console.log('[DOWNLOAD] Buscando lista de produtos...');

  const produtos = await new Promise((resolve, reject) => {
    https.get(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });

  console.log(`[DOWNLOAD] ${produtos.length} produtos encontrados`);

  let ok = 0, err = 0;
  for (const p of produtos) {
    if (!p.part_number) { continue; }
    const filename = `AEX-${p.part_number}-01.png`;
    const dest = path.join(OUT_DIR, filename);
    if (fs.existsSync(dest)) { ok++; continue; } // já baixado
    const url = `https://www.aexautomotive.com.br/assets/produtos/${filename}`;
    try {
      await download(url, dest);
      process.stdout.write(`✓ ${filename}\n`);
      ok++;
    } catch (e) {
      process.stdout.write(`✗ ${filename}: ${e.message}\n`);
      err++;
    }
    await new Promise(r => setTimeout(r, 100)); // evita rate limit
  }

  console.log(`\n✅ ${ok} imagens salvas em public/assets/produtos/`);
  if (err) console.log(`⚠️  ${err} erros`);
}

main().catch(e => { console.error(e); process.exit(1); });
