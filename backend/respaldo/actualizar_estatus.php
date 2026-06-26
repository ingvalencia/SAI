<?php
header('Content-Type: application/json');

$origenPermitido = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$almacen  = isset($_POST['almacen'])  ? $_POST['almacen']  : null;
$fecha    = isset($_POST['fecha'])    ? $_POST['fecha']    : null;
$empleado = isset($_POST['empleado']) ? intval($_POST['empleado']) : null;
$estatus  = isset($_POST['estatus'])  ? intval($_POST['estatus'])  : null;
$cia      = isset($_POST['cia']) ? trim($_POST['cia']) : null;

if (!$almacen || !$fecha || !$empleado || !$estatus) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
  exit;
}

$fecha = date("Y-m-d", strtotime($fecha));
$alm_safe = addslashes($almacen);
$cia_safe = $cia ? addslashes($cia) : null;
$whereCia = $cia_safe ? " AND cia = '$cia_safe' " : "";

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

$sqlUser = "SELECT TOP 1 id FROM usuarios WHERE empleado = $empleado";
$resUser = mssql_query($sqlUser, $conn);

if (!$resUser || mssql_num_rows($resUser) === 0) {
  echo json_encode(['success' => false, 'error' => 'Empleado no encontrado en tabla usuarios']);
  exit;
}

$rowUser    = mssql_fetch_assoc($resUser);
$usuario_id = intval($rowUser['id']);

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
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

$afectadas = mssql_rows_affected($conn);

$sqlTipo = "
  SELECT TOP 1 tipo_conteo
  FROM CAP_CONTEO_CONFIG
  WHERE almacen = '$alm_safe'
    $whereCia
    AND estatus IN (0,1)
";
$resTipo = mssql_query($sqlTipo, $conn);
$rowTipo = $resTipo ? mssql_fetch_assoc($resTipo) : null;
$esBrigada = ($rowTipo && strtolower($rowTipo['tipo_conteo']) === 'brigada');

if (!$esBrigada) {
  $sqlInv = "
    UPDATE CAP_INVENTARIO
    SET estatus = $estatus
    WHERE almacen = '$alm_safe'
      AND fecha_inv = '$fecha'
      AND usuario = $empleado
      $whereCia
  ";
  mssql_query($sqlInv, $conn);
}

echo json_encode([
  'success' => true,
  'mensaje' => "Estatus actualizado a $estatus",
  'estatus' => $estatus
]);
exit;
?>
