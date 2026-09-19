// Verifica se o usuário (cliente) está logado
function requireClient(req, res, next) {
  if (!req.session?.cliente) {
    return res.status(401).json({ error: 'Não autenticado. Faça login para continuar.' });
  }
  next();
}

// Verifica se o cliente está aprovado
function requireClientAprovado(req, res, next) {
  if (!req.session?.cliente) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  if (req.session.cliente.status !== 'aprovado') {
    return res.status(403).json({ error: 'Cadastro pendente de aprovação. Aguarde o contato da AEX.' });
  }
  next();
}

// Verifica se o admin está logado
function requireAdmin(req, res, next) {
  if (!req.session?.admin) {
    return res.status(401).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

// Verifica se o admin tem nível gestor
function requireGestor(req, res, next) {
  if (!req.session?.admin) {
    return res.status(401).json({ error: 'Acesso restrito a administradores.' });
  }
  if (req.session.admin.nivel !== 'gestor') {
    return res.status(403).json({ error: 'Acesso restrito a gestores.' });
  }
  next();
}

module.exports = { requireClient, requireClientAprovado, requireAdmin, requireGestor };
