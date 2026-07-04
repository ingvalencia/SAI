<?php
header('Content-Type: application/json');

$almacen = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;

if (!$almacen || strpos($almacen, '-') === false) {
  echo json_encode(['success' => false, 'error' => 'Parámetro inválido o faltante (almacen)']);
  exit;
}

list($clocal, ) = explode('-', $almacen);
$clocal = strtoupper($clocal);

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "GSSAP2010";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'No se pudo conectar a la base de datos']);
  exit;
}

mssql_select_db($db, $conn);

$sql = "SELECT nextdate FROM GSSAP2010.dbo.GD_LOCSOC WHERE clocal = '$clocal'";

$res = mssql_query($sql, $conn);

if (!$res) {
  echo json_encode(['success' => false, 'error' => 'Error en la consulta: ' . mssql_get_last_message()]);
  exit;
}

if (mssql_num_rows($res) == 0) {
  echo json_encode(['success' => false, 'error' => "No se encontró clocal = '$clocal'"]);
  exit;
}

$row = mssql_fetch_assoc($res);
$fecha = $row['nextdate'];

if (!$fecha) {
  echo json_encode(['success' => false, 'error' => 'La fecha está vacía']);
  exit;
}

$fechaFormateada = date('Y-m-d', strtotime($fecha));

echo json_encode(['success' => true, 'fecha' => $fechaFormateada]);
exit;
