<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/* ============================================================
   PARÁMETROS
============================================================ */
$almacen  = isset($_GET['almacen']) ? $_GET['almacen'] : null;
$fecha    = isset($_GET['fecha'])   ? $_GET['fecha']   : null;
$empleado = isset($_GET['empleado']) ? $_GET['empleado'] : null;
$cia      = isset($_GET['cia'])     ? $_GET['cia']     : null;

if (!$almacen || !$fecha || !$empleado || !$cia) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}

/* ============================================================
   CONEXIÓN SQL
============================================================ */
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

/* ============================================================
   PASO 1: Obtener estatus mayor en CAP_INVENTARIO (1,2,3,4)
============================================================ */
$query = "
  SELECT MAX(estatus) AS estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen'
    AND fecha_inv = '$fecha'
    AND usuario = '$empleado'
    AND cias = '$cia'
";

$result = mssql_query($query, $conn);
if (!$result) {
  echo json_encode(["success" => false, "error" => "Error en consulta: " . mssql_get_last_message()]);
  exit;
}

$row = mssql_fetch_assoc($result);
$estatus = isset($row['estatus']) ? intval($row['estatus']) : 0;
if ($estatus < 1) $estatus = 0;

/* ============================================================
   PASO 2: Leer configuración normal del inventario
============================================================ */
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
if (!$resConfig) {
  echo json_encode(["success" => false, "error" => "Error al consultar configuración: " . mssql_get_last_message()]);
  exit;
}

$rowConfig = mssql_fetch_assoc($resConfig);
$conteo_config = isset($rowConfig['conteo']) ? intval($rowConfig['conteo']) : 0;

/* ============================================================
   PASO 3 (NUEVO): SI EXISTE CONTEO 3 EN CAP_CONTEO_CONFIG,
   entonces NO aplicar validación del administrador.
============================================================ */
$sqlCheck3 = "
  SELECT TOP 1 nro_conteo
  FROM CAP_CONTEO_CONFIG
  WHERE almacen = '$almacen'
    AND cia = '$cia'
    AND nro_conteo = 3
    AND estatus IN (0,1)
";

$resCheck3 = mssql_query($sqlCheck3, $conn);

if ($resCheck3 && mssql_num_rows($resCheck3) > 0) {
    // Tercer conteo manual ya fue asignado -> permitir acceso
    echo json_encode([
        "success" => true,
        "estatus" => $estatus
    ]);
    exit;
}

/* ============================================================
   PASO 4: Validación original del administrador (casos normales)
============================================================ */

if ($estatus > $conteo_config && $estatus !== 1 && $estatus !== 4) {
  echo json_encode([
    "success" => false,
    "error"   => "Administrador aun no autoriza este conteo"
  ]);
  exit;
}

/* ============================================================
   RESPUESTA FINAL
============================================================ */
echo json_encode([
  "success" => true,
  "estatus" => $estatus
]);
exit;
?>
