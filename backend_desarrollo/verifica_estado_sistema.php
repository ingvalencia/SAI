<?php
header('Content-Type: application/json; charset=utf-8');

$origen = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

$origenesPermitidos = array(
  'http://localhost:3000',
  'https://diniz.com.mx',
  'http://diniz.com.mx'
);

if (in_array($origen, $origenesPermitidos)) {
  header('Access-Control-Allow-Origin: ' . $origen);
  header('Access-Control-Allow-Credentials: true');
} else {
  header('Access-Control-Allow-Origin: https://diniz.com.mx');
  header('Access-Control-Allow-Credentials: true');
}

header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

function responder($data) {
  echo json_encode($data);
  exit;
}

$empleado_raw = isset($_GET['empleado']) ? trim($_GET['empleado']) : '';

if ($empleado_raw === '' || $empleado_raw === '0000' || intval($empleado_raw) <= 0) {
  responder(array(
    'success' => true,
    'habilitado' => 1,
    'mensaje' => 'Empleado no válido, acceso permitido por seguridad operativa'
  ));
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "LOGS_CONTROL";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  responder(array(
    'success' => true,
    'habilitado' => 1,
    'mensaje' => 'No se pudo conectar a LOGS_CONTROL, acceso permitido por seguridad operativa'
  ));
}

if (!mssql_select_db($db, $conn)) {
  responder(array(
    'success' => true,
    'habilitado' => 1,
    'mensaje' => 'No se pudo seleccionar LOGS_CONTROL, acceso permitido por seguridad operativa'
  ));
}

$sql = "
  SELECT
    ISNULL(habilitado, 1) AS habilitado
  FROM Sistemas
  WHERE sistema_id = 3
";

$res = mssql_query($sql, $conn);

if (!$res) {
  responder(array(
    'success' => true,
    'habilitado' => 1,
    'mensaje' => 'Error consultando estado del sistema, acceso permitido por seguridad operativa',
    'detalle' => mssql_get_last_message()
  ));
}

$row = mssql_fetch_assoc($res);

if (!$row) {
  responder(array(
    'success' => true,
    'habilitado' => 1,
    'mensaje' => 'Sistema no configurado, acceso permitido por seguridad operativa'
  ));
}

$habilitado = intval($row['habilitado']);

responder(array(
  'success' => true,
  'habilitado' => $habilitado
));
