<?php
header('Content-Type: application/json');

// Validar datos
$almacen = isset($_POST['almacen']) ? $_POST['almacen'] : null;
$fecha = isset($_POST['fecha']) ? $_POST['fecha'] : null;
$empleado = isset($_POST['empleado']) ? intval($_POST['empleado']) : null;
$datos = isset($_POST['datos']) ? json_decode($_POST['datos'], true) : null;

if (!$almacen || !$fecha || !$empleado || !$datos || !is_array($datos)) {
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

// Verificar estatus actual
$check = mssql_query("
  SELECT COUNT(*) AS total FROM CAP_INVENTARIO
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = $empleado AND estatus = 0
", $conn);

$row = mssql_fetch_assoc($check);
if (!$row || $row['total'] == 0) {
  echo json_encode(['success' => false, 'error' => 'Ya ha sido confirmado o no tiene permiso']);
  exit;
}

// 1. Actualizar cantidades
foreach ($datos as $item) {
  $itemcode = $item['ItemCode'];
  $cantidad = floatval($item['cant_invfis']);

  $sql = "
    UPDATE CAP_INVENTARIO
    SET cant_invfis = $cantidad
    WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = $empleado AND ItemCode = '$itemcode'
  ";

  if (!mssql_query($sql, $conn)) {
    echo json_encode(['success' => false, 'error' => 'Error al guardar cantidades: ' . mssql_get_last_message()]);
    exit;
  }
}

// 2. Confirmar inventario
$confirm = mssql_query("
  UPDATE CAP_INVENTARIO
  SET estatus = 1
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = $empleado
", $conn);

if (!$confirm) {
  echo json_encode(['success' => false, 'error' => 'Error al confirmar inventario']);
  exit;
}

echo json_encode(['success' => true, 'mensaje' => 'Inventario confirmado exitosamente']);
exit;
