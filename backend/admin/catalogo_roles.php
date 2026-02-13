<?php

$origenPermitido = 'http://localhost:3000';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";
$conn   = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'No se pudo conectar a la BD']);
  exit;
}
mssql_select_db($db, $conn);

$sql = "SELECT id, nombre FROM roles ORDER BY id";
$res = mssql_query($sql, $conn);

if (!$res) {
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $data[] = [
    'id'     => (int)$row['id'],
    'nombre' => $row['nombre'],
  ];
}

echo json_encode(['success' => true, 'data' => $data]);
exit;
