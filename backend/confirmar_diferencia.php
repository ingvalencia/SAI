<?php
header('Content-Type: application/json');

// Validar datos
$almacen = isset($_POST['almacen']) ? $_POST['almacen'] : null;
$fecha = isset($_POST['fecha']) ? $_POST['fecha'] : null;
$empleado = isset($_POST['empleado']) ? intval($_POST['empleado']) : null;

if (!$almacen || !$fecha || !$empleado) {
  echo json_encode(['success' => false, 'error' => 'Datos incompletos o inválidos']);
  exit;
}

// Conexión
$server = "192.168.0.174";
$user = "sa";
$pass = "P@ssw0rd";
$db   = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'No se pudo conectar a la base de datos']);
  exit;
}

mssql_select_db($db, $conn);

// Verificar que haya registros confirmados previamente (estatus = 1)
$check = mssql_query("
  SELECT COUNT(*) AS total FROM CAP_INVENTARIO
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = $empleado AND estatus = 1
", $conn);

$row = mssql_fetch_assoc($check);
if (!$row || $row['total'] == 0) {
  echo json_encode(['success' => false, 'error' => 'No hay registros confirmados para este usuario']);
  exit;
}

// Actualizar estatus a 2 (proceso finalizado)
$update = mssql_query("
  UPDATE CAP_INVENTARIO
  SET estatus = 2
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = $empleado
", $conn);

if (!$update) {
  echo json_encode(['success' => false, 'error' => 'Error al actualizar estatus a 2']);
  exit;
}

echo json_encode(['success' => true, 'mensaje' => 'Diferencias confirmadas correctamente']);
exit;
