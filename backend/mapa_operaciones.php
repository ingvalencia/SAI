<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// === Parámetros ===
$cia   = isset($_GET['cia'])   ? $_GET['cia']   : null;
$fecha = isset($_GET['fecha']) ? $_GET['fecha'] : null;

if (!$cia || !$fecha) {
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
  echo json_encode(["success" => false, "error" => "Conexión fallida"]);
  exit;
}
mssql_select_db($db, $conn);


$query = "
    SELECT
    almacen,
    MAX(estatus) AS estatus
  FROM CAP_INVENTARIO
  WHERE cias = '$cia'
    AND fecha_inv = '$fecha'
  GROUP BY almacen
  ORDER BY estatus DESC, almacen

";

$result = mssql_query($query, $conn);
if (!$result) {
  echo json_encode(["success" => false, "error" => mssql_get_last_message()]);
  exit;
}

// Agrupar por estatus, pero manteniendo registros individuales (almacen+estatus)
$bloques = [];

while ($row = mssql_fetch_assoc($result)) {
  $estatus = intval($row["estatus"]);
  $almacen = $row["almacen"];

  if (!isset($bloques[$estatus])) {
    $bloques[$estatus] = [
      "estatus" => $estatus,
      "registros" => []
    ];
  }

  $bloques[$estatus]["registros"][] = [
    "almacen" => $almacen,
    "estatus" => $estatus
  ];
}

echo json_encode([
  "success" => true,
  "data" => array_values($bloques)
]);
exit;
