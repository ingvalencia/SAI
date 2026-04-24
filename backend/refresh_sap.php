<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function esc($v) {
    return str_replace("'", "''", trim((string)$v));
}

$almacen = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;
$fecha   = isset($_GET['fecha'])   ? trim($_GET['fecha'])   : null;
$cia     = isset($_GET['cia'])     ? trim($_GET['cia'])     : null;

$grupo = isset($_GET['grupo']) ? trim($_GET['grupo']) : null;

$responsable_nombre = isset($_GET['responsable_nombre'])
    ? trim($_GET['responsable_nombre'])
    : null;

$responsable_empleado = isset($_GET['responsable_empleado'])
    ? trim($_GET['responsable_empleado'])
    : null;

$usuario_sesion = isset($_GET['usuario_sesion'])
    ? trim($_GET['usuario_sesion'])
    : null;

if (!$almacen || !$fecha || !$cia) {
    echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
    exit;
}

if (!$responsable_nombre || !$responsable_empleado) {
    echo json_encode(["success" => false, "error" => "Faltan datos del responsable"]);
    exit;
}

$conn = mssql_connect("192.168.0.174", "sa", "P@ssw0rd");
if (!$conn) {
    echo json_encode(["success" => false, "error" => "Error de conexión"]);
    exit;
}

mssql_select_db("SAP_PROCESOS", $conn);

$almacenes = array_filter(array_map('trim', explode(',', $almacen)));

if (count($almacenes) === 0) {
    echo json_encode(["success" => false, "error" => "No se recibieron almacenes válidos"]);
    exit;
}

$almacenesEsc = array_map('esc', $almacenes);
$listaAlmacenes = "'" . implode("','", $almacenesEsc) . "'";

$almacen_csv = esc(implode(',', $almacenes));
$cia_safe = esc($cia);
$fecha_safe = esc($fecha);
$grupo_safe = $grupo !== null && trim($grupo) !== "" ? esc($grupo) : null;
$responsable_nombre_safe = esc($responsable_nombre);
$responsable_empleado_safe = esc($responsable_empleado);
$usuario_sesion_safe = $usuario_sesion !== null && trim($usuario_sesion) !== "" ? esc($usuario_sesion) : null;

$grupo_sql = $grupo_safe !== null ? "'$grupo_safe'" : "NULL";
$usuario_sesion_sql = $usuario_sesion_safe !== null ? "'$usuario_sesion_safe'" : "NULL";

$usuario_admin = 0;

$q = mssql_query("
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN sap_refrescado = 1 THEN 1 ELSE 0 END) AS refrescados
    FROM CAP_INVENTARIO
    WHERE almacen IN ($listaAlmacenes)
      AND fecha_inv = '$fecha_safe'
      AND cias = '$cia_safe'
", $conn);

if (!$q) {
    echo json_encode(["success" => false, "error" => "Error validando inventarios: " . mssql_get_last_message()]);
    exit;
}

$row = mssql_fetch_assoc($q);

if (!$row || intval($row['total']) === 0) {
    echo json_encode(["success" => false, "error" => "Inventarios no encontrados"]);
    exit;
}

if (intval($row['refrescados']) > 0) {
    echo json_encode(["success" => false, "error" => "SAP ya fue refrescado"]);
    exit;
}

