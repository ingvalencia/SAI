<?php
$origenPermitido = 'http://localhost:3000';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

session_name('SAI_SES');
session_start();

$raw = file_get_contents("php://input");
$input = $raw ? json_decode($raw, true) : $_POST;

$empleado = isset($input['empleado']) ? trim($input['empleado']) : null;
$tokenSesion = isset($input['token_sesion']) ? trim($input['token_sesion']) : null;

if (!$empleado || !$tokenSesion) {
  echo json_encode([
    'success' => false,
    'sesion_valida' => false,
    'error' => 'Faltan datos de sesión'
  ]);
  exit;
}

if (!is_numeric($empleado)) {
  echo json_encode([
    'success' => false,
    'sesion_valida' => false,
    'error' => 'Empleado inválido'
  ]);
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "LOGS_CONTROL";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  echo json_encode([
    'success' => false,
    'sesion_valida' => false,
    'error' => 'No se pudo conectar a la BD'
  ]);
  exit;
}

if (!mssql_select_db($db, $conn)) {
  echo json_encode([
    'success' => false,
    'sesion_valida' => false,
    'error' => 'No se pudo seleccionar la BD'
  ]);
  exit;
}

$empleado = intval($empleado);
$tokenSesionEsc = str_replace("'", "''", $tokenSesion);

$sql = "
  SELECT TOP 1 id_sesion
  FROM dbo.SESIONES_SICAF
  WHERE empleado = {$empleado}
    AND token_sesion = '{$tokenSesionEsc}'
    AND activa = 1
";

$res = mssql_query($sql, $conn);

if (!$res) {
  echo json_encode([
    'success' => false,
    'sesion_valida' => false,
    'error' => 'Error al validar sesión'
  ]);
  exit;
}

if (mssql_num_rows($res) === 0) {
  echo json_encode([
    'success' => true,
    'sesion_valida' => false,
    'error' => 'Sesión cerrada por nuevo inicio'
  ]);
  exit;
}

$sqlPing = "
  UPDATE dbo.SESIONES_SICAF
  SET fecha_ultimo_ping = GETDATE()
  WHERE empleado = {$empleado}
    AND token_sesion = '{$tokenSesionEsc}'
    AND activa = 1
";

mssql_query($sqlPing, $conn);

echo json_encode([
  'success' => true,
  'sesion_valida' => true
]);

mssql_close($conn);
exit;
?>
