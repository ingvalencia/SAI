<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}



$cia      = isset($_GET['cia']) ? trim($_GET['cia']) : null;
$almacen  = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;

if (!$cia) {
  echo json_encode(array(
    "success" => false,
    "error"   => "Falta parámetro cia"
  ));
  exit;
}

if (!$almacen) {
  echo json_encode(array(
    "success" => false,
    "error"   => "Falta parámetro almacen"
  ));
  exit;
}



$cia = strtoupper($cia);
$almacen = strtoupper($almacen);


$parts = explode('-', $cia);
$clave = trim($parts[0]);
if ($clave === '') $clave = $cia;


$almacen_parts = explode('-', $almacen);
$almacen_base = trim($almacen_parts[0]);

$cia_safe        = str_replace("'", "''", $cia);
$almacen_safe    = str_replace("'", "''", $almacen);
$almacen_base_safe = str_replace("'", "''", $almacen_base);



$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  echo json_encode(array(
    "success" => false,
    "error"   => "No se pudo conectar a SQL Server"
  ));
  exit;
}

mssql_select_db($db, $conn);



$proyecto = null;

$qProj = mssql_query("
  SELECT TOP 1 proyecto
  FROM CAP_CATALOGO_PROYECTOS_ALMACEN
  WHERE codigo_almacen = '$almacen_safe'
    AND activo = 1
", $conn);

if ($qProj && ($rowP = mssql_fetch_assoc($qProj))) {
  $proyecto = isset($rowP['proyecto']) ? trim($rowP['proyecto']) : null;
}



$cuentas = array();

$qCtas = mssql_query("
  SELECT numero_cuenta, nombre_cuenta
  FROM CAP_CATALOGO_CUENTAS
  WHERE activo = 1
    AND UPPER(nombre_cuenta) LIKE '%$almacen_base_safe%'
  ORDER BY nombre_cuenta
", $conn);

if (!$qCtas) {
  echo json_encode(array(
    "success" => false,
    "error"   => "Error consultando CAP_CATALOGO_CUENTAS"
  ));
  exit;
}

while ($r = mssql_fetch_assoc($qCtas)) {

  $cuentas[] = array(
    "numero_cuenta" => isset($r['numero_cuenta']) ? trim($r['numero_cuenta']) : null,
    "nombre_cuenta" => isset($r['nombre_cuenta']) ? trim($r['nombre_cuenta']) : null
  );

}



echo json_encode(array(
  "success"  => true,
  "cia"      => $cia,
  "almacen"  => $almacen,
  "clave"    => $clave,
  "proyecto" => $proyecto,
  "cuentas"  => $cuentas
));

exit;
?>
