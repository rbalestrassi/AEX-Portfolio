const axios = require('axios');

const API_URL  = () => process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const API_KEY  = () => process.env.EVOLUTION_API_KEY || '';
const INSTANCE = () => process.env.EVOLUTION_INSTANCE || 'aex-instance';
const AEX_WA   = () => process.env.WHATSAPP_AEX || '';
const BASE_URL = process.env.BASE_URL || 'https://pedidos.aexautomotive.com.br';

function statusLabel(s) {
  return { recebido: 'Recebido ✅', separando: 'Separando 📦', enviado: 'Enviado 🚚', entregue: 'Entregue ✅' }[s] || s;
}
function statusMsg(s) {
  return {
    separando: 'Seu pedido está sendo separado no estoque.',
    enviado:   'Seu pedido foi despachado e está a caminho.',
    entregue:  'Pedido entregue! Obrigado pela confiança. 🙏',
  }[s] || '';
}

async function send(number, text) {
  if (!API_KEY()) return;
  const num = number.replace(/\D/g, '');
  await axios.post(
    `${API_URL()}/message/sendText/${INSTANCE()}`,
    { number: num, text },
    { headers: { apikey: API_KEY() }, timeout: 8000 }
  );
}

async function pedidoConfirmado({ cliente, pedido, totalItens }) {
  const msg =
`✅ *Pedido AEX confirmado!*

Olá, ${cliente.nome}!
Seu pedido *${pedido.numero}* foi recebido.

📦 ${totalItens} compressor(es)
📋 Acompanhe: ${BASE_URL}/meus-pedidos

Em breve nossa equipe irá processá-lo.
*AEX Air Automotive*`;
  await send(cliente.whatsapp, msg);
}

async function novoPedidoAdmin({ cliente, pedido, listaItens }) {
  if (!AEX_WA()) return;
  const msg =
`🔔 *Novo pedido recebido!*

*Pedido:* ${pedido.numero}
*Cliente:* ${cliente.razao_social}
*CNPJ:* ${cliente.cnpj}
*WhatsApp:* ${cliente.whatsapp}

*Itens:*
${listaItens}
${pedido.observacao ? `\n*Obs:* ${pedido.observacao}` : ''}

Acesse o painel para processar.`;
  await send(AEX_WA(), msg);
}

async function atualizacaoStatus({ cliente, pedido }) {
  const detalhe = statusMsg(pedido.status);
  const msg =
`📦 *Atualização do pedido ${pedido.numero}*

Olá, ${cliente.nome}!
Novo status: *${statusLabel(pedido.status)}*
${detalhe ? `\n${detalhe}` : ''}

*AEX Air Automotive*`;
  await send(cliente.whatsapp, msg);
}

module.exports = { pedidoConfirmado, novoPedidoAdmin, atualizacaoStatus };
