<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ===========================
// Parámetros obligatorios
// ===========================
$almacen  = isset($_POST['almacen'])  ? trim($_POST['almacen']) : null;
$fechaRaw = isset($_POST['fecha'])    ? trim($_POST['fecha'])   : null;
$cia      = isset($_POST['cia'])      ? trim($_POST['cia'])     : null;
$empleadoElegido = isset($_POST['empleado_elegido']) ? trim($_POST['empleado_elegido']) : null;

if (!$almacen || !$fechaRaw || !$cia || !$empleadoElegido) {
    echo json_encode(["success" => false, "error" => "Faltan parámetros requeridos"]);
    exit;
}

// ===========================
// Normalizar fecha SQL
// ===========================
$fechaSQL = date("Y-m-d", strtotime($fechaRaw));
if (!$fechaSQL) {
    echo json_encode(["success" => false, "error" => "Fecha inválida"]);
    exit;
}

// ===========================
// Conexión SQL
// ===========================
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

// ===========================
// 1. Obtener ID interno del empleado
// ===========================
$sqlId = "SELECT TOP 1 id FROM usuarios WHERE empleado = '$empleadoElegido'";
$resId = mssql_query($sqlId, $conn);

if (!$resId || mssql_num_rows($resId) === 0) {
    echo json_encode(["success" => false, "error" => "Empleado elegido no existe"]);
    exit;
}
$rowId = mssql_fetch_assoc($resId);
$idElegido = intval($rowId['id']);

// ===========================
// 2. Revisar si YA existe un tercer conteo
// ===========================
$sqlCheck = "
    SELECT TOP 1 id
    FROM CAP_CONTEO_CONFIG
    WHERE almacen = '$almacen'
      AND cia = '$cia'
      AND nro_conteo = 3
";
$resCheck = mssql_query($sqlCheck, $conn);
$rowCheck = mssql_fetch_assoc($resCheck);

// ===========================
// 3. Preparar json de usuarios asignados
// ===========================
$usuarios_asignados = "[$idElegido]";

// ===========================
// 4. SI YA EXISTE → ACTUALIZAR
// ===========================
if ($rowCheck) {

    $idConfig = intval($rowCheck['id']);

    $sqlUpdate = "
        UPDATE CAP_CONTEO_CONFIG
        SET usuarios_asignados = '$usuarios_asignados',
            estatus = 0,
            fecha_asignacion = '$fechaSQL'
        WHERE id = $idConfig
    ";

    $resUpdate = mssql_query($sqlUpdate, $conn);

    if (!$resUpdate) {
        echo json_encode(["success" => false, "error" => mssql_get_last_message()]);
        exit;
    }

    echo json_encode([
        "success" => true,
        "accion" => "update",
        "mensaje" => "Tercer conteo actualizado correctamente",
        "empleado_asignado" => $empleadoElegido
    ]);
    exit;
}

// ===========================
// 5. NO EXISTE → INSERTAR
// ===========================
$sqlInsert = "
    INSERT INTO CAP_CONTEO_CONFIG (
        cia, almacen, fecha_asignacion, tipo_conteo, nro_conteo, usuarios_asignados, estatus
    )
    VALUES (
        '$cia',
        '$almacen',
        '$fechaSQL',
        'Brigada',
        3,
        '$usuarios_asignados',
        0
    )
";

$resInsert = mssql_query($sqlInsert, $conn);

if (!$resInsert) {
    echo json_encode(["success" => false, "error" => mssql_get_last_message()]);
    exit;
}

echo json_encode([
    "success" => true,
    "accion" => "insert",
    "mensaje" => "Tercer conteo asignado correctamente",
    "empleado_asignado" => $empleadoElegido
]);

exit;
?>
