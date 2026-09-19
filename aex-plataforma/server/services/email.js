const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"AEX Air Automotive" <${process.env.EMAIL_REMETENTE}>`;
const BASE_URL = process.env.BASE_URL || 'https://pedidos.aexautomotive.com.br';

function statusLabel(s) {
  return { recebido: 'Recebido', separando: 'Separando', enviado: 'Enviado', entregue: 'Entregue' }[s] || s;
}
function statusMsg(s) {
  return {
    separando: 'Seu pedido está sendo separado no estoque.',
    enviado:   'Seu pedido foi despachado e está a caminho.',
    entregue:  'Pedido entregue! Obrigado pela confiança na AEX Air Automotive.',
  }[s] || '';
}

// Confirmação ao cliente
async function pedidoConfirmado({ cliente, pedido, listaItens }) {
  if (!process.env.SMTP_USER) return;
  const total = JSON.parse(typeof pedido.itens === 'string' ? pedido.itens : JSON.stringify(pedido.itens)).reduce((s, i) => s + (i.quantidade || 1), 0);
  await transporter.sendMail({
    from: FROM,
    to: cliente.email,
    subject: `✅ Pedido ${pedido.numero} confirmado — AEX Air Automotive`,
    html: `
      <h2>Olá, ${cliente.nome}!</h2>
      <p>Seu pedido <strong>${pedido.numero}</strong> foi recebido com sucesso.</p>
      <pre style="background:#f4f4f4;padding:12px;border-radius:6px">${listaItens}</pre>
      <p>Acompanhe o status em: <a href="${BASE_URL}/meus-pedidos">${BASE_URL}/meus-pedidos</a></p>
      <p>Em breve nossa equipe irá processá-lo.<br><strong>AEX Air Automotive</strong></p>
    `,
  });
}

// Aviso interno para a AEX
async function novoPedidoAdmin({ cliente, pedido, listaItens }) {
  if (!process.env.EMAIL_AEX) return;
  await transporter.sendMail({
    from: FROM,
    to: process.env.EMAIL_AEX,
    subject: `🔔 Novo pedido ${pedido.numero} — ${cliente.razao_social}`,
    html: `
      <h2>Novo pedido recebido</h2>
      <p><strong>Pedido:</strong> ${pedido.numero}</p>
      <p><strong>Cliente:</strong> ${cliente.razao_social}</p>
      <p><strong>CNPJ:</strong> ${cliente.cnpj}</p>
      <p><strong>WhatsApp:</strong> ${cliente.whatsapp}</p>
      <pre style="background:#f4f4f4;padding:12px;border-radius:6px">${listaItens}</pre>
      ${pedido.observacao ? `<p><strong>Obs:</strong> ${pedido.observacao}</p>` : ''}
      <p><a href="${BASE_URL}/admin/pedidos">Acessar painel</a></p>
    `,
  });
}

// Atualização de status ao cliente
async function atualizacaoStatus({ cliente, pedido }) {
  if (!process.env.SMTP_USER || !cliente.email) return;
  await transporter.sendMail({
    from: FROM,
    to: cliente.email,
    subject: `📦 Pedido ${pedido.numero} — ${statusLabel(pedido.status)}`,
    html: `
      <h2>Atualização do pedido ${pedido.numero}</h2>
      <p>Olá, ${cliente.nome}!</p>
      <p>Novo status: <strong>${statusLabel(pedido.status)}</strong></p>
      ${statusMsg(pedido.status) ? `<p>${statusMsg(pedido.status)}</p>` : ''}
      <p><a href="${BASE_URL}/meus-pedidos">Ver meus pedidos</a></p>
      <p><strong>AEX Air Automotive</strong></p>
    `,
  });
}

module.exports = { pedidoConfirmado, novoPedidoAdmin, atualizacaoStatus };
