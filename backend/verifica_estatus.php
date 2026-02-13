<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}


$almacen  = isset($_GET['almacen']) ? $_GET['almacen'] : null;
$fecha    = isset($_GET['fecha'])   ? $_GET['fecha']   : null;
$empleado = isset($_GET['empleado']) ? $_GET['empleado'] : null;
$cia      = isset($_GET['cia'])     ? $_GET['cia']     : null;

if (!$almacen || !$fecha || !$empleado || !$cia) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}


$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(["success" => false, "error" => "No se pudo conectar a la base de datos"]);
  exit;
}
mssql_select_db($db, $conn);


$query = "
  SELECT MAX(estatus) AS estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen'
    AND fecha_inv = '$fecha'
    AND usuario = '$empleado'
    AND cias = '$cia'
";

$result = mssql_query($query, $conn);
$row = mssql_fetch_assoc($result);

$estatus = isset($row['estatus']) ? intval($row['estatus']) : 0;
if ($estatus < 1) $estatus = 0;


$queryConfig = "
  SELECT a.conteo
  FROM configuracion_inventario c
  JOIN configuracion_inventario_almacenes a
    ON c.id = a.configuracion_id
  WHERE c.cia = '$cia'
    AND c.fecha_gestion = '$fecha'
    AND a.almacen = '$almacen'
";

$resConfig = mssql_query($queryConfig, $conn);
$rowConfig = mssql_fetch_assoc($resConfig);
$conteo_config = isset($rowConfig['conteo']) ? intval($rowConfig['conteo']) : 0;


$sqlCheck3 = "
  SELECT TOP 1 nro_conteo
  FROM CAP_CONTEO_CONFIG
  WHERE almacen = '$almacen'
    AND cia = '$cia'
    AND nro_conteo = 3
    AND estatus IN (0,1)
";

$resCheck3 = mssql_query($sqlCheck3, $conn);
$existe_config_tercer_conteo = ($resCheck3 && mssql_num_rows($resCheck3) > 0);


$sqlUser = "SELECT TOP 1 id FROM usuarios WHERE empleado = '$empleado'";
$resUser = mssql_query($sqlUser, $conn);
$rowUser = mssql_fetch_assoc($resUser);
$usuario_id = intval($rowUser['id']);


$sqlAsig = "
  SELECT TOP 1 nro_conteo
  FROM CAP_CONTEO_CONFIG
  WHERE almacen='$almacen'
    AND cia='$cia'
    AND estatus IN (0,1)
    AND usuarios_asignados LIKE '%[$usuario_id]%'
";

$resAsig = mssql_query($sqlAsig, $conn);
$rowAsig = mssql_fetch_assoc($resAsig);

$nro_conteo_actual = intval($rowAsig['nro_conteo']);


if (!in_array($nro_conteo_actual, [1,2,3,7], true)) {
  $nro_conteo_actual = 3;
}


$sqlCheckConteo = "
    SELECT COUNT(*) AS total
    FROM CAP_INVENTARIO_CONTEOS
    WHERE usuario = '$empleado'
      AND nro_conteo = $nro_conteo_actual
      AND id_inventario IN (
            SELECT id
            FROM CAP_INVENTARIO
            WHERE almacen = '$almacen'
              AND fecha_inv = '$fecha'
              AND cias = '$cia'

        )
";

$resConteos = mssql_query($sqlCheckConteo, $conn);
$rowConteos = mssql_fetch_assoc($resConteos);

$existe_conteo_actual = intval($rowConteos['total']) > 0;


echo json_encode([
  "success"                => true,
  "estatus"                => $estatus,
  "nro_conteo"             => $nro_conteo_actual,
  "existe_conteo"          => $existe_conteo_actual,
  "config_tercer_conteo"   => $existe_config_tercer_conteo
]);
exit;
?>
