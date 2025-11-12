<?php
header('Content-Type: application/json');

// CORS
$origenPermitido = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

// Parámetros
$almacen  = isset($_GET['almacen'])  ? $_GET['almacen']  : null;
$fecha    = isset($_GET['fecha'])    ? $_GET['fecha']    : null;
$empleado = isset($_GET['empleado']) ? intval($_GET['empleado']) : null;
$cia      = isset($_GET['cia'])      ? $_GET['cia']      : null;
$nro_conteo = isset($_GET['nro_conteo']) ? intval($_GET['nro_conteo']) : 1;


if (!$almacen || !$fecha || !$empleado || !$cia) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
  exit;
}

if ($nro_conteo < 1 || $nro_conteo > 3) {
  echo json_encode(['success' => false, 'error' => 'Número de conteo inválido']);
  exit;
}


// Conexión
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

// Sanitizar
$almacen_safe = addslashes($almacen);
$cia_safe     = addslashes($cia);

/* ============================
   VALIDACIÓN DE PERMISOS
   ============================ */

// Buscar ID del usuario a partir del número de empleado
$sqlUser = "SELECT TOP 1 id FROM usuarios WHERE empleado = $empleado";
$resUser = mssql_query($sqlUser, $conn);

if (!$resUser || mssql_num_rows($resUser) === 0) {
  echo json_encode([
    'success' => false,
    'error' => 'Empleado no encontrado en tabla de usuarios.'
  ]);
  exit;
}

$rowUser = mssql_fetch_assoc($resUser);
$usuario_id = intval($rowUser['id']);

// Validar asignación en CAP_CONTEO_CONFIG
$sqlPermiso = "
  SELECT TOP 1 id, tipo_conteo, nro_conteo
  FROM CAP_CONTEO_CONFIG
  WHERE cia = '$cia_safe'
    AND almacen = '$almacen_safe'
    AND estatus = 0
    AND (
         CHARINDEX('[' + CAST($usuario_id AS NVARCHAR) + ']', usuarios_asignados) > 0
      OR CHARINDEX(',' + CAST($usuario_id AS NVARCHAR) + ',', usuarios_asignados) > 0
      OR CHARINDEX(CAST($usuario_id AS NVARCHAR), usuarios_asignados) > 0
    )
";


$resPermiso = mssql_query($sqlPermiso, $conn);

if (!$resPermiso) {
  error_log('Error SQL Permiso: ' . mssql_get_last_message());
  echo json_encode([
    'success' => false,
    'error' => 'Error al validar permisos (CAP_CONTEO_CONFIG) - ' . mssql_get_last_message()
  ]);
  exit;
}

if (mssql_num_rows($resPermiso) === 0) {
  echo json_encode([
    'success' => false,
    'error' => 'El usuario no tiene asignación activa para este almacén o CIA.'
  ]);
  exit;
}

$rowPermiso = mssql_fetch_assoc($resPermiso);
$tipo_conteo = $rowPermiso['tipo_conteo'];
if ($nro_conteo <= 0) {
    $nro_conteo = intval($rowPermiso['nro_conteo']);
}



/* ============================
   VALIDACIÓN DE BLOQUEO FINAL
   ============================ */
$sqlEstatus = "
  SELECT TOP 1 usuario, estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen_safe' AND fecha_inv = '$fecha' AND usuario = $empleado
";
$resEstatus = mssql_query($sqlEstatus, $conn);
if ($resEstatus && $row = mssql_fetch_assoc($resEstatus)) {
  $estatus = intval($row['estatus']);
  $usuario = intval($row['usuario']);

  if ($estatus >= 4) {
    echo json_encode([
      'success' => true,
      'modo' => 'solo lectura',
      'mensaje' => '🔒 Modo: Solo lectura (proceso finalizado)',
      'capturista' => $usuario
    ]);
    exit;
  }
}

/* ============================
   EJECUCIÓN DE SP CONTROL
   ============================ */
$sql = "
  DECLARE @modo NVARCHAR(20);
  EXEC USP_CONTROL_CARGA_INVENTARIO '$almacen_safe', '$fecha', $empleado, '$cia_safe', $nro_conteo, @modo OUTPUT;
  SELECT @modo as modo_resultado;
";

$resSP = mssql_query($sql, $conn);
if (!$resSP) {
  error_log("Error SQL SP: " . mssql_get_last_message());
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

$rowSP = mssql_fetch_assoc($resSP);
if (!$rowSP) {
  echo json_encode(['success' => false, 'error' => 'No se pudo obtener el modo de acceso']);
  exit;
}

$modo       = $rowSP['modo_resultado'];
$capturista = null;
$mensaje    = "";

if ($modo === 'solo lectura') {
  // Verifica si el mismo usuario tiene los registros del conteo
  $sqlUsuario = "
    SELECT TOP 1 usuario
    FROM CAP_INVENTARIO
    WHERE almacen = '$almacen_safe'
      AND fecha_inv = '$fecha'
      AND usuario = $empleado
  ";
  $resUsuario = mssql_query($sqlUsuario, $conn);

  if ($resUsuario && $rowUsuario = mssql_fetch_assoc($resUsuario)) {
    $capturista = intval($rowUsuario['usuario']);
  }

  // ✅ Si es el mismo usuario, permite volver a modo edición
  if ($capturista === $empleado) {
    $modo = 'edicion';
    $mensaje = "✍️ Modo: Edición reabierta para el mismo usuario";
  } else {
    $mensaje = "🔒 Modo: Solo lectura (otro usuario o proceso cerrado)";
  }
} else {
  $mensaje    = "✍️ Modo: Edición habilitada";
  $capturista = $empleado;
}


echo json_encode([
  'success'    => true,
  'modo'       => $modo,
  'mensaje'    => $mensaje,
  'capturista' => $capturista
]);
exit;
