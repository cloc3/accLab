<?php
// php/salvaMisura.php

header('Content-Type: application/json');
ini_set('display_errors', 0);
error_reporting(E_ALL);

try {
  // 1. Inclusione connessione secondo il modello di progetto
  include $_SERVER['DOCUMENT_ROOT'].'/var/lib/dbConnect2.php';
  $conn = new dbConnect('accLab');
  $link = $conn->link; // Oggetto mysqli gestito dalla classe custom

  // 2. Lettura dati JSON da JS
  $json = file_get_contents('php://input');
  $data = json_decode($json, true);

  if (!$data || empty($data['session_id'])) {
    throw new Exception("Dati non validi o nome sessione mancante.");
  }

  $sessionId = $data['session_id'];

  // Abilita la gestione automatica eccezioni su mysqli
  mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

  // 3. STEP PADRE: Assicura che la sessione sia presente in configurazioni_grafiche
  $stmtPadre = $link->prepare("INSERT IGNORE INTO configurazioni_grafiche (session_id) VALUES (?)");
  $stmtPadre->bind_param("s", $sessionId);
  $stmtPadre->execute();
  $stmtPadre->close();

  $stmtMax = $link->prepare("SELECT COALESCE(MAX(run_numero), 0) FROM misure_esperimento WHERE session_id = ?");
  $stmtMax->bind_param("s", $sessionId);
  $stmtMax->execute();
  $stmtMax->bind_result($maxRunEsistente);
  $stmtMax->fetch();
  $stmtMax->close();

  $runNumeroDinamico = $maxRunEsistente + 1;

  // 4. STEP FIGLIO: Inserisce la misurazione collegata
  $sqlFiglio = "INSERT INTO misure_esperimento 
    (session_id, run_numero, dt1, dt_gap, dt2, dt_tot, spazio_ds, v1, v_gap, v2, v_media, a12, a23, a13, a_min_quad) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

  $stmtFiglio = $link->prepare($sqlFiglio);

  // Stringa di tipo di 15 caratteri: "siidddddddddddd"
  $stmtFiglio->bind_param(
    "siidddddddddddd", 
    $sessionId,
    $runNumeroDinamico,
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
    $data['a_min_quad']
  );

  $stmtFiglio->execute();
  $insertId = $stmtFiglio->insert_id;
  $stmtFiglio->close();

  // 5. NOTIFICA EVENTO SU liveData (id_evento = 1: salva_run)
  $payloadJson = json_encode([
    'id'     => 1,
    'record' => [$insertId]
  ]);

  $stmtLive = $link->prepare("
        INSERT INTO liveData (session_id, dati_evento, timestamp)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE dati_evento = ?, timestamp = NOW()
    ");
    $stmtLive->bind_param("sss", $sessionId, $payloadJson, $payloadJson);
    $stmtLive->execute();
    $stmtLive->close();
    $sqlUpd = "UPDATE liveData SET id = id +1 WHERE session_id = ?";
    $stmtUpd=$link->prepare($sqlUpd);
    $stmtUpd->bind_param("s",$data['session_id']);
    $stmtUpd->execute();
    $stmtUpd->close();

    // Risposta positiva inviata a JavaScript con il numero di run effettivo
    echo json_encode([
        'status'     => 'ok',
        'id'         => $insertId,
        'run_numero' => $runNumeroDinamico,
        'message'    => 'Misura salvata correttamente!'
    ]);

} catch (Exception $e) {
    http_response_code(200);
    echo json_encode([
        'status'  => 'error',
        'message' => "Errore durante il salvataggio: " . $e->getMessage()
    ]);
}
