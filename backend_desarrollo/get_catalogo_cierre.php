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

$cia_safe = str_replace("'", "''", $cia);
$almacen_safe = str_replace("'", "''", $almacen);
$almacen_base_safe = str_replace("'", "''", $almacen_base);

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS_DESARROLLO";

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
$nombre_almacen = null;
$cia_almacen = null;
$empresa = null;

$qProj = mssql_query("
  SELECT TOP 1
    codigo_almacen,
    cia,
    nombre_almacen,
    proyecto,
    empresa
  FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_CATALOGO_PROYECTOS_ALMACEN
  WHERE activo = 1
    AND UPPER(LTRIM(RTRIM(codigo_almacen))) = '$almacen_safe'
    AND UPPER(LTRIM(RTRIM(empresa))) = '$cia_safe'
  ORDER BY fecha_carga DESC
", $conn);

if (!$qProj) {
  echo json_encode(array(
    "success" => false,
    "error"   => "Error consultando CAP_CATALOGO_PROYECTOS_ALMACEN"
  ));
  exit;
}

if ($rowP = mssql_fetch_assoc($qProj)) {
  $cia_almacen = isset($rowP['cia']) ? trim($rowP['cia']) : null;
  $nombre_almacen = isset($rowP['nombre_almacen']) ? trim($rowP['nombre_almacen']) : null;
  $proyecto = isset($rowP['proyecto']) ? trim($rowP['proyecto']) : null;
  $empresa = isset($rowP['empresa']) ? trim($rowP['empresa']) : null;
}

$cuentas = array();

$qCtas = mssql_query("
  SELECT
    numero_cuenta,
    nombre_cuenta,
    empresa,
    CASE
      WHEN UPPER(nombre_cuenta) LIKE '%$almacen_base_safe%' THEN 1
      ELSE 0
    END AS relacionada
  FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_CATALOGO_CUENTAS
  WHERE activo = 1
    AND UPPER(LTRIM(RTRIM(empresa))) = '$cia_safe'
  ORDER BY
    CASE
      WHEN UPPER(nombre_cuenta) LIKE '%$almacen_base_safe%' THEN 0
      ELSE 1
    END,
    nombre_cuenta
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
    "nombre_cuenta" => isset($r['nombre_cuenta']) ? trim($r['nombre_cuenta']) : null,
    "empresa"       => isset($r['empresa']) ? trim($r['empresa']) : null,
    "relacionada"   => isset($r['relacionada']) ? intval($r['relacionada']) : 0
  );
}

echo json_encode(array(
  "success"        => true,
  "cia"            => $cia,
  "almacen"        => $almacen,
  "clave"          => $clave,
  "almacen_base"   => $almacen_base,
  "cia_almacen"    => $cia_almacen,
  "nombre_almacen" => $nombre_almacen,
  "proyecto"       => $proyecto,
  "empresa"        => $empresa,
  "cuentas"        => $cuentas
));

exit;
?>
