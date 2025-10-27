<?php
header('Content-Type: application/json');

/* ============================
   CONFIGURACIÓN DE CORS
   ============================ */
$origenPermitido = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

/* ============================
   LECTURA DE PARÁMETROS
   ============================ */
$input = file_get_contents("php://input");
$data = json_decode($input, true);
if (!$data) $data = $_POST;

$usuario_id = isset($data['usuario_id']) ? intval($data['usuario_id']) : null;

if (!$usuario_id) {
  echo json_encode(['success' => false, 'error' => 'Falta el parámetro usuario_id']);
  exit;
}

/* ============================
   CONEXIÓN MSSQL
   ============================ */
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

/* ============================
   EJECUCIÓN DEL SP
   ============================ */
$sql = "
  EXEC dbo.USP_VERIFICAR_ASIGNACION_USUARIO @usuario_id = $usuario_id;
";

$res = mssql_query($sql, $conn);
if (!$res) {
  error_log('Error SQL SP VERIFICAR_ASIGNACION_USUARIO: ' . mssql_get_last_message());
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

/* ============================
   PROCESAR RESULTADO
   ============================ */
if (mssql_num_rows($res) === 0) {
  echo json_encode([
    'success' => true,
    'asignacion' => null,
    'mensaje' => 'El usuario no tiene asignación activa'
  ]);
  exit;
}

$row = mssql_fetch_assoc($res);

echo json_encode([
  'success' => true,
  'mensaje' => 'Asignación obtenida correctamente',
  'asignacion' => [
    'id_config'  => intval($row['id']),
    'tipo_conteo'=> $row['tipo_conteo'],
    'nro_conteo' => intval($row['nro_conteo']),
    'cia'        => $row['cia'],
    'almacen'    => $row['almacen'],
    'fecha'      => $row['fecha_asignacion'],
    'estatus'    => intval($row['estatus'])
  ]
]);
exit;
?>
