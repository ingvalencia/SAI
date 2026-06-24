<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$almacen = isset($_GET['almacen']) ? $_GET['almacen'] : null;
$fecha = isset($_GET['fecha']) ? $_GET['fecha'] : null;
$empleado = isset($_GET['empleado']) ? $_GET['empleado'] : null;
$cia = isset($_GET['cia']) ? $_GET['cia'] : null;
$nro_conteo_param = isset($_GET['nro_conteo']) ? intval($_GET['nro_conteo']) : 0;

if (!$almacen || !$fecha || !$empleado || !$cia) {
  echo json_encode(array(
    "success" => false,
    "error" => "Faltan parámetros"
  ));
  exit;
}

$server = "192.168.0.174";
$user = "sa";
$pass = "P@ssw0rd";
$db = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  echo json_encode(array(
    "success" => false,
    "error" => "No se pudo conectar a la base de datos"
  ));
  exit;
}

mssql_select_db($db, $conn);

$almacen = str_replace("'", "''", $almacen);
$fecha = str_replace("'", "''", $fecha);
$empleado = str_replace("'", "''", $empleado);
$cia = str_replace("'", "''", $cia);

$sqlUser = "
  SELECT TOP 1 id
  FROM usuarios
  WHERE empleado = '$empleado'
";

$resUser = mssql_query($sqlUser, $conn);

if (!$resUser) {
  echo json_encode(array(
    "success" => false,
    "error" => "Error consultando usuario"
  ));
  exit;
}

$rowUser = mssql_fetch_assoc($resUser);
$usuario_id = isset($rowUser['id']) ? intval($rowUser['id']) : 0;

if ($usuario_id <= 0) {
  echo json_encode(array(
    "success" => false,
    "error" => "Usuario no encontrado"
  ));
  exit;
}

$sqlAsig = "
  SELECT TOP 1
    nro_conteo
  FROM CAP_CONTEO_CONFIG
  WHERE almacen = '$almacen'
    AND cia = '$cia'
    AND CAST(fecha_asignacion AS DATE) = '$fecha'
    AND estatus IN (0,1)
    AND usuarios_asignados LIKE '%[$usuario_id]%'
  ORDER BY nro_conteo DESC
";

$resAsig = mssql_query($sqlAsig, $conn);

$nro_conteo_actual = 0;

if ($resAsig) {
  $rowAsig = mssql_fetch_assoc($resAsig);
  $nro_conteo_actual = isset($rowAsig['nro_conteo']) ? intval($rowAsig['nro_conteo']) : 0;
}

if ($nro_conteo_param > 0) {
  $nro_conteo_actual = $nro_conteo_param;
}

if (!in_array($nro_conteo_actual, array(1, 2, 3, 7), true)) {
  $nro_conteo_actual = 1;
}

$queryEstatus = "
  SELECT MAX(estatus) AS estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen'
    AND CAST(fecha_inv AS DATE) = '$fecha'
    AND cias = '$cia'
";

$resultEstatus = mssql_query($queryEstatus, $conn);

if (!$resultEstatus) {
  echo json_encode(array(
    "success" => false,
    "error" => "Error consultando estatus"
  ));
  exit;
}

$rowEstatus = mssql_fetch_assoc($resultEstatus);
$estatus = isset($rowEstatus['estatus']) ? intval($rowEstatus['estatus']) : 0;

if ($estatus < 1) {
  $estatus = 0;
}

$sqlExisteConteo = "
  SELECT TOP 1 c.id
  FROM CAP_INVENTARIO_CONTEOS c
  INNER JOIN CAP_INVENTARIO i
    ON i.id = c.id_inventario
  WHERE i.almacen = '$almacen'
    AND CAST(i.fecha_inv AS DATE) = '$fecha'
    AND i.cias = '$cia'
    AND c.nro_conteo = $nro_conteo_actual
";

$resExisteConteo = mssql_query($sqlExisteConteo, $conn);

if (!$resExisteConteo) {
  echo json_encode(array(
    "success" => false,
    "error" => "Error verificando conteo actual"
  ));
  exit;
}

$existe_conteo_actual = mssql_num_rows($resExisteConteo) > 0;

if ($existe_conteo_actual && $estatus < $nro_conteo_actual) {
  $estatus = $nro_conteo_actual;
}

$queryConfig = "
  SELECT TOP 1 a.conteo
  FROM configuracion_inventario c
  JOIN configuracion_inventario_almacenes a
    ON c.id = a.configuracion_id
  WHERE c.cia = '$cia'
    AND CAST(c.fecha_gestion AS DATE) = '$fecha'
    AND a.almacen = '$almacen'
";

$resConfig = mssql_query($queryConfig, $conn);

$conteo_config = 0;

if ($resConfig) {
  $rowConfig = mssql_fetch_assoc($resConfig);
  $conteo_config = isset($rowConfig['conteo']) ? intval($rowConfig['conteo']) : 0;
}

$sqlCheck3 = "
  SELECT TOP 1 nro_conteo
  FROM CAP_CONTEO_CONFIG
  WHERE almacen = '$almacen'
    AND cia = '$cia'
    AND CAST(fecha_asignacion AS DATE) = '$fecha'
    AND nro_conteo = 3
    AND estatus IN (0,1)
";

$resCheck3 = mssql_query($sqlCheck3, $conn);
$existe_config_tercer_conteo = ($resCheck3 && mssql_num_rows($resCheck3) > 0);

$ir_comparar = false;

if ($existe_conteo_actual) {
  $ir_comparar = true;
}

if ($nro_conteo_actual == 7 && $existe_conteo_actual) {
  $ir_comparar = true;
}

echo json_encode(array(
  "success" => true,
  "estatus" => $estatus,
  "nro_conteo" => $nro_conteo_actual,
  "existe_conteo" => $existe_conteo_actual,
  "ir_comparar" => $ir_comparar,
  "config_tercer_conteo" => $existe_config_tercer_conteo,
  "conteo_config" => $conteo_config
));

exit;
?>
