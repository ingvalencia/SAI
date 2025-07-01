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

// 🟢 1. Verificar si ya fue confirmado o cerrado (estatus 1 o 2)
$sqlConfirmado = "
  SELECT TOP 1 usuario, estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND estatus IN (1, 2)
";
$resConf = mssql_query($sqlConfirmado, $conn);
if ($resConf && $rowConf = mssql_fetch_assoc($resConf)) {
  $usuario_confirmo = intval($rowConf['usuario']);
  $estatus_confirmado = intval($rowConf['estatus']);

  $mensajeFinal = $estatus_confirmado === 1
    ? "🔒 Modo: Solo lectura (por confirmación previa)"
    : "✅ Modo: Solo lectura (diferencias confirmadas)";

  echo json_encode([
    'success' => true,
    'modo' => 'solo lectura',
    'mensaje' => $mensajeFinal,
    'capturista' => $usuario_confirmo
  ]);
  exit;
}

// 🟢 2. Ejecutar SP (el SP ya inserta si es necesario y retorna el modo)
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
$capturista = null;
$mensaje = "";

// 🟢 3. Verificar capturista activo solo si modo = solo lectura
if ($modo === 'solo lectura') {
  $sqlUsuario = "
    SELECT TOP 1 usuario
    FROM CAP_INVENTARIO
    WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND estatus = 0
  ";
  $resUsuario = mssql_query($sqlUsuario, $conn);
  if ($resUsuario && $rowUsuario = mssql_fetch_assoc($resUsuario)) {
    $capturista = intval($rowUsuario['usuario']);
  }

  $mensaje = ($capturista !== null && $capturista != $empleado)
    ? "🔒 Modo: Solo lectura (otro usuario está capturando)"
    : "🔒 Modo: Solo lectura (por confirmación previa)";
} else {
  $mensaje = "✍️ Modo: Edición habilitada";
  $capturista = $empleado;
}

// 🟢 4. Devolver al frontend
echo json_encode([
  'success' => true,
  'modo' => $modo,
  'mensaje' => $mensaje,
  'capturista' => $capturista
]);
exit;
