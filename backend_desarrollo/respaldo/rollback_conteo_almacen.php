<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$server = "192.168.0.174";
$user = "sa";
$pass = "P@ssw0rd";
$db = "SAP_PROCESOS";

$cia = isset($_POST['cia']) ? trim($_POST['cia']) : null;
$almacen = isset($_POST['almacen']) ? trim($_POST['almacen']) : null;
$fecha = isset($_POST['fecha']) ? trim($_POST['fecha']) : null;
$empleado_admin = isset($_POST['empleado_admin']) ? trim($_POST['empleado_admin']) : null;
$accion = isset($_POST['accion']) ? trim($_POST['accion']) : null;
$motivo = isset($_POST['motivo']) ? trim($_POST['motivo']) : null;

if (!$cia || !$almacen || !$fecha || !$empleado_admin || !$accion || !$motivo) {
  echo json_encode(array(
    "success" => false,
    "error" => "Faltan parámetros obligatorios"
  ));
  exit;
}

function limpiar($valor) {
  return str_replace("'", "''", trim($valor));
}

function crearTraceId($cia, $almacen, $fecha, $empleado, $accion) {
  return "ROLL-" . date("YmdHis") . "-" . $almacen . "-" . $empleado . "-" . substr(md5($cia . $almacen . $fecha . $empleado . $accion . microtime()), 0, 8);
}

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(array(
    "success" => false,
    "error" => "No se pudo conectar a SQL Server"
  ));
  exit;
}

mssql_select_db($db, $conn);

$ciaSql = limpiar($cia);
$almacenSql = limpiar($almacen);
$fechaSql = limpiar($fecha);
$empleadoSql = limpiar($empleado_admin);
$accionSql = limpiar($accion);
$motivoSql = limpiar($motivo);
$traceId = crearTraceId($ciaSql, $almacenSql, $fechaSql, $empleadoSql, $accionSql);

$accionesPermitidas = array(
  "REGRESAR_A_CONTEO_1",
  "REGRESAR_A_CONTEO_2",
  "REINICIAR_ALMACEN"
);

if (!in_array($accion, $accionesPermitidas)) {
  echo json_encode(array(
    "success" => false,
    "error" => "Acción no permitida"
  ));
  exit;
}

$sqlRol = "
SELECT COUNT(*) AS total
FROM usuarios u
INNER JOIN usuario_rol ur ON ur.usuario_id = u.id
WHERE u.empleado = '$empleadoSql'
  AND u.activo = 1
  AND ur.rol_id IN (1,2)
";

$resRol = mssql_query($sqlRol, $conn);
$rowRol = $resRol ? mssql_fetch_assoc($resRol) : null;
$puedeEjecutar = $rowRol ? intval($rowRol["total"]) : 0;

if ($puedeEjecutar <= 0) {
  echo json_encode(array(
    "success" => false,
    "error" => "El usuario no tiene permiso para ejecutar rollback técnico"
  ));
  exit;
}

$sqlBloqueoSap = "
SELECT COUNT(*) AS total
FROM CAP_INVENTARIO_CIERRE c
LEFT JOIN CAP_SAP_SIGNAL s ON s.id_cierre = c.id_cierre
WHERE c.cia = '$ciaSql'
  AND c.almacen = '$almacenSql'
  AND c.fecha_inventario = '$fechaSql'
  AND (
    ISNULL(c.procesado_sap, 0) = 1
    OR ISNULL(s.procesado, 0) = 1
  )
";

$resBloqueoSap = mssql_query($sqlBloqueoSap, $conn);
$rowBloqueoSap = $resBloqueoSap ? mssql_fetch_assoc($resBloqueoSap) : null;
$bloqueadoSap = $rowBloqueoSap ? intval($rowBloqueoSap["total"]) : 0;

if ($bloqueadoSap > 0) {
  echo json_encode(array(
    "success" => false,
    "error" => "No se puede hacer rollback porque el inventario ya fue procesado por SAP"
  ));
  exit;
}

