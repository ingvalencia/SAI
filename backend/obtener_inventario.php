<?php
header('Content-Type: application/json');

// ====================
// CORS
// ====================
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
$almacen  = isset($_GET['almacen'])  ? trim(addslashes($_GET['almacen']))  : null;
$fecha    = isset($_GET['fecha'])    ? trim(addslashes($_GET['fecha']))    : null;
$empleado = isset($_GET['empleado']) ? intval($_GET['empleado'])           : null;
$estatus  = isset($_GET['estatus'])  ? intval($_GET['estatus'])            : 1;
$cia      = isset($_GET['cia'])      ? trim(addslashes($_GET['cia']))      : null;

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

// ============================
// Obtener ID interno del usuario (para brigada)
// ============================
$sqlUser = "SELECT TOP 1 id FROM usuarios WHERE empleado = $empleado";
$resUser = mssql_query($sqlUser, $conn);
$usuario_id = null;
if ($resUser && $rowUser = mssql_fetch_assoc($resUser)) {
  $usuario_id = intval($rowUser['id']);
}

// ============================
// Consulta principal CORREGIDA
// ============================


$sql = "
  SELECT *
  FROM CAP_INVENTARIO
  WHERE almacen   = '$almacen'
    AND fecha_inv = '$fecha'
    AND cias      = '$cia'
    AND usuario   = '$empleado'
    AND estatus   = $estatus
";

$res = mssql_query($sql, $conn);

if (!$res) {
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

// ============================
// Procesar resultados
// ============================
$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $data[] = array_map('utf8_encode', $row);
}

// ============================
// Respuesta final
// ============================
echo json_encode([
  'success' => true,
  'data'    => $data,
  'nro_conteo' => $estatus  // opcional, útil para el front
]);
exit;
?>
