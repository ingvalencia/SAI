<?php
header('Content-Type: application/json');

$almacen  = isset($_GET['almacen'])  ? $_GET['almacen']  : null;
$fecha    = isset($_GET['fecha'])    ? $_GET['fecha']    : null;
$empleado = isset($_GET['empleado']) ? intval($_GET['empleado']) : null;

if (!$almacen || !$fecha || !$empleado) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
  exit;
}

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

// Paso 1: verificar si ya existe captura de otro usuario para ese almacén y fecha
$sqlExisteOtro = "
  SELECT TOP 1 usuario
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario <> $empleado
";

$resOtro = mssql_query($sqlExisteOtro, $conn);
if (!$resOtro) {
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

if (mssql_fetch_assoc($resOtro)) {
  echo json_encode(['success' => true, 'modo' => 'solo lectura']);
  exit;
}

// Paso 2: Si no hay otro usuario, revisar si ya se hizo confirmación (estatus = 1)
$sqlConfirmado = "
  SELECT TOP 1 estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha'
";

$resConf = mssql_query($sqlConfirmado, $conn);
if (!$resConf) {
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

$rowConf = mssql_fetch_assoc($resConf);
if ($rowConf && $rowConf['estatus'] == 1) {
  echo json_encode(['success' => true, 'modo' => 'solo lectura']);
  exit;
}

// Paso 3: Ejecutar el SP para registrar o definir el modo
$sql = "
  DECLARE @modo NVARCHAR(20);
  EXEC USP_CONTROL_CARGA_INVENTARIO '$almacen', '$fecha', $empleado, @modo OUTPUT;
  SELECT @modo as modo_resultado;
";

$resSP = mssql_query($sql, $conn);
if (!$resSP) {
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

$rowSP = mssql_fetch_assoc($resSP);
if (!$rowSP) {
  echo json_encode(['success' => false, 'error' => 'No se pudo obtener el modo de acceso']);
  exit;
}

$modo = $rowSP['modo_resultado'];

echo json_encode([
  'success' => true,
  'modo' => $modo
]);
exit;
