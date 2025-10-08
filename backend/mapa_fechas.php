<?php
// === HEADERS CORS / JSON ===
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// === PARÁMETROS ===
$cia = isset($_GET['cia']) ? trim($_GET['cia']) : null;

if (!$cia) {
  echo json_encode(["success" => false, "error" => "Falta parámetro: cia"]);
  exit;
}

// === CONEXIÓN SQL SERVER ===
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

// === CONSULTA DE FECHAS CON SU CONTEO MÁXIMO (JOIN) ===
$query = "
  SELECT
    CONVERT(VARCHAR(10), ci.fecha_gestion, 23) AS fecha_gestion,
    MAX(cia.conteo) AS conteo_maximo
  FROM configuracion_inventario ci
  INNER JOIN configuracion_inventario_almacenes cia
    ON ci.id = cia.configuracion_id
  WHERE ci.cia = '$cia'
  GROUP BY ci.fecha_gestion
  ORDER BY ci.fecha_gestion DESC
";

$res = mssql_query($query, $conn);
if (!$res) {
  echo json_encode(["success" => false, "error" => "Error en SQL: " . mssql_get_last_message()]);
  exit;
}

// === PROCESAR RESULTADO ===
$fechas = [];
while ($row = mssql_fetch_assoc($res)) {
  $fechas[] = [
    "fecha"  => $row['fecha_gestion'],
    "conteo" => (int)$row['conteo_maximo']
  ];
}

// === RESPUESTA JSON ===
echo json_encode([
  "success" => true,
  "data"    => $fechas
]);
exit;
?>
