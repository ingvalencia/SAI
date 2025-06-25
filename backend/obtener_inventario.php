<?php
header('Content-Type: application/json');

// Parámetros requeridos
$almacen  = isset($_GET['almacen'])  ? $_GET['almacen']  : null;
$fecha    = isset($_GET['fecha'])    ? $_GET['fecha']    : null;
$empleado = isset($_GET['empleado']) ? $_GET['empleado'] : null;

if (!$almacen || !$fecha || !$empleado) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos (almacen, fecha o empleado)']);
  exit;
}

// Conexión a SQL Server
$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'No se pudo conectar a la base de datos']);
  exit;
}

mssql_select_db($db, $conn);

// Verificar si hay registros confirmados (estatus = 1)
$sqlEstatus = "
  SELECT MAX(estatus) as estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha'
";
$resEstatus = mssql_query($sqlEstatus, $conn);
$rowEstatus = mssql_fetch_assoc($resEstatus);
$estatusFiltro = $rowEstatus && isset($rowEstatus['estatus']) ? intval($rowEstatus['estatus']) : 0;

// Ejecutar consulta principal usando el estatus correcto
$sql = "
  SELECT *
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen'
    AND fecha_inv = '$fecha'
    AND estatus = $estatusFiltro
";
$res = mssql_query($sql, $conn);

if (!$res) {
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

// Construir respuesta
$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $data[] = array_map('utf8_encode', $row);
}

echo json_encode([
  'success' => true,
  'data' => $data
]);
exit;
