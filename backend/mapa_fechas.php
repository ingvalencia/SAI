<?php
// === HEADERS CORS / JSON ===
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

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

// ==========================================================
// NUEVA CONSULTA basada en CAP_CONTEO_CONFIG
// ==========================================================
$query = "
  SELECT
      CONVERT(VARCHAR(10), fecha_asignacion, 23) AS fecha,
      MAX(nro_conteo) AS conteo_maximo
  FROM CAP_CONTEO_CONFIG
  WHERE cia = '$cia'
  GROUP BY fecha_asignacion
  ORDER BY fecha_asignacion DESC
";

$res = mssql_query($query, $conn);
if (!$res) {
  echo json_encode([
    "success" => false,
    "error"   => "Error en SQL: " . mssql_get_last_message()
  ]);
  exit;
}

// === PROCESAR RESULTADO ===
$fechas = [];
while ($row = mssql_fetch_assoc($res)) {
  $fechas[] = [
    "fecha"  => $row['fecha'],
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
