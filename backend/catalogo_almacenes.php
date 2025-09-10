<?php
$origenPermitido = 'http://localhost:3000';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

// Opcional: responder rápido a preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$cia = isset($_GET['cia']) ? trim($_GET['cia']) : null;

if (!$cia) {
  echo json_encode(['success' => false, 'error' => 'Falta parámetro cia']);
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'No se pudo conectar a la base de datos']);
  exit;
}

mssql_select_db($db, $conn);

$sql = "EXEC [dbo].[USP_ALMACENES_SAP_CIAS] '$cia'";
$res = mssql_query($sql, $conn);

if (!$res) {
  echo json_encode(['success' => false, 'error' => 'Error en la consulta: ' . mssql_get_last_message()]);
  exit;
}

$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $data[] = [
    'codigo' => utf8_encode($row['Codigo Almacen']),
    'nombre' => utf8_encode($row['Nombre'])
  ];
}

echo json_encode(['success' => true, 'data' => $data]);
exit;
