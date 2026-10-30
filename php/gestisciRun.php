<?php
// php/gestisciRun.php

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
try {
  include_once $_SERVER['DOCUMENT_ROOT'].'/var/lib/dbConnect2.php';

  $conn = new dbConnect('accLab');
  $link = $conn->link;

  $rawInput = file_get_contents('php://input');
  $data = json_decode($rawInput, true);

  if (!$data || !isset($data['azione'])) {
    echo json_encode(['status' => 'error', 'message' => 'Parametri mancanti']);
    exit;
  }

  $azione   = $link->real_escape_string($data['azione']);
  $sessione = isset($data['session_id']) ? trim($data['session_id']) : '';

  // Estrazione ID numerici
  $ids = [];
  if (isset($data['ids']) && is_array($data['ids'])) {
    $ids = array_map('intval', $data['ids']);
  } elseif (isset($data['id'])) {
    $ids[] = intval($data['id']);
  }

  if (empty($ids)) {
    echo json_encode(['status' => 'error', 'message' => 'Nessun ID valido selezionato']);
    exit;
  }

  $listaIds = implode(',', $ids);

  // Mappatura Eventi SSE: 
  // 2 = rimuovi_dati, 3 = modifica_nota, 4 = modifica_stato
  $idEvento = null;

  if ($azione === 'modifica_nota') {
    $nota = isset($data['note']) ? $link->real_escape_string(trim($data['note'])) : '';
    $sql = "UPDATE misure_esperimento SET note = '$nota' WHERE id IN ($listaIds)";
    $idEvento = 3; 

    // Inversione stato eseguita dal pulsante di gruppo nell'interfaccia HTML
  } elseif ($azione === 'toggle') {
    $sql = "UPDATE misure_esperimento 
      SET esclusa = CASE WHEN COALESCE(esclusa, 0) = 1 THEN 0 ELSE 1 END 
      WHERE id IN ($listaIds)";
    $idEvento = 4;

  } elseif ($azione === 'escludi') {
    $sql = "UPDATE misure_esperimento SET esclusa = 1 WHERE id IN ($listaIds)";
    $idEvento = 4;

  } elseif ($azione === 'includi') {
    error_log("listaIds: " . $listaIds,0);
    $sql = "UPDATE misure_esperimento SET esclusa = 0 WHERE id IN ($listaIds)";
    $idEvento = 4;

  } elseif ($azione === 'rimuovi_dati') {
    $sql = "DELETE FROM misure_esperimento WHERE id IN ($listaIds)";
    $idEvento = 2;

  } else {
    echo json_encode(['status' => 'error', 'message' => 'Azione non riconosciuta: ' . $azione]);
    exit;
  }

  // Esecuzione query principale
  if ($link->query($sql)) {

    // Scrittura su liveData per notifica SSE ai client connessi
    if (!empty($sessione) && $idEvento !== null) {

      $payloadJson = json_encode([
        'id'     => $idEvento,
        'record' => $ids
      ]);

      $stmtLive = $link->prepare("
        INSERT INTO liveData (session_id, dati_evento, timestamp)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE dati_evento = ?, timestamp = NOW()
      ");

      if ($stmtLive) {
        $stmtLive->bind_param("sss", $sessione, $payloadJson, $payloadJson);
        $stmtLive->execute();
        $stmtLive->close();
      }
    }

    echo json_encode([
      'status' => 'ok',
      'righeModificate' => $link->affected_rows
    ]);
    $sql = "UPDATE liveData SET id = id +1 WHERE session_id = ?";
    $stmt=$link->prepare($sql);
    $stmt->bind_param("s",$data['session_id']);
    $stmt->execute();
    $stmt->close();

  } else {
    echo json_encode(['status' => 'error', 'message' => 'Errore MySQL: ' . $link->error]);
  }

} catch (Throwable $e) {
  echo json_encode(['status' => 'error', 'message' => 'Eccezione PHP: ' . $e->getMessage()]);
}
