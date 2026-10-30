<?php
// php/streamLive.php

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); 

// 1. Generazione firma univoca per questa istanza di connessione/sessione
set_time_limit(0);
include $_SERVER['DOCUMENT_ROOT'].'/var/lib/dbConnect2.php';
$conn = new dbConnect('accLab');
$link = $conn->link;

$sessione = isset($_GET['sessione']) ? trim($_GET['sessione']) : '';
$firmaClient = isset($_GET['firmaSSE']) ? trim($_GET['firmaSSE']) : '';

// 1. VERIFICA PREVENTIVA SESSIONE
if (!empty($sessione)) {
  $stmtCheckSession = $link->prepare("SELECT COUNT(*) FROM misure_esperimento WHERE session_id = ?");
  $stmtCheckSession->bind_param("s", $sessione);
  $stmtCheckSession->execute();
  $resCheck = $stmtCheckSession->get_result();
  $row = $resCheck->fetch_row();
  $stmtCheckSession->close();

  if ($row[0] == 0) {
    echo "event: error\n";
    echo 'data: ' . json_encode(['message' => 'Sessione non trovata']) . "\n\n";
    ob_flush();
    flush();
    exit();
  }
}

// Ping iniziale di connessione SSE
echo "event: ping\n";
echo 'data: ' . json_encode([
  'status' => 'connected',
  'timestamp' => time(),
  'firma' => $firmaClient
]) . "\n\n";
ob_flush();
flush();


// 2. PREPARAZIONE DEGLI STATEMENT E MAPPE EVENTI

$lista_eventi = [
  0 => "nuova_misura",
  1 => "salva_run",
  2 => "rimuovi_dati",
  3 => "modifica_nota",
  4 => "modifica_stato"
];

$ultimoIdTrasmesso = 0;

// Query principale di ascolto eventi
$stmtLive = $link->prepare("
    SELECT id, dati_evento, firmaSSE, UNIX_TIMESTAMP(timestamp) as ts_unix 
    FROM liveData
    WHERE session_id = ? AND id > ? AND timestamp >= FROM_UNIXTIME(?)
");

// --- INIZIALIZZAZIONE ARRAY STATEMENTS PRE-COMPILATI ---
$stmtDettaglio = [];

// [0] nuova_misura
$stmtDettaglio[0] = $link->prepare("
    SELECT * FROM liveData WHERE session_id = ? AND id = ?
");

// [1] salva_run
$stmtDettaglio[1] = $link->prepare("
    SELECT * FROM misure_esperimento WHERE session_id = ? AND FIND_IN_SET(id, ?)
");

// [2] rimuovi_dati (nessuna query sul DB)
$stmtDettaglio[2] = null;

// [3] modifica_nota
$stmtDettaglio[3] = $link->prepare("
    SELECT id, note FROM misure_esperimento WHERE session_id = ? AND FIND_IN_SET(id, ?)
");

// [4] modifica_stato
$stmtDettaglio[4] = $link->prepare("
    SELECT id, esclusa FROM misure_esperimento WHERE session_id = ? AND FIND_IN_SET(id, ?)
");

// 3. CICLO DI MONITORAGGIO SSE
while (true) {
  if (connection_aborted()) {
    break;
  }

  $link->query("COMMIT");

  if (!empty($sessione)) {
    $limiteTempo = time() - 5;

    $stmtLive->bind_param("sii", $sessione, $ultimoIdTrasmesso, $limiteTempo);
    $stmtLive->execute();
    $resCheck = $stmtLive->get_result();

    if ($liveRecord = $resCheck->fetch_assoc()) {
      $ultimoIdTrasmesso = $liveRecord['id'];
      $idRecordLive     = $liveRecord['id'];
      $firmaSseRecord   = $liveRecord['firmaSSE'] ?? null;

      $infoEvento = json_decode($liveRecord['dati_evento'] ?? '{}', true);
      $idEvento  = isset($infoEvento['id']) ? (int)$infoEvento['id'] : 0;
      $idsTarget = isset($infoEvento['record']) && is_array($infoEvento['record']) 
        ? array_map('intval', $infoEvento['record']) 
        : [];

      // 1. GESTIONE SPECIALIZZATA SE IL CLIENT È L'AUTORE DELL'AZIONE (Firme coincidenti)
      if (!empty($firmaClient) && $firmaSseRecord === $firmaClient) {

        if ($idEvento === 0) {
          // Caso 0: ACK personalizzato per la nuova misura
          echo "event: nuova_misura_inviata\n";
          echo 'data: ' . json_encode([
            'status'  => 'ok',
            'message' => 'Evento nuova_misura gestito correttamente'
          ]) . "\n\n";
          ob_flush();
          flush();
          continue; // Interrompe qui solo per il caso 0

        } elseif ($idEvento === 2) {
          // Caso 2: ACK personalizzato per la rimozione dati
          echo "event: rimuovi_dati_inviata\n";
          echo 'data: ' . json_encode([
            'status'      => 'ok',
            'ids_rimossi' => $idsTarget
          ]) . "\n\n";
          ob_flush();
          flush();
          continue; // Interrompe qui solo per il caso 2
        }

        // NOTA: Se $idEvento è 3, 4 o altro, NON fa continue ed esegue il flusso sotto!
      }

      // 2. ESECUZIONE STANDARD DISSOCIATA DALLE FIRME (Client Passivi + Eventi 3, 4 dell'autore)
      $datiDettaglio = null;

      switch ($idEvento) {

      case 0: // nuova_misura (Client Passivi)
        $stmtDettaglio[0]->bind_param("si", $sessione, $idRecordLive);
        $stmtDettaglio[0]->execute();
        $res = $stmtDettaglio[0]->get_result();
        if ($r = $res->fetch_assoc()) {
          if (isset($r['esclusa'])) {
            $r['esclusa'] = (int)$r['esclusa'];
          }
          $datiDettaglio = $r;
        }
        break;

      case 2: // rimuovi_dati (Client Passivi)
        $datiDettaglio = [
          'ids_rimossi' => $idsTarget
        ];
        break;

      case 1: // salva_run
      case 3: // modifica_nota
      case 4: // modifica_stato
      default:
      if (isset($stmtDettaglio[$idEvento]) && $stmtDettaglio[$idEvento] !== null) {
        $targetStr = implode(',', $idsTarget);
        $stmtDettaglio[$idEvento]->bind_param("ss", $sessione, $targetStr);
        $stmtDettaglio[$idEvento]->execute();
        $res = $stmtDettaglio[$idEvento]->get_result();

        $datiDettaglio = [];
        while ($r = $res->fetch_assoc()) {
          if (isset($r['esclusa'])) {
            $r['esclusa'] = (int)$r['esclusa'];
          }
          $datiDettaglio[] = $r;
        }
      }
      break;
      }

      // 3. TRASMISSIONE EVENTO SSE COMPLETO
      $nomeEvento = $lista_eventi[$idEvento] ?? "nuova_misura";

      echo "event: {$nomeEvento}\n";
      echo "data: " . json_encode($datiDettaglio) . "\n\n";
      ob_flush();
      flush();
    }
  }

  echo ": keepalive\n\n";
  ob_flush();
  flush();

  usleep(500000);
}

// 4. PULIZIA RISORSE
$stmtLive->close();
foreach ($stmtDettaglio as $stmt) {
  if ($stmt !== null) {
    $stmt->close();
  }
}
$link->close();
