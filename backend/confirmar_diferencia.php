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

// ============================
// Parámetros
// ============================
$almacen  = isset($_POST['almacen']) ? $_POST['almacen'] : null;
$fecha    = isset($_POST['fecha'])   ? $_POST['fecha']   : null;
$empleado = isset($_POST['empleado']) ? intval($_POST['empleado']) : null;

if (!$almacen || !$fecha || !$empleado) {
  echo json_encode(['success' => false, 'error' => 'Datos incompletos o inválidos']);
  exit;
}

// ============================
// Conexión
// ============================
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
// Verificar que existan registros capturados
// ============================
$check = mssql_query("
  SELECT COUNT(*) AS total
  FROM CAP_INVENTARIO
  WHERE almacen = '" . addslashes($almacen) . "'
    AND fecha_inv = '" . addslashes($fecha) . "'
    AND usuario = $empleado
", $conn);

$row = mssql_fetch_assoc($check);
if (!$row || $row['total'] == 0) {
  echo json_encode(['success' => false, 'error' => 'No hay registros para este usuario']);
  exit;
}

// ============================
// Actualizar estatus a 4 (diferencias confirmadas / proceso finalizado)
// ============================
$update = mssql_query("
  UPDATE CAP_INVENTARIO
  SET estatus = 4
  WHERE almacen = '" . addslashes($almacen) . "'
    AND fecha_inv = '" . addslashes($fecha) . "'
    AND usuario = $empleado
", $conn);

if (!$update) {
  echo json_encode(['success' => false, 'error' => 'Error al actualizar estatus a 4']);
  exit;
}

// ============================
// Respuesta
// ============================
echo json_encode([
  'success' => true,
  'mensaje' => 'Diferencias confirmadas correctamente. Proceso finalizado.',
  'estatus' => 4
]);
exit;
