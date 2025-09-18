<?php
header('Content-Type: application/json');

// Permitir CORS igual que en el otro script
$origenPermitido = 'http://localhost:3000';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

// ==============================
// 1. Parámetros
// ==============================
$almacen  = isset($_POST['almacen'])  ? addslashes($_POST['almacen'])  : null;
$fecha    = isset($_POST['fecha'])    ? addslashes($_POST['fecha'])    : null;
$empleado = isset($_POST['empleado']) ? addslashes($_POST['empleado']) : null;
$estatus  = isset($_POST['estatus'])  ? addslashes($_POST['estatus'])  : null;

if (!$almacen || !$fecha || !$empleado || $estatus === null) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
  exit;
}

// ==============================
// 2. Conexión
// ==============================
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

// ==============================
// 3. Update en CAP_INVENTARIO
// ==============================
$sql = "
  UPDATE CAP_INVENTARIO
  SET estatus = '$estatus'
  WHERE almacen   = '$almacen'
    AND fecha_inv = '$fecha'
    AND usuario   = '$empleado'
";

$res = mssql_query($sql, $conn);

if (!$res) {
  $err = mssql_get_last_message();
  echo json_encode(['success' => false, 'error' => "Error al actualizar estatus: $err"]);
  exit;
}

// ==============================
// 4. Respuesta
// ==============================
echo json_encode([
  'success' => true,
  'mensaje' => "Estatus actualizado a $estatus para $almacen ($empleado)"
]);
exit;
