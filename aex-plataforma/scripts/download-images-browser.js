// Cole este script no Console do Safari/Chrome em https://www.aexautomotive.com.br (COM o www)
// Usa <img> + canvas para contornar bloqueio de fetch do CloudFlare

(async () => {
  // Carrega JSZip
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });

  function imgToBlob(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        canvas.toBlob(blob => resolve(blob), 'image/png');
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // Busca part numbers dos produtos
  let parts = [];
  try {
    const prods = await fetch('https://pedidos.aexautomotive.com.br/api/products').then(r => r.json());
    parts = prods.filter(p => p.part_number).map(p => p.part_number);
    console.log(`[AEX] ${parts.length} part numbers da API`);
  } catch (e) {
    // Fallback: range manual
    for (let i = 6502; i <= 6620; i++) parts.push(i);
    console.log('[AEX] Usando range 6502-6620 (API não acessível)');
  }

  const zip = new JSZip();
  let ok = 0, err = 0;

  for (const n of parts) {
    const filename = `AEX-${n}-01.png`;
    const url = `/assets/produtos/${filename}`; // mesmo domínio (www)
    const blob = await imgToBlob(url);
    if (blob && blob.size > 1000) {
      zip.file(filename, blob);
      ok++;
      console.log(`✓ ${filename} (${ok}/${parts.length})`);
    } else {
      err++;
    }
  }

  console.log(`\n✅ ${ok} imagens, ${err} não encontradas. Gerando ZIP...`);
  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = 'produtos-aex.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  console.log('📦 ZIP baixado!');
})();
