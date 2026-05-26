<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

$almacen = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;
$fecha   = isset($_GET['fecha'])   ? trim($_GET['fecha'])   : null;
$cia     = isset($_GET['cia'])     ? trim($_GET['cia'])     : null;

if (!$almacen || !$fecha || !$cia) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(["success" => false, "error" => "No se pudo conectar a SQL Server"]);
  exit;
}

mssql_select_db($db, $conn);

$almacenes = array_filter(array_map('trim', explode(',', $almacen)));

if (empty($almacenes)) {
  echo json_encode(["success" => false, "error" => "Almacenes inválidos"]);
  exit;
}

$almacenesSQL = array_map('addslashes', $almacenes);
$listaAlmacenes = "'" . implode("','", $almacenesSQL) . "'";

$fecha_safe = addslashes($fecha);
$cia_safe   = addslashes($cia);

$primerAlmacen = $almacenes[0];
$grupoBase = explode('-', $primerAlmacen)[0];
$grupoBaseSafe = addslashes($grupoBase);

$q = mssql_query("
  SELECT
    COUNT(DISTINCT CFG.almacen) AS total_almacenes,
    COUNT(DISTINCT CASE
      WHEN F.tipo_foto = 'REFRESH'
       AND ISNULL(F.es_activa, 0) = 1
      THEN CFG.almacen
    END) AS refrescados
  FROM CAP_CONTEO_CONFIG CFG
  LEFT JOIN CAP_INVENTARIO_SAP_FOTO F
    ON F.almacen = CFG.almacen
   AND F.cia = CFG.cia
   AND CAST(F.fecha_inv AS DATE) = CAST(CFG.fecha_asignacion AS DATE)
   AND F.tipo_foto = 'REFRESH'
   AND ISNULL(F.es_activa, 0) = 1
  WHERE CFG.almacen LIKE '$grupoBaseSafe-%'
    AND CAST(CFG.fecha_asignacion AS DATE) = '$fecha_safe'
    AND CFG.cia = '$cia_safe'
", $conn);

if (!$q) {
  echo json_encode(["success" => false, "error" => "Error en la consulta"]);
  exit;
}

$row = mssql_fetch_assoc($q);

if (!$row || intval($row['total_almacenes']) === 0) {
  echo json_encode(["success" => false, "error" => "Programaciones no encontradas"]);
  exit;
}

$sap_refrescado = (intval($row['total_almacenes']) === intval($row['refrescados'])) ? 1 : 0;

echo json_encode([
  "success"        => true,
  "sap_refrescado" => $sap_refrescado,
  "total"          => intval($row['total_almacenes']),
  "refrescados"    => intval($row['refrescados'])
]);

exit;