$qVersion = mssql_query("
    SELECT ISNULL(MAX(version_foto), 0) + 1 AS nueva_version
    FROM CAP_INVENTARIO_SAP_FOTO
    WHERE fecha_inv = '$fecha_safe'
      AND cia = '$cia_safe'
      AND almacen IN ($listaAlmacenes)
", $conn);

if (!$qVersion) {
    echo json_encode(["success" => false, "error" => "Error obteniendo versión de fotografía: " . mssql_get_last_message()]);
    exit;
}

$rowVersion = mssql_fetch_assoc($qVersion);
$nuevaVersion = intval($rowVersion['nueva_version']);

$qDesactiva = mssql_query("
    UPDATE CAP_INVENTARIO_SAP_FOTO
    SET es_activa = 0
    WHERE almacen IN ($listaAlmacenes)
      AND fecha_inv = '$fecha_safe'
      AND cia = '$cia_safe'
      AND es_activa = 1
", $conn);

if (!$qDesactiva) {
    echo json_encode(["success" => false, "error" => "Error desactivando fotografía activa: " . mssql_get_last_message()]);
    exit;
}

$sp = mssql_query("
    EXEC dbo.USP_INVEN_SAP_MULTI
        @almacen = '$almacen_csv',
        @fecint  = '$fecha_safe',
        @usuario = $usuario_admin,
        @cia     = '$cia_safe'
", $conn);

if (!$sp) {
    echo json_encode(["success" => false, "error" => "Error al ejecutar USP_INVEN_SAP_MULTI: " . mssql_get_last_message()]);
    exit;
}

$insertados = 0;
$almacenesConFoto = [];

while ($row = mssql_fetch_assoc($sp)) {
    $codfam     = isset($row['Codfam']) ? esc($row['Codfam']) : '';
    $familia    = isset($row['Familia']) ? esc($row['Familia']) : '';
    $codsubfam  = isset($row['Codsubfam']) ? esc($row['Codsubfam']) : '';
    $subfamilia = isset($row['Subfamilia']) ? esc($row['Subfamilia']) : '';
    $itemCode   = isset($row['Codigo sap']) ? esc($row['Codigo sap']) : '';
    $itemName   = isset($row['Nombre']) ? esc($row['Nombre']) : '';
    $almacenRow = isset($row['Almacen']) ? esc($row['Almacen']) : '';
    $invSap     = isset($row['Inventario_sap']) ? floatval($row['Inventario_sap']) : 0;
    $codebars   = isset($row['CodeBars']) ? esc($row['CodeBars']) : '';
    $precio     = isset($row['precio']) ? floatval($row['precio']) : 0;

    if ($almacenRow === '' || $itemCode === '') {
        continue;
    }

    $sqlInsert = "
        INSERT INTO CAP_INVENTARIO_SAP_FOTO (
            cia,
            almacen,
            fecha_inv,
            version_foto,
            tipo_foto,
            es_activa,
            motivo_foto,
            cod_fam,
            familia,
            cod_subfam,
            subfamilia,
            ItemCode,
            ItemName,
            codebars,
            inventario_sap_foto,
            precio_foto,
            fecha_hora_foto,
            usuario_genero
        )
        VALUES (
            '$cia_safe',
            '$almacenRow',
            '$fecha_safe',
            $nuevaVersion,
            'REFRESH',
            1,
            'Refresh SAP',
            '$codfam',
            '$familia',
            '$codsubfam',
            '$subfamilia',
            '$itemCode',
            '$itemName',
            '$codebars',
            $invSap,
            $precio,
            GETDATE(),
            $usuario_admin
        )
    ";

    $qInsert = mssql_query($sqlInsert, $conn);

    if (!$qInsert) {
        echo json_encode([
            "success" => false,
            "error" => "Error insertando fotografía SAP: " . mssql_get_last_message(),
            "almacen" => $almacenRow,
            "itemCode" => $itemCode,
            "sql" => $sqlInsert
        ]);
        exit;
    }

    $insertados++;
    $almacenesConFoto[strtoupper($almacenRow)] = true;
}

mssql_free_result($sp);

if ($insertados === 0) {
    echo json_encode(["success" => false, "error" => "USP_INVEN_SAP_MULTI no devolvió registros para generar la fotografía"]);
    exit;
}

$faltantes = [];

foreach ($almacenes as $alm) {
    if (!isset($almacenesConFoto[strtoupper($alm)])) {
        $faltantes[] = $alm;
    }
}

if (count($faltantes) > 0) {
    echo json_encode([
        "success" => false,
        "error" => "No se generó fotografía para todos los almacenes del grupo",
        "almacenes_faltantes" => $faltantes,
        "version_foto" => $nuevaVersion
    ]);
    exit;
}

$qUpdate = mssql_query("
    UPDATE CAP_INVENTARIO
    SET sap_refrescado = 1
    WHERE almacen IN ($listaAlmacenes)
      AND fecha_inv = '$fecha_safe'
      AND cias = '$cia_safe'
", $conn);

if (!$qUpdate) {
    echo json_encode(["success" => false, "error" => "Error marcando sap_refrescado: " . mssql_get_last_message()]);
    exit;
}

$qLog = mssql_query("
    INSERT INTO CAP_REFRESH_SAP_LOG (
        cia,
        grupo,
        almacenes,
        fecha_inventario,
        responsable_nombre,
        responsable_empleado,
        usuario_sesion,
        fecha_registro,
        estatus_anterior,
        sap_refrescado,
        observaciones
    )
    VALUES (
        '$cia_safe',
        $grupo_sql,
        '$almacen_csv',
        '$fecha_safe',
        '$responsable_nombre_safe',
        '$responsable_empleado_safe',
        $usuario_sesion_sql,
        GETDATE(),
        4,
        1,
        'Refresh SAP ejecutado desde mapa de operaciones'
    )
", $conn);

if (!$qLog) {
    echo json_encode([
        "success" => false,
        "error" => "El refresh se ejecutó, pero no se pudo registrar la bitácora: " . mssql_get_last_message()
    ]);
    exit;
}

echo json_encode([
    "success" => true,
    "mensaje" => "Datos SAP refrescados correctamente",
    "version_foto" => $nuevaVersion,
    "almacenes_procesados" => $almacenes,
    "total_registros_insertados" => $insertados
]);
exit;
?>
