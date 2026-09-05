<?php
/**
 * AEX Site — API de dados persistentes
 * GET  api/data.php?type=hero|footer|products   → lê JSON do servidor
 * POST api/data.php?type=hero|footer|products   → salva JSON no servidor
 *      Header: X-AEX-Token: <token>
 */

header('Content-Type: application/json; charset=utf-8');

// Tipos permitidos
$ALLOWED = ['hero','footer','products'];

// Token de autenticação — deve ser igual ao definido no index.html
define('AEX_TOKEN', 'aex-admin-tk-2024');

$type = isset($_GET['type']) ? trim($_GET['type']) : '';

if (!in_array($type, $ALLOWED, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Tipo inválido']);
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$file = $dataDir . '/' . $type . '.json';

// ── GET: retorna dados salvos ─────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($file)) {
        echo file_get_contents($file);
    } else {
        echo 'null'; // nenhum dado salvo ainda → JS usa localStorage/defaults
    }
    exit;
}

// ── POST: salva dados ─────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Verifica token
    $token = isset($_SERVER['HTTP_X_AEX_TOKEN']) ? $_SERVER['HTTP_X_AEX_TOKEN'] : '';
    if ($token !== AEX_TOKEN) {
        http_response_code(403);
        echo json_encode(['error' => 'Não autorizado']);
        exit;
    }

    $body = file_get_contents('php://input');
    if ($body === '' || $body === false) {
        http_response_code(400);
        echo json_encode(['error' => 'Corpo vazio']);
        exit;
    }

    // Valida que é JSON válido
    json_decode($body);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON inválido']);
        exit;
    }

    // Salva o arquivo (cria backup automático antes de sobrescrever)
    if (file_exists($file)) {
        copy($file, $file . '.bak');
    }

    if (file_put_contents($file, $body, LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Falha ao salvar']);
        exit;
    }

    echo json_encode(['ok' => true]);
    exit;
}

// DELETE: limpa dado específico (reset)
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $token = isset($_SERVER['HTTP_X_AEX_TOKEN']) ? $_SERVER['HTTP_X_AEX_TOKEN'] : '';
    if ($token !== AEX_TOKEN) {
        http_response_code(403);
        echo json_encode(['error' => 'Não autorizado']);
        exit;
    }
    if (file_exists($file)) {
        unlink($file);
    }
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método não permitido']);
