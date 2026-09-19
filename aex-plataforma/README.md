# AEX Plataforma — B2B de Pedidos

Plataforma de pedidos B2B para AEX Air Automotive, distribuída pela Arkalt.

## Stack

- **Backend:** Node.js + Express
- **Banco:** PostgreSQL
- **Sessões:** express-session + connect-pg-simple
- **Email:** Nodemailer + SMTP Hostinger
- **WhatsApp:** Evolution API
- **Frontend:** HTML/CSS/JS puro

## Instalação local (desenvolvimento)

```bash
cd aex-plataforma
npm install
cp .env.example .env
# Editar .env com suas credenciais
node server/db-setup.js   # Cria tabelas + admin inicial
npm run dev               # Inicia em modo dev (porta 3000)
```

## Deploy no VPS (produção)

```bash
# No VPS (ssh root@2.25.142.243)
mkdir -p /var/www/aex-plataforma
cd /var/www/aex-plataforma
git clone https://github.com/rbalestrassi/AEX-Portfolio.git .
cd aex-plataforma
npm install
cp .env.example .env
nano .env             # Preencher todas as variáveis
node server/db-setup.js
pm2 start server/index.js --name aex-plataforma
pm2 save && pm2 startup
```

## Estrutura

```
server/
  index.js           # Express + sessões + rotas
  db.js              # Pool PostgreSQL
  db-setup.js        # Cria tabelas + admin inicial
  routes/
    auth.js          # Login, cadastro, logout
    products.js      # Listagem de produtos
    orders.js        # Criar e listar pedidos
    clients.js       # Gestão de clientes
    admin.js         # Painel admin + atualização de status
  services/
    email.js         # Nodemailer
    whatsapp.js      # Evolution API
  middleware/
    auth.js          # requireClient, requireAdmin, requireGestor

public/
  index.html         # Catálogo público com carrinho
  login.html         # Login cliente + admin
  cadastro.html      # Cadastro de clientes
  pedido.html        # Finalização do pedido
  meus-pedidos.html  # Histórico + barra de progresso
  admin/
    index.html       # Dashboard
    pedidos.html     # Gerenciar pedidos
    clientes.html    # Aprovar clientes + descontos
```

## Níveis de acesso admin

| Ação | Operacional | Gestor |
|------|-------------|--------|
| Ver/atualizar pedidos | ✅ | ✅ |
| Ver clientes aprovados | ✅ | ✅ |
| Aprovar/bloquear clientes | ❌ | ✅ |
| Aplicar desconto | ❌ | ✅ |
| Criar admins | ❌ | ✅ |

## Variáveis de ambiente necessárias

Ver `.env.example`
