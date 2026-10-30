<?php
// php/salvaLiveData.php

header('Content-Type: application/json');
ini_set('display_errors', 0);
error_reporting(E_ALL);

try {
    include_once $_SERVER['DOCUMENT_ROOT'].'/var/lib/dbConnect2.php';
    $conn = new dbConnect('accLab');
    $link = $conn->link;

    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);

    if (!$data || empty($data['session_id'])) {
        echo json_encode(['status' => 'error', 'message' => 'Session ID mancante']);
        exit;
    }

    $payloadEvento = json_encode(['id' => 0]);
    $firmaSSE      = isset($data['firmaSSE']) ? trim($data['firmaSSE']) : null;

    // 1. UPSERT dati misura
    $sql = "INSERT INTO liveData 
        (session_id, dt1, dt_gap, dt2, dt_tot, spazio_ds, v1, v_gap, v2, v_media, a12, a23, a13, a_min_quad, dati_evento, firmaSSE)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            dt1         = VALUES(dt1),
            dt_gap      = VALUES(dt_gap),
            dt2         = VALUES(dt2),
            dt_tot      = VALUES(dt_tot),
            spazio_ds   = VALUES(spazio_ds),
            v1          = VALUES(v1),
            v_gap       = VALUES(v_gap),
            v2          = VALUES(v2),
            v_media     = VALUES(v_media),
            a12         = VALUES(a12),
            a23         = VALUES(a23),
            a13         = VALUES(a13),
            a_min_quad  = VALUES(a_min_quad),
            dati_evento = VALUES(dati_evento),
            firmaSSE    = VALUES(firmaSSE),
            timestamp   = CURRENT_TIMESTAMP()";

    $stmt = $link->prepare($sql);

    if (!$stmt) {
        throw new Exception("Preparazione query fallita: " . $link->error);
    }

    $stmt->bind_param(
        "siiiidddddddddss", 
        $data['session_id'],
        $data['dt1'],
        $data['dt_gap'],
        $data['dt2'],
        $data['dt_tot'],
        $data['spazio_ds'],
        $data['v1'],
        $data['v_gap'],
        $data['v2'],
        $data['v_media'],
        $data['a12'],
        $data['a23'],
        $data['a13'],
        $data['a_min_quad'],
        $payloadEvento,
        $firmaSSE
    );

    $stmt->execute();
    $affectedRows = $stmt->affected_rows;
    $stmt->close();

    // 2. FORZATURA INCREMENTO ID
    // Necessario per consentire la rilevazione "id > ultimoIdTrasmesso" da parte di streamLive.php
    $sqlUpd = "UPDATE liveData SET id = id + 1 WHERE session_id = ?";
    $stmtUpd = $link->prepare($sqlUpd);
    if ($stmtUpd) {
        $stmtUpd->bind_param("s", $data['session_id']);
        $stmtUpd->execute();
        $stmtUpd->close();
    }

    // Risposta inviata al termine di tutte le operazioni SQL
    echo json_encode([
        'status' => 'ok', 
        'affected_rows' => $affectedRows
    ]);

} catch (Throwable $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
