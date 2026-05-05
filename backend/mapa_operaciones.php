<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$cia   = isset($_GET['cia'])   ? trim($_GET['cia'])   : null;
$fecha = isset($_GET['fecha']) ? trim($_GET['fecha']) : null;

if (!$cia || !$fecha) {
  echo json_encode(array("success" => false, "error" => "Faltan parámetros"));
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  echo json_encode(array("success" => false, "error" => "Conexión fallida"));
  exit;
}

if (!mssql_select_db($db, $conn)) {
  echo json_encode(array("success" => false, "error" => "No se pudo seleccionar la base de datos"));
  exit;
}

$ciaSafe   = str_replace("'", "''", $cia);
$fechaSafe = str_replace("'", "''", $fecha);

$query = "
  SELECT
    inv.almacen,
    CASE
      WHEN cie.id_cierre IS NOT NULL THEN 5
      ELSE inv.estatus
    END AS estatus
  FROM (
    SELECT
      almacen,
      MAX(CASE WHEN estatus = 7 THEN 4 ELSE estatus END) AS estatus
    FROM CAP_INVENTARIO
    WHERE cias = '$ciaSafe'
      AND fecha_inv = '$fechaSafe'
    GROUP BY almacen
  ) inv
  LEFT JOIN CAP_INVENTARIO_CIERRE cie
    ON cie.cia = '$ciaSafe'
   AND cie.fecha_inventario = '$fechaSafe'
   AND cie.almacen = inv.almacen
   AND ISNULL(cie.activo, 1) = 1
  ORDER BY estatus DESC, inv.almacen
";

$result = mssql_query($query, $conn);

if (!$result) {
  echo json_encode(array("success" => false, "error" => mssql_get_last_message()));
  exit;
}

$bloques = array();

while ($row = mssql_fetch_assoc($result)) {
  $estatus = intval($row["estatus"]);
  $almacen = trim($row["almacen"]);

  if (!isset($bloques[$estatus])) {
    $bloques[$estatus] = array(
      "estatus" => $estatus,
      "registros" => array()
    );
  }

  $bloques[$estatus]["registros"][] = array(
    "almacen" => $almacen,
    "estatus" => $estatus
  );
}

echo json_encode(array(
  "success" => true,
  "data" => array_values($bloques)
));

mssql_close($conn);
exit;
