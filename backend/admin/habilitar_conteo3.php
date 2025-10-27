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
   LECTURA DE PARÁMETROS (JSON o POST)
   ============================ */
$raw = file_get_contents("php://input");
$data = json_decode($raw, true);
if (!$data) $data = $_POST;

$cia     = isset($data['cia'])     ? trim($data['cia'])     : null;
$almacen = isset($data['almacen']) ? trim($data['almacen']) : null;
$fecha   = isset($data['fecha'])   ? trim($data['fecha'])   : null;
$usuarios = isset($data['usuarios']) ? $data['usuarios']    : [];
$usuario_admin = isset($data['usuario_admin']) ? trim($data['usuario_admin']) : null;

if (!$cia || !$almacen || !$fecha || !$usuario_admin) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos (cia, almacen, fecha, usuario_admin)']);
  exit;
}

/* ============================
   VALIDAR USUARIOS (si hay)
   ============================ */
if (is_array($usuarios)) {
  $usuarios_json = json_encode($usuarios);
} else {
  $usuarios_json = $usuarios;
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
   SANITIZAR
   ============================ */
$cia_safe     = addslashes($cia);
$almacen_safe = addslashes($almacen);
$fecha_safe   = addslashes($fecha);
$usuarios_json_safe = addslashes($usuarios_json);
$usuario_admin_safe = addslashes($usuario_admin);

/* ============================
   EJECUCIÓN DEL SP
   ============================ */
$sql = "
  EXEC dbo.USP_HABILITAR_CONTEO3
      @cia           = '$cia_safe',
      @almacen       = '$almacen_safe',
      @fecha         = '$fecha_safe',
      @usuarios_json = N'$usuarios_json_safe';
";

$res = mssql_query($sql, $conn);

if (!$res) {
  error_log('Error SQL SP HABILITAR_CONTEO3: ' . mssql_get_last_message());
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

/* ============================
   VALIDAR RESULTADOS
   ============================ */
$rows_affected = mssql_rows_affected($conn);

if ($rows_affected > 0) {
  echo json_encode([
    'success' => true,
    'mensaje' => 'Se detectaron diferencias y se creó la configuración de Conteo 3.',
    'accion'  => 'conteo3_creado'
  ]);
} else {
  echo json_encode([
    'success' => true,
    'mensaje' => 'No se detectaron diferencias. No se creó el Conteo 3.',
    'accion'  => 'sin_diferencias'
  ]);
}
exit;
?>

