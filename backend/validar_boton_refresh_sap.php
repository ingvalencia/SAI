<?php

header('Content-Type: application/json; charset=utf-8');

$origen = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

$origenesPermitidos = [
  'http://localhost:3000',
  'https://diniz.com.mx'
];

if (in_array($origen, $origenesPermitidos, true)) {
  header("Access-Control-Allow-Origin: $origen");
}

header("Vary: Origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$cia         = isset($_GET['cia']) ? trim($_GET['cia']) : '';
$fecha       = isset($_GET['fecha']) ? trim($_GET['fecha']) : '';
$tipo_conteo = isset($_GET['tipo_conteo']) ? trim($_GET['tipo_conteo']) : '';
$base        = isset($_GET['base']) ? trim($_GET['base']) : '';

if ($cia === '' || $fecha === '' || $tipo_conteo === '' || $base === '') {
  echo json_encode([
    'success' => false,
    'error'   => 'Faltan parámetros: cia, fecha, tipo_conteo, base'
  ]);
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode([
    'success' => false,
    'error'   => 'No se pudo conectar a la BD'
  ]);
  exit;
}

if (!mssql_select_db($db, $conn)) {
  echo json_encode([
    'success' => false,
    'error'   => 'No se pudo seleccionar la BD'
  ]);
  exit;
}

$ciaSafe         = str_replace("'", "''", $cia);
$fechaSafe       = str_replace("'", "''", $fecha);
$tipoConteoSafe  = str_replace("'", "''", $tipo_conteo);
$baseSafe        = str_replace("'", "''", $base);

$sql = "
  SELECT
    COUNT(DISTINCT almacen) AS total_almacenes,
    COUNT(DISTINCT CASE WHEN nro_conteo = 4 THEN almacen END) AS almacenes_conteo_4
  FROM CAP_CONTEO_CONFIG
  WHERE cia = '{$ciaSafe}'
    AND CONVERT(VARCHAR(10), fecha_asignacion, 23) = '{$fechaSafe}'
    AND tipo_conteo = '{$tipoConteoSafe}'
    AND (
      almacen = '{$baseSafe}'
      OR almacen LIKE '{$baseSafe}-%'
    )
";

$res = mssql_query($sql, $conn);

if (!$res) {
  echo json_encode([
    'success' => false,
    'error'   => mssql_get_last_message()
  ]);
  exit;
}

$row = mssql_fetch_assoc($res);

$totalAlmacenes    = isset($row['total_almacenes']) ? (int)$row['total_almacenes'] : 0;
$almacenesConteo4  = isset($row['almacenes_conteo_4']) ? (int)$row['almacenes_conteo_4'] : 0;

$puedeActualizarSAP = ($totalAlmacenes > 0 && $totalAlmacenes === $almacenesConteo4);

echo json_encode([
  'success'               => true,
  'puede_actualizar_sap'  => $puedeActualizarSAP,
  'total_almacenes'       => $totalAlmacenes,
  'almacenes_conteo_4'    => $almacenesConteo4,
  'base'                  => $base,
  'fecha'                 => $fecha,
  'cia'                   => $cia,
  'tipo_conteo'           => $tipo_conteo
]);

exit;
