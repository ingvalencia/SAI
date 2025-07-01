<?php
header('Content-Type: application/json');

$empleado = isset($_GET['empleado']) ? $_GET['empleado'] : null;
if (!$empleado) {
  echo json_encode(['success' => false, 'error' => 'Falta el parámetro empleado']);
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "LOGS_CONTROL";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'No se pudo conectar a la base de datos']);
  exit;
}
mssql_select_db($db, $conn);

$sql = "
  SELECT habilitado, empleado_modo_desarrollo
  FROM Sistemas
  WHERE sistema_id = 3
";
$res = mssql_query($sql, $conn);
if (!$res) {
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}
$row = mssql_fetch_assoc($res);
if (!$row) {
  echo json_encode(['success' => false, 'error' => 'Sistema no encontrado']);
  exit;
}

$habilitado = intval($row['habilitado']);
$empleado_dev = intval($row['empleado_modo_desarrollo']);
$modo_forzado = ($habilitado === 0 && intval($empleado) === $empleado_dev);

echo json_encode([
  'success' => true,
  'habilitado' => $habilitado,
  'modo_forzado' => $modo_forzado
]);
exit;
