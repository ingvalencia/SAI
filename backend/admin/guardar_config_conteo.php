<?php
header('Content-Type: application/json');

/* ============================
   CORS
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
   LECTURA DE ENTRADA (JSON o POST)
   ============================ */
$raw = file_get_contents("php://input");
$data = null;

if ($raw) {
  $tmp = json_decode($raw, true);
  if (json_last_error() === JSON_ERROR_NONE) {
    $data = $tmp;
  }
}

if (!$data && !empty($_POST)) {
  $data = $_POST;
}

/* ============================
   PARÁMETROS
   ============================ */
$tipo_conteo  = isset($data['tipo_conteo'])  ? trim($data['tipo_conteo'])  : null;
$nro_conteo   = isset($data['nro_conteo'])   ? intval($data['nro_conteo']) : null;
$usuarios     = isset($data['usuarios'])     ? $data['usuarios']           : null;
$cia          = isset($data['cia'])          ? trim($data['cia'])          : null;
$almacen      = isset($data['almacen'])      ? trim($data['almacen'])      : null;
$fecha        = isset($data['fecha'])        ? trim($data['fecha'])        : null;
$usuario_crea = isset($data['usuario'])      ? trim($data['usuario'])      : null;

if (!$tipo_conteo || !$nro_conteo || !$usuarios || !$cia || !$almacen || !$fecha) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
  exit;
}

/* ============================
   FORMATO DE USUARIOS
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
$tipo_conteo_safe   = addslashes($tipo_conteo);
$usuarios_json_safe = addslashes($usuarios_json);
$cia_safe           = addslashes($cia);
$almacen_safe       = addslashes($almacen);
$fecha_safe         = addslashes($fecha);
$usuario_crea_safe  = addslashes($usuario_crea);

/* ============================
   EJECUCIÓN DEL SP
   ============================ */
$sql = "
EXEC dbo.USP_GUARDAR_CONFIG_CONTEO
    @tipo_conteo       = '$tipo_conteo_safe',
    @nro_conteo        = $nro_conteo,
    @usuarios_asignados= N'$usuarios_json_safe',
    @cia               = '$cia_safe',
    @almacen           = '$almacen_safe',
    @fecha_asignacion  = '$fecha_safe',
    @usuario_creador   = '$usuario_crea_safe';
";

$res = mssql_query($sql, $conn);

if (!$res) {
  error_log('Error SQL SP GUARDAR_CONFIG_CONTEO: ' . mssql_get_last_message());
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

/* ============================
   RESULTADO
   ============================ */
$row = mssql_fetch_assoc($res);
echo json_encode([
  'success' => true,
  'mensaje' => 'Configuración registrada correctamente',
  'data'    => $row
]);
exit;
?>
