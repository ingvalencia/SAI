<?php
header('Content-Type: application/json');

// Permitir CORS si usas React local
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
$almacen   = isset($_POST['almacen'])   ? $_POST['almacen']   : null;
$fecha     = isset($_POST['fecha'])     ? $_POST['fecha']     : null;
$cia       = isset($_POST['cia'])       ? $_POST['cia']       : null;
$empleado  = isset($_POST['empleado'])  ? intval($_POST['empleado']) : null;
$itemCode  = isset($_POST['ItemCode'])  ? $_POST['ItemCode']  : null;
$cantidad  = isset($_POST['cant_invfis']) ? $_POST['cant_invfis'] : null;

if (!$almacen || !$fecha || !$cia || !$empleado || !$itemCode || $cantidad === null) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
  exit;
}

// Sanitizar
$almacen  = addslashes($almacen);
$fecha    = addslashes($fecha);
$cia      = addslashes($cia);
$itemCode = addslashes($itemCode);
$cantidad = floatval($cantidad);

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
  SET cant_invfis = $cantidad,
      usuario = $empleado,
      fecha_carga = GETDATE()
  WHERE almacen   = '$almacen'
    AND fecha_inv = '$fecha'
    AND cias      = '$cia'
    AND ItemCode  = '$itemCode'
";

$res = mssql_query($sql, $conn);

if (!$res) {
  $err = mssql_get_last_message();
  echo json_encode(['success' => false, 'error' => "Error al guardar cantidad: $err"]);
  exit;
}

// ==============================
// 4. Respuesta
// ==============================
echo json_encode([
  'success' => true,
  'mensaje' => "Cantidad actualizada para $itemCode en $almacen ($cia)"
]);
exit;
