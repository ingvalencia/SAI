<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/* ==========================================
   Función para normalizar la fecha a Y-m-d
========================================== */
function normalizarFecha($f) {
    if (!$f) return false;

    $f = str_replace("+", " ", $f);
    $f = str_replace(":AM", " AM", $f);
    $f = str_replace(":PM", " PM", $f);

    $ts = strtotime($f);
    if ($ts === false) return false;

    return date("Y-m-d", $ts);
}

/* ==========================================
   Parámetros obligatorios
========================================== */
$almacen  = isset($_POST['almacen'])  ? trim($_POST['almacen']) : null;
$fechaRaw = isset($_POST['fecha'])    ? trim($_POST['fecha'])   : null;
$cia      = isset($_POST['cia'])      ? trim($_POST['cia'])     : null;
$empleadoElegido = isset($_POST['empleado_elegido']) ? trim($_POST['empleado_elegido']) : null;

if (!$almacen || !$fechaRaw || !$cia || !$empleadoElegido) {
    echo json_encode(["success" => false, "error" => "Faltan parámetros requeridos"]);
    exit;
}

$fecha = normalizarFecha($fechaRaw);
if ($fecha === false) {
    echo json_encode(["success" => false, "error" => "Fecha no válida"]);
    exit;
}

/* ==========================================
   Conexión SQL
========================================== */
$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
    echo json_encode(["success" => false, "error" => "No se pudo conectar a la base de datos"]);
    exit;
}
mssql_select_db($db, $conn);

/* ==========================================
   1) Obtener ID interno del usuario elegido
========================================== */
$sqlId = "SELECT TOP 1 id FROM usuarios WHERE empleado = '$empleadoElegido'";
$resId = mssql_query($sqlId, $conn);

if (!$resId || mssql_num_rows($resId) === 0) {
    echo json_encode(["success" => false, "error" => "Empleado elegido no existe"]);
    exit;
}

$rowId = mssql_fetch_assoc($resId);
$idElegido = intval($rowId['id']);

/* ==========================================
   2) Buscar su registro de conteo 1 ó 2
      (el que vamos a mover a conteo 3)
========================================== */
$sqlElegido = "
    SELECT TOP 1 id, nro_conteo
    FROM CAP_CONTEO_CONFIG
    WHERE cia = '$cia'
      AND almacen = '$almacen'
      AND tipo_conteo = 'Brigada'
      AND estatus = 0
      AND nro_conteo IN (1,2)
      AND CONVERT(date, fecha_asignacion) = '$fecha'
      AND usuarios_asignados LIKE '%[$idElegido]%'
";
$resElegido = mssql_query($sqlElegido, $conn);

if (!$resElegido || mssql_num_rows($resElegido) === 0) {
    echo json_encode([
        "success" => false,
        "error"   => "No existe un conteo 1 o 2 asignado al usuario elegido para esta fecha"
    ]);
    exit;
}

$rowElegido = mssql_fetch_assoc($resElegido);
$idRowElegido = intval($rowElegido['id']);

/* ==========================================
   3) Actualizar ese registro a conteo 3
      (estatus sigue 0 = activo)
========================================== */
$sqlUpdateElegido = "
    UPDATE CAP_CONTEO_CONFIG
    SET nro_conteo = 3,
        fecha_asignacion = '$fecha',
        estatus = 0
    WHERE id = $idRowElegido
";
$resUpdE = mssql_query($sqlUpdateElegido, $conn);

if (!$resUpdE) {
    echo json_encode(["success" => false, "error" => mssql_get_last_message()]);
    exit;
}

/* ==========================================
   4) Localizar al otro usuario (perdedor)
      y marcarlo con estatus = 1 (bloqueado)
========================================== */
$sqlOtro = "
    SELECT TOP 1 id, usuarios_asignados
    FROM CAP_CONTEO_CONFIG
    WHERE cia = '$cia'
      AND almacen = '$almacen'
      AND tipo_conteo = 'Brigada'
      AND estatus = 0
      AND nro_conteo IN (1,2)
      AND CONVERT(date, fecha_asignacion) = '$fecha'
      AND id <> $idRowElegido
";
$resOtro = mssql_query($sqlOtro, $conn);

if ($resOtro && mssql_num_rows($resOtro) > 0) {
    $rowOtro = mssql_fetch_assoc($resOtro);
    $idRowOtro = intval($rowOtro['id']);

    // marcarlo como bloqueado usando estatus = 1
    $sqlBloq = "
        UPDATE CAP_CONTEO_CONFIG
        SET estatus = 1
        WHERE id = $idRowOtro
    ";
    $resBloq = mssql_query($sqlBloq, $conn);

    if (!$resBloq) {
        echo json_encode(["success" => false, "error" => mssql_get_last_message()]);
        exit;
    }
}

/* ==========================================
   Respuesta final
========================================== */
echo json_encode([
    "success"          => true,
    "mensaje"          => "Tercer conteo asignado correctamente",
    "empleado_asignado"=> $empleadoElegido
]);

exit;
?>
