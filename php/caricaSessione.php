<?php
header('Content-Type: application/json');
include $_SERVER['DOCUMENT_ROOT'].'/var/lib/dbConnect2.php';

$conn = new dbConnect('accLab');
$link = $conn->link;

$sessionId = isset($_GET['sessione']) ? $link->real_escape_string($_GET['sessione']) : '';

if (empty($sessionId)) {
    echo json_encode(['status' => 'error', 'message' => 'Session ID non fornito']);
    exit;
}

// 1. Lettura configurazione (Parametri + Colori)
$resConfig = $link->query("SELECT bg_pagina, bg_header, bg_card, spazio_ds, timeout_sec, stato_iniziale, ultimo_aggiornamento FROM configurazioni_grafiche WHERE session_id = '$sessionId'");
$config = $resConfig ? $resConfig->fetch_assoc() : null;

// 2. Lettura misure storiche
$resMisure = $link->query("SELECT * FROM misure_esperimento WHERE session_id = '$sessionId' ORDER BY run_numero ASC");
$misure = [];
if ($resMisure) {
    while ($row = $resMisure->fetch_assoc()) {
        $misure[] = $row;
    }
}

// 3. Risposta JSON strutturata nei 3 blocchi puliti
echo json_encode([
    'status' => 'ok',
    'metadati' => [
        'session_id' => $sessionId,
        'ultimo_aggiornamento' => $config['ultimo_aggiornamento'] ?? date('Y-m-d H:i:s')
    ],
    'parametri' => [
        'spazio_ds'     => $config['spazio_ds']     ?? "10",
        'timeout_sec'   => $config['timeout_sec']   ?? "4",
        'stato_iniziale' => $config['stato_iniziale'] ?? "0"
    ],
    'colori' => [
        'bg_pagina' => $config['bg_pagina'] ?? "#ffffe0",
        'bg_header' => $config['bg_header'] ?? "#ffe4b5",
        'bg_card'   => $config['bg_card']   ?? "#111827"
    ],
    'misure' => $misure
], JSON_PRETTY_PRINT);
