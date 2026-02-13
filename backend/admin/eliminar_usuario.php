<?php

$origenPermitido = 'http://localhost:3000';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$raw   = file_get_contents("php://input");
$input = $raw ? json_decode($raw, true) : $_POST;

$id = isset($input['id']) ? intval($input['id']) : 0;
if ($id <= 0) { echo json_encode(['success'=>false,'error'=>'ID inválido']); exit; }

$server = "192.168.0.174"; $user="sa"; $pass="P@ssw0rd"; $db="SAP_PROCESOS";
$conn = mssql_connect($server, $user, $pass);
if (!$conn) { echo json_encode(['success'=>false,'error'=>'No se pudo conectar']); exit; }
mssql_select_db($db, $conn);


mssql_query("BEGIN TRAN", $conn);

$ok1 = mssql_query("DELETE FROM usuario_local WHERE usuario_id = {$id}", $conn);
$ok2 = mssql_query("DELETE FROM usuario_rol   WHERE usuario_id = {$id}", $conn);
$ok3 = mssql_query("DELETE FROM usuarios      WHERE id = {$id}", $conn);

if ($ok1 && $ok2 && $ok3) {
  mssql_query("COMMIT TRAN", $conn);
  echo json_encode(['success'=>true]);
} else {
  mssql_query("ROLLBACK TRAN", $conn);
  echo json_encode(['success'=>false,'error'=>'No se pudo eliminar']);
}
