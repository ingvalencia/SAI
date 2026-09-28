<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function normalizarFecha($f) {
    if (!$f) return false;

    $f = str_replace("+", " ", $f);
    $f = str_replace(":AM", " AM", $f);
    $f = str_replace(":PM", " PM", $f);

    $ts = strtotime($f);
    if ($ts === false) return false;

    return date("Y-m-d", $ts);
}

$almacen = isset($_POST['almacen']) ? trim($_POST['almacen']) : null;
$fechaRaw = isset($_POST['fecha']) ? trim($_POST['fecha']) : null;
$cia = isset($_POST['cia']) ? trim($_POST['cia']) : null;
$empleadoElegido = isset($_POST['empleado_elegido']) ? trim($_POST['empleado_elegido']) : null;

if (!$almacen || !$fechaRaw || !$cia || !$empleadoElegido) {
    echo json_encode([
        "success" => false,
        "error" => "Faltan parámetros requeridos"
    ]);
    exit;
}

$fecha = normalizarFecha($fechaRaw);

if ($fecha === false) {
    echo json_encode([
        "success" => false,
        "error" => "Fecha no válida"
    ]);
    exit;
}

$server = "192.168.0.174";
$user = "sa";
$pass = "P@ssw0rd";
$db = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
    echo json_encode([
        "success" => false,
        "error" => "No se pudo conectar a la base de datos"
    ]);
    exit;
}

mssql_select_db($db, $conn);

$almacenSafe = str_replace("'", "''", $almacen);
$ciaSafe = str_replace("'", "''", $cia);
$empleadoElegidoSafe = str_replace("'", "''", $empleadoElegido);

$sqlId = "
    SELECT TOP 1 id
    FROM usuarios
    WHERE empleado = '$empleadoElegidoSafe'
";

$resId = mssql_query($sqlId, $conn);

if (!$resId || mssql_num_rows($resId) === 0) {
    echo json_encode([
        "success" => false,
        "error" => "Empleado elegido no existe"
    ]);
    exit;
}

$rowId = mssql_fetch_assoc($resId);
$idElegido = intval($rowId['id']);

$sqlYaAsignado = "
    SELECT TOP 1
        id,
        usuarios_asignados,
        estatus
    FROM CAP_CONTEO_CONFIG
    WHERE cia = '$ciaSafe'
      AND almacen = '$almacenSafe'
      AND tipo_conteo = 'Brigada'
      AND nro_conteo = 3
      AND CONVERT(date, fecha_asignacion) = '$fecha'
    ORDER BY id DESC
";

$resYaAsignado = mssql_query($sqlYaAsignado, $conn);

if (!$resYaAsignado) {
    echo json_encode([
        "success" => false,
        "error" => mssql_get_last_message()
    ]);
    exit;
}

if (mssql_num_rows($resYaAsignado) > 0) {
    echo json_encode([
        "success" => false,
        "error" => "El tercer conteo ya fue asignado previamente."
    ]);
    exit;
}

$sqlElegido = "
    SELECT TOP 1
        c.id,
        c.cia,
        c.almacen,
        c.tipo_conteo,
        c.usuarios_asignados,
        c.fecha_asignacion,
        c.orden_trabajo,
        c.nro_conteo
    FROM CAP_CONTEO_CONFIG c
    CROSS APPLY OPENJSON(c.usuarios_asignados) uj
    WHERE c.cia = '$ciaSafe'
      AND c.almacen = '$almacenSafe'
      AND c.tipo_conteo = 'Brigada'
      AND c.estatus IN (0,1)
      AND c.nro_conteo IN (1,2)
      AND CONVERT(date, c.fecha_asignacion) = '$fecha'
      AND TRY_CONVERT(INT, uj.value) = $idElegido
    ORDER BY c.nro_conteo ASC, c.id ASC
";

$resElegido = mssql_query($sqlElegido, $conn);

if (!$resElegido || mssql_num_rows($resElegido) === 0) {
    echo json_encode([
        "success" => false,
        "error" => "No existe un conteo 1 o 2 asignado al usuario elegido para esta fecha"
    ]);
    exit;
}

$rowElegido = mssql_fetch_assoc($resElegido);

$usuariosAsignados = str_replace("'", "''", $rowElegido['usuarios_asignados']);
$ordenTrabajo = $rowElegido['orden_trabajo'] !== null
    ? intval($rowElegido['orden_trabajo'])
    : 0;

$sqlInsertTercero = "
    INSERT INTO CAP_CONTEO_CONFIG
    (
        cia,
        almacen,
        tipo_conteo,
        nro_conteo,
        usuarios_asignados,
        fecha_asignacion,
        estatus,
        orden_trabajo
    )
    VALUES
    (
        '$ciaSafe',
        '$almacenSafe',
        'Brigada',
        3,
        '$usuariosAsignados',
        '$fecha',
        0,
        $ordenTrabajo
    )
";

$resInsertTercero = mssql_query($sqlInsertTercero, $conn);

if (!$resInsertTercero) {
    echo json_encode([
        "success" => false,
        "error" => mssql_get_last_message()
    ]);
    exit;
}

$sqlOtro = "
    SELECT TOP 1 c.id
    FROM CAP_CONTEO_CONFIG c
    WHERE c.cia = '$ciaSafe'
      AND c.almacen = '$almacenSafe'
      AND c.tipo_conteo = 'Brigada'
      AND c.estatus IN (0,1)
      AND c.nro_conteo IN (1,2)
      AND CONVERT(date, c.fecha_asignacion) = '$fecha'
      AND c.id <> " . intval($rowElegido['id']) . "
    ORDER BY c.nro_conteo ASC, c.id ASC
";

$resOtro = mssql_query($sqlOtro, $conn);

if ($resOtro && mssql_num_rows($resOtro) > 0) {
    $rowOtro = mssql_fetch_assoc($resOtro);
    $idRowOtro = intval($rowOtro['id']);

    $sqlBloq = "
        UPDATE CAP_CONTEO_CONFIG
        SET estatus = 1
        WHERE id = $idRowOtro
    ";

    $resBloq = mssql_query($sqlBloq, $conn);

    if (!$resBloq) {
        echo json_encode([
            "success" => false,
            "error" => mssql_get_last_message()
        ]);
        exit;
    }
}

echo json_encode([
    "success" => true,
    "mensaje" => "Tercer conteo asignado correctamente",
    "empleado_asignado" => $empleadoElegido
]);

exit;
?>
