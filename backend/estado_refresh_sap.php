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


$q = mssql_query("
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN sap_refrescado = 1 THEN 1 ELSE 0 END) AS refrescados
  FROM CAP_INVENTARIO
  WHERE almacen IN ($listaAlmacenes)
    AND fecha_inv = '$fecha_safe'
    AND cias = '$cia_safe'
", $conn);

if (!$q) {
  echo json_encode(["success" => false, "error" => "Error en la consulta"]);
  exit;
}

$row = mssql_fetch_assoc($q);

if (!$row || intval($row['total']) === 0) {
  echo json_encode(["success" => false, "error" => "Inventarios no encontrados"]);
  exit;
}

$sap_refrescado = (intval($row['total']) === intval($row['refrescados'])) ? 1 : 0;


echo json_encode([
  "success"        => true,
  "sap_refrescado" => $sap_refrescado,
  "total"          => intval($row['total']),
  "refrescados"    => intval($row['refrescados'])
]);
exit;
