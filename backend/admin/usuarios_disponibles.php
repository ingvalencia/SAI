<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'Error conexión SQL']);
  exit;
}

mssql_select_db($db, $conn);

/*
  Trae usuarios:
  - activos
  - que NO tengan rol 1 ni 2
*/
$sql = "
SELECT
  u.id,
  u.empleado,
  u.nombre
FROM usuarios u
WHERE u.activo = 1
AND NOT EXISTS (
  SELECT 1
  FROM usuario_rol ur
  WHERE ur.usuario_id = u.id
    AND ur.rol_id IN (1,2,3)
)
ORDER BY u.nombre
";

$res = mssql_query($sql, $conn);

$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $data[] = [
    'id'       => intval($row['id']),
    'empleado' => $row['empleado'],
    'nombre'   => $row['nombre']
  ];
}

echo json_encode([
  'success' => true,
  'data' => $data
]);

mssql_close($conn);
