<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$almacen = isset($_POST['almacen']) ? $_POST['almacen'] : null;
$fecha   = isset($_POST['fecha']) ? $_POST['fecha'] : null;
$empleado = isset($_POST['empleado']) ? $_POST['empleado'] : null;
$cia = isset($_POST['cia']) ? $_POST['cia'] : null;
$nro_conteo = isset($_POST['nro_conteo']) ? intval($_POST['nro_conteo']) : 1;

if (!$almacen || !$fecha || !$empleado || !$cia || $nro_conteo <= 0) {
    echo json_encode(array(
        "success" => false,
        "error" => "Faltan parámetros"
    ));
    exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS_DESARROLLO";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
    echo json_encode(array(
        "success" => false,
        "error" => "Error de conexión"
    ));
    exit;
}

mssql_select_db($db, $conn);

$almacen_safe = str_replace("'", "''", $almacen);
$fecha_safe = str_replace("'", "''", $fecha);
$empleado_safe = str_replace("'", "''", $empleado);
$cia_safe = str_replace("'", "''", $cia);

$sqlConfig = "
    SELECT TOP 1
        id,
        tipo_conteo
    FROM CAP_CONTEO_CONFIG
    WHERE cia = '$cia_safe'
      AND almacen = '$almacen_safe'
      AND CAST(fecha_asignacion AS DATE) = CAST('$fecha_safe' AS DATE)
      AND nro_conteo = $nro_conteo
    ORDER BY id DESC
";

$resConfig = mssql_query($sqlConfig, $conn);

$id_config = "NULL";
$tipo_conteo = "NULL";

if ($resConfig && $rowConfig = mssql_fetch_assoc($resConfig)) {
    $id_config = intval($rowConfig['id']);
    $tipo_conteo = "'" . str_replace("'", "''", $rowConfig['tipo_conteo']) . "'";
}

$sqlAbierta = "
    SELECT TOP 1 id
    FROM CAP_INVENTARIO_SESIONES
    WHERE cia = '$cia_safe'
      AND almacen = '$almacen_safe'
      AND fecha_inventario = '$fecha_safe'
      AND empleado = '$empleado_safe'
      AND nro_conteo = $nro_conteo
      AND estatus = 0
    ORDER BY id DESC
";

$resAbierta = mssql_query($sqlAbierta, $conn);

if ($resAbierta && $rowAbierta = mssql_fetch_assoc($resAbierta)) {
    echo json_encode(array(
        "success" => true,
        "mensaje" => "Sesión de conteo ya estaba abierta",
        "id_sesion" => intval($rowAbierta['id'])
    ));
    exit;
}

$sqlInsert = "
    INSERT INTO CAP_INVENTARIO_SESIONES (
        cia,
        almacen,
        fecha_inventario,
        empleado,
        nro_conteo,
        id_config,
        tipo_conteo,
        fecha_inicio,
        estatus,
        fecha_creacion
    )
    VALUES (
        '$cia_safe',
        '$almacen_safe',
        '$fecha_safe',
        '$empleado_safe',
        $nro_conteo,
        $id_config,
        $tipo_conteo,
        GETDATE(),
        0,
        GETDATE()
    )
";

$ok = mssql_query($sqlInsert, $conn);

if (!$ok) {
    echo json_encode(array(
        "success" => false,
        "error" => "No se pudo iniciar la sesión de conteo"
    ));
    exit;
}

$resId = mssql_query("SELECT @@IDENTITY AS id", $conn);
$rowId = mssql_fetch_assoc($resId);

echo json_encode(array(
    "success" => true,
    "mensaje" => "Sesión de conteo iniciada",
    "id_sesion" => intval($rowId['id'])
));
exit;
?>
