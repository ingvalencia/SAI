<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// --- Validar datos ---
$almacen  = isset($_POST['almacen']) ? $_POST['almacen'] : null;
$fecha    = isset($_POST['fecha']) ? $_POST['fecha'] : null;
$empleado = isset($_POST['empleado']) ? intval($_POST['empleado']) : null;
$datos    = isset($_POST['datos']) ? json_decode($_POST['datos'], true) : null;
$estatus  = isset($_POST['estatus']) ? intval($_POST['estatus']) : null;

if (!$almacen || !$fecha || !$empleado || !$datos || !is_array($datos) || !isset($estatus)) {
  echo json_encode(['success' => false, 'error' => 'Datos incompletos o inválidos']);
  exit;
}


if (!in_array($estatus, [0,1,2,3])) {
  echo json_encode(['success' => false, 'error' => 'Estatus inválido']);
  exit;
}

// --- Conexión ---
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

// --- Validar estatus previo ---
if ($estatus > 1) {
  $check = mssql_query("
    SELECT COUNT(*) AS total FROM CAP_INVENTARIO
    WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = $empleado AND estatus = " . ($estatus ), $conn);

  $row = mssql_fetch_assoc($check);
  if (!$row || $row['total'] == 0) {
    echo json_encode(['success' => false, 'error' => 'No puedes confirmar este conteo. El conteo previo no ha sido completado.']);
    exit;
  }
}

// --- 1. Actualizar cantidades en CAP_INVENTARIO y guardar conteo ---
foreach ($datos as $item) {
  $itemcode = $item['ItemCode'];
  $cantidad = floatval($item['cant_invfis']);

  // Actualiza CAP_INVENTARIO
  $sqlUpdate = "
    UPDATE CAP_INVENTARIO
    SET cant_invfis = $cantidad
    WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = $empleado AND ItemCode = '$itemcode'
  ";
  if (!mssql_query($sqlUpdate, $conn)) {
    echo json_encode(['success' => false, 'error' => 'Error al guardar cantidades: ' . mssql_get_last_message()]);
    exit;
  }

  // Obtener el ID del registro de CAP_INVENTARIO
  $queryId = "
    SELECT id FROM CAP_INVENTARIO
    WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = $empleado AND ItemCode = '$itemcode'
  ";
  $resId = mssql_query($queryId, $conn);
  $rowId = mssql_fetch_assoc($resId);
  $id_inventario = $rowId ? intval($rowId['id']) : 0;

  if ($id_inventario > 0) {
    // Insertar o actualizar en CAP_INVENTARIO_CONTEOS
    $sqlConteo = "
      IF EXISTS (
        SELECT 1 FROM CAP_INVENTARIO_CONTEOS
        WHERE id_inventario = $id_inventario AND nro_conteo = $estatus
      )
      BEGIN
        UPDATE CAP_INVENTARIO_CONTEOS
        SET cantidad = $cantidad,
            usuario = $empleado
        WHERE id_inventario = $id_inventario AND nro_conteo = $estatus
      END
      ELSE
      BEGIN
        INSERT INTO CAP_INVENTARIO_CONTEOS (id_inventario, nro_conteo, cantidad, usuario)
        VALUES ($id_inventario, $estatus, $cantidad, $empleado)
      END
    ";
    if (!mssql_query($sqlConteo, $conn)) {
      echo json_encode(['success' => false, 'error' => 'Error al guardar conteo: ' . mssql_get_last_message()]);
      exit;
    }
  }
}

// --- 2. Confirmar inventario con estatus dinámico ---
$confirm = mssql_query("
  UPDATE CAP_INVENTARIO
  SET estatus = $estatus
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = $empleado
", $conn);

if (!$confirm) {
  echo json_encode(['success' => false, 'error' => 'Error al confirmar inventario']);
  exit;
}

echo json_encode([
  'success' => true,
  'mensaje' => "Inventario confirmado exitosamente en conteo $estatus",
  'estatus' => $estatus
]);
exit;