$sqlEstadoAntes = "
SELECT
  COUNT(*) AS total_articulos,
  MAX(estatus) AS estatus_actual,
  (SELECT COUNT(*) FROM CAP_INVENTARIO_CONTEOS c INNER JOIN CAP_INVENTARIO i ON i.id = c.id_inventario WHERE i.cias = '$ciaSql' AND i.almacen = '$almacenSql' AND i.fecha_inv = '$fechaSql' AND c.nro_conteo = 1) AS conteo_1,
  (SELECT COUNT(*) FROM CAP_INVENTARIO_CONTEOS c INNER JOIN CAP_INVENTARIO i ON i.id = c.id_inventario WHERE i.cias = '$ciaSql' AND i.almacen = '$almacenSql' AND i.fecha_inv = '$fechaSql' AND c.nro_conteo = 2) AS conteo_2,
  (SELECT COUNT(*) FROM CAP_INVENTARIO_CONTEOS c INNER JOIN CAP_INVENTARIO i ON i.id = c.id_inventario WHERE i.cias = '$ciaSql' AND i.almacen = '$almacenSql' AND i.fecha_inv = '$fechaSql' AND c.nro_conteo = 3) AS conteo_3
FROM CAP_INVENTARIO
WHERE cias = '$ciaSql'
  AND almacen = '$almacenSql'
  AND fecha_inv = '$fechaSql'
";

$resEstadoAntes = mssql_query($sqlEstadoAntes, $conn);
$estadoAntes = $resEstadoAntes ? mssql_fetch_assoc($resEstadoAntes) : null;

$totalArticulos = $estadoAntes ? intval($estadoAntes["total_articulos"]) : 0;
if ($totalArticulos <= 0) {
  echo json_encode(array(
    "success" => false,
    "error" => "No existe inventario para ese almacén, CIA y fecha"
  ));
  exit;
}

$borrarDesdeConteo = 0;
$nuevoEstatus = 0;

if ($accion === "REGRESAR_A_CONTEO_1") {
  $borrarDesdeConteo = 2;
  $nuevoEstatus = 1;
}

if ($accion === "REGRESAR_A_CONTEO_2") {
  $borrarDesdeConteo = 3;
  $nuevoEstatus = 2;
}

if ($accion === "REINICIAR_ALMACEN") {
  $borrarDesdeConteo = 1;
  $nuevoEstatus = 0;
}

mssql_query("BEGIN TRANSACTION", $conn);

$sqlLogInicio = "
INSERT INTO CAP_LOG_OPERACION (
  trace_id,
  empleado,
  cia,
  almacen,
  fecha_inventario,
  nro_conteo,
  modulo,
  endpoint,
  accion,
  resultado,
  regla_negocio,
  mensaje,
  request_json,
  ip,
  user_agent
) VALUES (
  '$traceId',
  '$empleadoSql',
  '$ciaSql',
  '$almacenSql',
  '$fechaSql',
  $nuevoEstatus,
  'MONITOR_TECNICO',
  'rollback_conteo_almacen.php',
  '$accionSql',
  'INICIADO',
  'ROLLBACK_TECNICO',
  '$motivoSql',
  'estatus_actual=" . ($estadoAntes ? intval($estadoAntes["estatus_actual"]) : 0) . "; c1=" . ($estadoAntes ? intval($estadoAntes["conteo_1"]) : 0) . "; c2=" . ($estadoAntes ? intval($estadoAntes["conteo_2"]) : 0) . "; c3=" . ($estadoAntes ? intval($estadoAntes["conteo_3"]) : 0) . "',
  '" . limpiar(isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '') . "',
  '" . limpiar(isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '') . "'
)
";

if (!mssql_query($sqlLogInicio, $conn)) {
  mssql_query("ROLLBACK TRANSACTION", $conn);
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  exit;
}

$sqlEliminarAjustes = "
DELETE a
FROM CAP_INVENTARIO_AJUSTES_SAP a
INNER JOIN CAP_INVENTARIO_CIERRE c ON c.id_cierre = a.id_cierre
WHERE c.cia = '$ciaSql'
  AND c.almacen = '$almacenSql'
  AND c.fecha_inventario = '$fechaSql'
";

