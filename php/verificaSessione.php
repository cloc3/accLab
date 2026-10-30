<?php
header('Content-Type: application/json');
ini_set('display_errors', 0);
error_reporting(E_ALL);

try {
    include $_SERVER['DOCUMENT_ROOT'].'/var/lib/dbConnect2.php';
    $conn = new dbConnect('accLab');
    $link = $conn->link;

    $sessionId = $_GET['user'] ?? '';

    if (empty($sessionId)) {
        throw new Exception("Nessun nome sessione specificato.");
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    // Verifichiamo se la sessione esiste nella tabella padre
    $query = "
    SELECT 1 FROM configurazioni_grafiche WHERE session_id = ?
    UNION
    SELECT 1 FROM misure_esperimento WHERE session_id = ?
    LIMIT 1";

    //$stmt = $link->prepare($query);
    $stmt = $link->prepare("SELECT session_id FROM misure_esperimento WHERE session_id = ? LIMIT 1");
    $stmt->bind_param("s", $sessionId);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {
        echo json_encode([
            'status' => 'ok',
            'exists' => true,
            'session_id' => $sessionId
        ]);
    } else {
        echo json_encode([
            'status' => 'ok',
            'exists' => false,
            'message' => 'Sessione non trovata nel database.'
        ]);
    }

    $stmt->close();

} catch (Exception $e) {
    http_response_code(200);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
