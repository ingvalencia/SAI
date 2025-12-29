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
$almacen  = isset($_POST['almacen'])  ? $_POST['almacen']  : null;
$fecha    = isset($_POST['fecha'])    ? $_POST['fecha']    : null;
$empleado = isset($_POST['empleado']) ? intval($_POST['empleado']) : null;
$estatus  = isset($_POST['estatus'])  ? intval($_POST['estatus'])  : null;


if (!$almacen || !$fecha || !$empleado || !$estatus ) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
  exit;
}

// Normalizar fecha a formato SQL
$fecha = date("Y-m-d", strtotime($fecha));

$alm_safe = addslashes($almacen);


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
// Obtener id interno del usuario
// ============================
$sqlUser = "SELECT TOP 1 id FROM usuarios WHERE empleado = $empleado";
$resUser = mssql_query($sqlUser, $conn);

if (!$resUser || mssql_num_rows($resUser) === 0) {
  echo json_encode(['success' => false, 'error' => 'Empleado no encontrado en tabla usuarios']);
  exit;
}

$rowUser    = mssql_fetch_assoc($resUser);
$usuario_id = intval($rowUser['id']);

// ============================
// Actualizar estatus en CAP_INVENTARIO
// ============================


// ============================
// Actualizar CAP_CONTEO_CONFIG (modo individual)
// Se asume un solo registro activo (estatus=0) por usuario/almacén/cia
// ============================
// ============================
// CAPTURAR CIA SI VIENE (NO OBLIGATORIA PARA NO ROMPER LO ACTUAL)
// ============================
$cia = isset($_POST['cia']) ? trim($_POST['cia']) : null;
$cia_safe = $cia ? addslashes($cia) : null;

// ============================
// Actualizar CAP_CONTEO_CONFIG (Individual o Brigada)
// ============================
$whereCia = $cia_safe ? " AND cia = '$cia_safe' " : "";

$sqlCfg = "
  UPDATE CAP_CONTEO_CONFIG
  SET nro_conteo = $estatus
  WHERE almacen = '$alm_safe'
    $whereCia
    AND usuarios_asignados LIKE '%[$usuario_id]%'
    AND estatus IN (0,1)
";

$resCfg = mssql_query($sqlCfg, $conn);

if (!$resCfg) {
  error_log("Error SQL actualizar_estatus CAP_CONTEO_CONFIG: " . mssql_get_last_message());
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

// VALIDAR QUE SÍ ACTUALIZÓ ALGO
$afectadas = mssql_rows_affected($conn);
if ($afectadas <= 0) {
  echo json_encode([
    'success' => false,
    'error' => 'No se actualizó CAP_CONTEO_CONFIG (0 filas). Valida cia/almacen/usuarios_asignados.'
  ]);
  exit;
}


// ============================
// Respuesta
// ============================
echo json_encode([
  'success' => true,
  'mensaje' => "Estatus actualizado a $estatus",
  'estatus' => $estatus
]);
exit;
