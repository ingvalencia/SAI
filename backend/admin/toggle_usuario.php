<?php
// ====== CORS ======
$origenPermitido = 'http://localhost:3000';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ====== INPUT ======
$raw   = file_get_contents("php://input");
$input = $raw ? json_decode($raw, true) : $_POST;

$id     = isset($input['id'])     ? intval($input['id'])     : 0;
$activo = isset($input['activo']) ? intval($input['activo']) : null;

if ($id <= 0 || !in_array($activo, [0,1], true)) {
  echo json_encode(['success' => false, 'error' => 'Parámetros inválidos']); exit;
}

// ====== CONEXIÓN MSSQL ======
$server = "192.168.0.174"; $user="sa"; $pass="P@ssw0rd"; $db="SAP_PROCESOS";
$conn = mssql_connect($server, $user, $pass);
if (!$conn) { echo json_encode(['success'=>false,'error'=>'No se pudo conectar']); exit; }
mssql_select_db($db, $conn);

// ====== UPDATE ======
$sql = "UPDATE usuarios SET activo = {$activo} WHERE id = {$id}";
$ok  = mssql_query($sql, $conn);

if (!$ok) { echo json_encode(['success'=>false,'error'=>'No se pudo actualizar']); exit; }

echo json_encode(['success' => true]);
