<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// === Validar parámetros ===
$almacen  = isset($_GET['almacen']) ? $_GET['almacen'] : null;
$fecha    = isset($_GET['fecha'])   ? $_GET['fecha']   : null;
$empleado = isset($_GET['empleado']) ? $_GET['empleado'] : null;
$cia      = isset($_GET['cia'])     ? $_GET['cia']     : null;

if (!$almacen || !$fecha || !$empleado || !$cia) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}

// === Conexión SQL Server ===
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

// === Obtener estatus más alto ===
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

// Asegurar mínimo estatus 1
if ($estatus < 1) $estatus = 0;

echo json_encode([
  "success" => true,
  "estatus" => $estatus
]);
exit;
