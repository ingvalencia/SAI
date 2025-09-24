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

$empleado = isset($_GET['empleado']) ? trim($_GET['empleado']) : null;

if (!$empleado) {
  echo json_encode(['success' => false, 'error' => 'Falta parámetro empleado']);
  exit;
}

// Conexión
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

// Obtener ID de usuario
$sqlUsuario = "SELECT id FROM usuarios WHERE empleado = '$empleado'";
$resUsuario = @mssql_query($sqlUsuario, $conn);

if (!$resUsuario || !mssql_num_rows($resUsuario)) {
  echo json_encode(['success' => false, 'error' => 'Empleado no encontrado']);
  exit;
}

$rowUsuario = mssql_fetch_assoc($resUsuario);
$usuarioId = $rowUsuario['id'];

// Obtener CIAs únicas del usuario activo
$sql = "SELECT DISTINCT cia FROM usuario_local WHERE usuario_id = $usuarioId AND activo = 1";
$res = @mssql_query($sql, $conn);

if (!$res) {
  echo json_encode(['success' => false, 'error' => 'Error al consultar CIAs']);
  exit;
}

$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $data[] = utf8_encode($row['cia']);
}

echo json_encode(['success' => true, 'data' => $data]);
exit;
