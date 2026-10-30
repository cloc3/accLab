<?php
header('Content-Type: application/json');
include $_SERVER['DOCUMENT_ROOT'].'/var/lib/dbConnect2.php';

$conn = new dbConnect('accLab');
$link = $conn->link;

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || empty($data['session_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Session ID mancante']);
    exit;
}

// Sanificazione e preparazione dei dati
$sessionId     = $link->real_escape_string($data['session_id']);
$bgPagina      = $link->real_escape_string($data['bg_pagina']);
$bgHeader      = $link->real_escape_string($data['bg_header']);
$bgCard        = $link->real_escape_string($data['bg_card']);
$spazioDs      = floatval($data['spazio_ds']);
$timeoutSec    = intval($data['timeout_sec']);
$statoIniziale = intval($data['stato_iniziale']);

// Inserimento o aggiornamento configurazione (senza nickname)
$query = "INSERT INTO configurazioni_grafiche 
          (session_id, bg_pagina, bg_header, bg_card, spazio_ds, timeout_sec, stato_iniziale) 
          VALUES 
          ('$sessionId', '$bgPagina', '$bgHeader', '$bgCard', $spazioDs, $timeoutSec, $statoIniziale)
          ON DUPLICATE KEY UPDATE 
            bg_pagina = VALUES(bg_pagina),
            bg_header = VALUES(bg_header),
            bg_card = VALUES(bg_card),
            spazio_ds = VALUES(spazio_ds),
            timeout_sec = VALUES(timeout_sec),
            stato_iniziale = VALUES(stato_iniziale)";

if ($link->query($query)) {
    echo json_encode(['status' => 'ok']);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Errore nel salvataggio del database.']);
}