if (!mssql_query($sqlEliminarAjustes, $conn)) {
  mssql_query("ROLLBACK TRANSACTION", $conn);
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  exit;
}

$sqlEliminarDetalleCierre = "
DELETE d
FROM CAP_INVENTARIO_CIERRE_DET d
INNER JOIN CAP_INVENTARIO_CIERRE c ON c.id_cierre = d.id_cierre
WHERE c.cia = '$ciaSql'
  AND c.almacen = '$almacenSql'
  AND c.fecha_inventario = '$fechaSql'
";

if (!mssql_query($sqlEliminarDetalleCierre, $conn)) {
  mssql_query("ROLLBACK TRANSACTION", $conn);
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  exit;
}

$sqlEliminarSignal = "
DELETE s
FROM CAP_SAP_SIGNAL s
INNER JOIN CAP_INVENTARIO_CIERRE c ON c.id_cierre = s.id_cierre
WHERE c.cia = '$ciaSql'
  AND c.almacen = '$almacenSql'
  AND c.fecha_inventario = '$fechaSql'
  AND ISNULL(s.procesado, 0) = 0
";

if (!mssql_query($sqlEliminarSignal, $conn)) {
  mssql_query("ROLLBACK TRANSACTION", $conn);
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  exit;
}

$sqlEliminarCierre = "
DELETE FROM CAP_INVENTARIO_CIERRE
WHERE cia = '$ciaSql'
  AND almacen = '$almacenSql'
  AND fecha_inventario = '$fechaSql'
  AND ISNULL(procesado_sap, 0) = 0
";

if (!mssql_query($sqlEliminarCierre, $conn)) {
  mssql_query("ROLLBACK TRANSACTION", $conn);
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  exit;
}

$sqlEliminarConteos = "
DELETE c
FROM CAP_INVENTARIO_CONTEOS c
INNER JOIN CAP_INVENTARIO i ON i.id = c.id_inventario
WHERE i.cias = '$ciaSql'
  AND i.almacen = '$almacenSql'
  AND i.fecha_inv = '$fechaSql'
  AND c.nro_conteo >= $borrarDesdeConteo
";

if (!mssql_query($sqlEliminarConteos, $conn)) {
  mssql_query("ROLLBACK TRANSACTION", $conn);
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  exit;
}

$filasConteosEliminadas = mssql_rows_affected($conn);

$sqlActualizarInventario = "
UPDATE CAP_INVENTARIO
SET estatus = $nuevoEstatus
WHERE cias = '$ciaSql'
  AND almacen = '$almacenSql'
  AND fecha_inv = '$fechaSql'
";

if (!mssql_query($sqlActualizarInventario, $conn)) {
  mssql_query("ROLLBACK TRANSACTION", $conn);
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  exit;
}

$sqlLogFin = "
INSERT INTO CAP_LOG_OPERACION (
  trace_id,
  empleado,
  cia,
  almacen,
  fecha_inventario,
  nro_conteo,
  modulo,
  endpoint,
  accion,
  resultado,
  regla_negocio,
  mensaje,
  response_json,
  ip,
  user_agent
) VALUES (
  '$traceId',
  '$empleadoSql',
  '$ciaSql',
  '$almacenSql',
  '$fechaSql',
  $nuevoEstatus,
  'MONITOR_TECNICO',
  'rollback_conteo_almacen.php',
  '$accionSql',
  'OK',
  'ROLLBACK_TECNICO',
  '$motivoSql',
  'nuevo_estatus=$nuevoEstatus; conteos_eliminados=$filasConteosEliminadas',
  '" . limpiar(isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '') . "',
  '" . limpiar(isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '') . "'
)
";

if (!mssql_query($sqlLogFin, $conn)) {
  mssql_query("ROLLBACK TRANSACTION", $conn);
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  exit;
}

mssql_query("COMMIT TRANSACTION", $conn);

echo json_encode(array(
  "success" => true,
  "trace_id" => $traceId,
  "mensaje" => "Rollback ejecutado correctamente",
  "accion" => $accion,
  "nuevo_estatus" => $nuevoEstatus,
  "conteos_eliminados" => $filasConteosEliminadas
));
exit;
?>
