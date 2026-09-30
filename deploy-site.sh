#!/bin/bash
# Deploy: atualiza site principal (aexautomotive.com.br) e plataforma de pedidos
set -e

REPO=/var/www/aex-plataforma

echo "==> git pull..."
cd "$REPO" && git pull origin main

# ── Site principal (Docker/Nginx) ─────────────────────────────────────────────
CONTAINER=$(docker ps -q -f name=claudinho_aex)
if [ -n "$CONTAINER" ]; then
  echo "==> Copiando site principal para container $CONTAINER..."
  docker cp "$REPO/site-aex-publicacao/." "$CONTAINER:/usr/share/nginx/html/"
  echo "    OK — aexautomotive.com.br atualizado"
else
  echo "    AVISO: container claudinho_aex nao encontrado"
fi

# ── Plataforma de pedidos (PM2/Node) ─────────────────────────────────────────
echo "==> Reiniciando plataforma de pedidos..."
pm2 restart aex-plataforma --silent && echo "    OK — pedidos.aexautomotive.com.br atualizado"

echo ""
echo "Deploy concluido."
