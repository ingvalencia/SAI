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

$cia = isset($_GET['cia']) ? trim($_GET['cia']) : null;
$empleado = isset($_GET['empleado']) ? trim($_GET['empleado']) : null;

if (!$cia || !$empleado) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros']);
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

// ID de usuario
$sqlUsuario = "SELECT id FROM usuarios WHERE empleado = '$empleado'";
$resUsuario = @mssql_query($sqlUsuario, $conn);
if (!$resUsuario || !mssql_num_rows($resUsuario)) {
  echo json_encode(['success' => false, 'error' => 'Empleado no encontrado']);
  exit;
}
$rowUsuario = mssql_fetch_assoc($resUsuario);
$usuarioId = $rowUsuario['id'];

// almacenes permitidos
$sql = "SELECT local_codigo FROM usuario_local WHERE usuario_id = $usuarioId AND cia = '$cia' AND activo = 1";
$res = @mssql_query($sql, $conn);
if (!$res) {
  echo json_encode(['success' => false, 'error' => 'Error al consultar almacenes asignados']);
  exit;
}

$almacenesPermitidos = [];
while ($row = mssql_fetch_assoc($res)) {
  $almacenesPermitidos[] = trim($row['local_codigo']);
}

// catálogo completo
$sqlSP = "EXEC [dbo].[USP_ALMACENES_SAP_CIAS] '$cia'";
$resSP = @mssql_query($sqlSP, $conn);
if (!$resSP) {
  echo json_encode(['success' => false, 'error' => 'Error al ejecutar SP: ' . mssql_get_last_message()]);
  exit;
}

$data = [];
while ($row = mssql_fetch_assoc($resSP)) {
  $codigo = trim($row['Codigo Almacen']);
  if (in_array($codigo, $almacenesPermitidos)) {
    $data[] = [
      'codigo' => utf8_encode($codigo),
      'nombre' => utf8_encode($row['Nombre'])
    ];
  }
}

echo json_encode(['success' => true, 'data' => $data]);
exit;
