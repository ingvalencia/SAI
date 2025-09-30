<?php

// === HEADERS PARA CORS ===
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// === Validar parámetros ===
$almacen = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;
$fecha   = isset($_GET['fecha']) ? trim($_GET['fecha']) : null;
$cia     = isset($_GET['cia']) ? trim($_GET['cia']) : null;

// Debug opcional
file_put_contents("php://stderr", "PARAMS: almacen=$almacen | fecha=$fecha | cia=$cia\n", FILE_APPEND);

// Validar
if (!$almacen || !$fecha || !$cia) {
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

// === Consulta ===
// Obtenemos todos los registros para ese almacén y fecha con su conteo
$query = "
  SELECT
    ItemCode,
    Itemname,
    codebars,
    almacen,
    cias,
    cant_invfis,
    estatus AS conteo,
    fecha_inv,
    fecha_carga,
    usuario
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen'
    AND fecha_inv = '$fecha'
    AND cias = '$cia'
  
";

$result = mssql_query($query, $conn);
if (!$result) {
  echo json_encode(["success" => false, "error" => "Error en consulta: " . mssql_get_last_message()]);
  exit;
}

// === Agrupar por ItemCode con los 3 conteos ===
$items = [];

while ($row = mssql_fetch_assoc($result)) {
  $code = $row['ItemCode'];
  $conteo = intval($row['conteo']);

  if (!isset($items[$code])) {
    $items[$code] = [
      "ItemCode" => $row["ItemCode"],
      "Itemname" => $row["Itemname"],
      "conteo1" => null,
      "conteo2" => null,
      "conteo3" => null
    ];
  }

  if ($conteo === 1) {
    $items[$code]["conteo1"] = $row["cant_invfis"];
  } elseif ($conteo === 2) {
    $items[$code]["conteo2"] = $row["cant_invfis"];
  } elseif ($conteo === 3) {
    $items[$code]["conteo3"] = $row["cant_invfis"];
  }
}

// === Respuesta ===
echo json_encode([
  "success" => true,
  "data" => array_map(function($item) {
    return array_map(function($v) {
      return is_string($v) ? utf8_encode($v) : $v;
    }, $item);
  }, array_values($items))
]);

exit;
