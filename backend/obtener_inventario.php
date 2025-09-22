<?php
header('Content-Type: application/json');

// CORS
$origenPermitido = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

// ====================
// Parámetros requeridos
// ====================
$almacen  = isset($_GET['almacen'])  ? $_GET['almacen']  : null;
$fecha    = isset($_GET['fecha'])    ? $_GET['fecha']    : null;
$empleado = isset($_GET['empleado']) ? $_GET['empleado'] : null;
$estatus  = isset($_GET['estatus'])  ? intval($_GET['estatus']) : 1;  // ✅ importante
$cia      = isset($_GET['cia'])      ? $_GET['cia'] : null;

if (!$almacen || !$fecha || !$empleado || !$cia) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
  exit;
}

// ====================
// Conexión SQL Server
// ====================
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

// ====================
// Consulta usando estatus del GET
// ====================
$sql = "
  SELECT *
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen'
    AND fecha_inv = '$fecha'
    AND usuario = '$empleado'
    AND estatus = $estatus
    AND cias = '$cia'
";

$res = mssql_query($sql, $conn);

if (!$res) {
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $data[] = array_map('utf8_encode', $row);
}

echo json_encode([
  'success' => true,
  'data'    => $data
]);
exit;
