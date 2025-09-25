<?php
// ====== CORS ======
$origenPermitido = 'http://localhost:3000';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ====== SESIÓN ======
session_name('SAI_SES');
session_start();

// ====== CONEXIÓN MSSQL ======
$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";
$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'No se pudo conectar a la BD']);
  exit;
}
mssql_select_db($db, $conn);

// Configuración SQL Server
mssql_query("SET ANSI_NULLS ON", $conn);
mssql_query("SET QUOTED_IDENTIFIER ON", $conn);
mssql_query("SET CONCAT_NULL_YIELDS_NULL ON", $conn);
mssql_query("SET ANSI_WARNINGS ON", $conn);
mssql_query("SET ANSI_PADDING ON", $conn);

// ====== PARÁMETRO OPCIONAL ======
$soloActivos = isset($_GET['solo_activos']) && $_GET['solo_activos'] == '1';

// ====== CONSULTA USUARIOS ======
$sql = "
SELECT
  u.id,
  u.empleado,
  u.nombre,
  u.activo,
  ISNULL((
    SELECT STUFF((
      SELECT ',' + ul.local_codigo
      FROM dbo.usuario_local ul
      WHERE ul.usuario_id = u.id AND ul.activo = 1
      FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 1, '')
  ), '') AS locales_csv
FROM dbo.usuarios u
";

if ($soloActivos) {
  $sql .= " WHERE u.activo = 1";
}

$sql .= " ORDER BY u.empleado";

// ====== EJECUCIÓN ======
$res = mssql_query($sql, $conn);
if (!$res) {
  $mensajeError = mssql_get_last_message();
  echo json_encode(['success' => false, 'error' => "Error SQL: $mensajeError"]);
  exit;
}

// ====== FORMATO DE RESPUESTA ======
$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $csv = isset($row['locales_csv']) ? trim($row['locales_csv']) : '';
  $locales = $csv === '' ? [] : array_values(array_filter(array_map('trim', explode(',', $csv))));

  $data[] = [
    'id'       => (int)$row['id'],
    'empleado' => $row['empleado'],
    'nombre'   => $row['nombre'],
    'activo'   => (int)$row['activo'],
    'locales'  => $locales,
  ];
}

echo json_encode(['success' => true, 'data' => $data]);
exit;
