<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

$conn = mssql_connect("192.168.0.174", "sa", "P@ssw0rd");
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'Conexión fallida']);
  exit;
}
mssql_select_db("SAP_PROCESOS", $conn);

// 💡 SET obligatorios para columnas computadas, vistas indexadas, etc.
mssql_query("SET ANSI_NULLS ON", $conn);
mssql_query("SET ANSI_WARNINGS ON", $conn);
mssql_query("SET QUOTED_IDENTIFIER ON", $conn);
mssql_query("SET CONCAT_NULL_YIELDS_NULL ON", $conn);
mssql_query("SET ANSI_PADDING ON", $conn);

// Cargar usuarios con info de rol
$query = "
SELECT
  u.id,
  u.empleado,
  u.nombre,
  u.email,
  u.id,
  r.nombre AS rol_nombre,
  u.activo,
  ISNULL((
    SELECT STUFF((
      SELECT ',' + ul.local_codigo
      FROM usuario_local ul
      WHERE ul.usuario_id = u.id AND ul.activo = 1
      FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 1, '')
  ), '') AS locales_csv
FROM usuarios u
LEFT JOIN roles r ON r.id = u.id
ORDER BY u.empleado
";

$res = mssql_query($query, $conn);
if (!$res) {
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $locales = $row['locales_csv'] !== '' ? explode(',', $row['locales_csv']) : [];
  $data[] = [
    'id'       => (int)$row['id'],
    'empleado' => $row['empleado'],
    'nombre'   => $row['nombre'],
    'email'    => $row['email'],
    'id'   => (int)$row['id'],
    'rol'      => $row['id'],
    'activo'   => (int)$row['activo'],
    'locales'  => array_map('trim', $locales)
  ];
}

echo json_encode(['success' => true, 'data' => $data]);
exit;
