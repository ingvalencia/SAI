<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$id_inventario = isset($_POST['id_inventario']) ? intval($_POST['id_inventario']) : null;
$nro_conteo    = isset($_POST['nro_conteo']) ? intval($_POST['nro_conteo']) : null;
$cantidad      = isset($_POST['cantidad']) ? floatval($_POST['cantidad']) : null;
$usuario       = isset($_POST['usuario']) ? trim($_POST['usuario']) : null;

if ($id_inventario === null || $nro_conteo === null || $cantidad === null || $usuario === null) {
    echo json_encode(array(
        "success" => false,
        "error" => "Faltan parámetros"
    ));
    exit;
}

if (!in_array($nro_conteo, array(1, 2, 3, 7))) {
    echo json_encode(array(
        "success" => false,
        "error" => "Número de conteo inválido"
    ));
    exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
    echo json_encode(array(
        "success" => false,
        "error" => "No se pudo conectar a SQL Server"
    ));
    exit;
}

if (!mssql_select_db($db, $conn)) {
    echo json_encode(array(
        "success" => false,
        "error" => "No se pudo seleccionar la base de datos"
    ));
    mssql_close($conn);
    exit;
}

$usuario_safe = str_replace("'", "''", $usuario);

$sqlUID = "
    SELECT TOP 1
        id
    FROM usuarios
    WHERE empleado = '$usuario_safe'
";

$resUID = mssql_query($sqlUID, $conn);

if (!$resUID || mssql_num_rows($resUID) === 0) {
    echo json_encode(array(
        "success" => false,
        "error" => "Usuario no encontrado"
    ));
    mssql_close($conn);
    exit;
}

$rowUID = mssql_fetch_assoc($resUID);
$usuario_id = intval($rowUID['id']);

$sqlInventario = "
    SELECT TOP 1
        id,
        almacen,
        cias,
        CONVERT(VARCHAR(10), fecha_inv, 120) AS fecha_inv
    FROM CAP_INVENTARIO
    WHERE id = $id_inventario
";

$resInventario = mssql_query($sqlInventario, $conn);

if (!$resInventario || mssql_num_rows($resInventario) === 0) {
    echo json_encode(array(
        "success" => false,
        "error" => "Inventario no encontrado"
    ));
    mssql_close($conn);
    exit;
}

$rowInventario = mssql_fetch_assoc($resInventario);

$almacen = str_replace("'", "''", trim($rowInventario['almacen']));
$cia     = str_replace("'", "''", trim($rowInventario['cias']));
$fecha   = str_replace("'", "''", trim($rowInventario['fecha_inv']));

$sqlAsign = "
    SELECT TOP 1
        c.id,
        c.nro_conteo,
        c.estatus
    FROM CAP_CONTEO_CONFIG c
    CROSS APPLY OPENJSON(c.usuarios_asignados) uj
    WHERE TRY_CONVERT(INT, uj.value) = $usuario_id
      AND c.cia = '$cia'
      AND c.almacen = '$almacen'
      AND CONVERT(date, c.fecha_asignacion) = '$fecha'
      AND c.nro_conteo = $nro_conteo
      AND c.estatus = 0
    ORDER BY c.id DESC
";

$resAsign = mssql_query($sqlAsign, $conn);

if (!$resAsign) {
    echo json_encode(array(
        "success" => false,
        "error" => "Error validando asignación: " . mssql_get_last_message()
    ));
    mssql_close($conn);
    exit;
}

if (mssql_num_rows($resAsign) === 0) {

    $sqlAsignacionActual = "
        SELECT TOP 1
            c.id,
            c.nro_conteo,
            c.estatus
        FROM CAP_CONTEO_CONFIG c
        CROSS APPLY OPENJSON(c.usuarios_asignados) uj
        WHERE TRY_CONVERT(INT, uj.value) = $usuario_id
          AND c.cia = '$cia'
          AND c.almacen = '$almacen'
          AND CONVERT(date, c.fecha_asignacion) = '$fecha'
          AND c.estatus = 0
        ORDER BY
            c.nro_conteo DESC,
            c.id DESC
    ";

    $resAsignacionActual = mssql_query($sqlAsignacionActual, $conn);

    if (!$resAsignacionActual) {
        echo json_encode(array(
            "success" => false,
            "error" => "Error validando conteo activo: " . mssql_get_last_message()
        ));
        mssql_close($conn);
        exit;
    }

    if (mssql_num_rows($resAsignacionActual) > 0) {

        $rowAsignacionActual = mssql_fetch_assoc($resAsignacionActual);
        $conteoCorrecto = intval($rowAsignacionActual['nro_conteo']);

        echo json_encode(array(
            "success" => false,
            "error" => "Intento inválido: debe capturar el conteo $conteoCorrecto."
        ));

        mssql_close($conn);
        exit;
    }

    if ($nro_conteo === 3) {

        $sqlTercerConteo = "
            SELECT TOP 1
                c.id,
                TRY_CONVERT(INT, uj.value) AS usuario_id,
                u.empleado,
                u.nombre
            FROM CAP_CONTEO_CONFIG c
            CROSS APPLY OPENJSON(c.usuarios_asignados) uj
            LEFT JOIN usuarios u
                ON u.id = TRY_CONVERT(INT, uj.value)
            WHERE c.cia = '$cia'
              AND c.almacen = '$almacen'
              AND CONVERT(date, c.fecha_asignacion) = '$fecha'
              AND c.nro_conteo = 3
              AND c.estatus = 0
            ORDER BY c.id DESC
        ";

        $resTercerConteo = mssql_query($sqlTercerConteo, $conn);

        if (!$resTercerConteo) {
            echo json_encode(array(
                "success" => false,
                "error" => "Error validando tercer conteo: " . mssql_get_last_message()
            ));
            mssql_close($conn);
            exit;
        }

        if ($rowTercerConteo = mssql_fetch_assoc($resTercerConteo)) {

            $empleadoTercerConteo = isset($rowTercerConteo['empleado'])
                ? trim($rowTercerConteo['empleado'])
                : '';

            echo json_encode(array(
                "success" => false,
                "error" => "Usuario bloqueado: el tercer conteo está asignado al empleado $empleadoTercerConteo."
            ));

            mssql_close($conn);
            exit;
        }
    }

    echo json_encode(array(
        "success" => false,
        "error" => "No tiene asignado ningún conteo activo."
    ));

    mssql_close($conn);
    exit;
}

$rowAsign = mssql_fetch_assoc($resAsign);

$nro_conteo_asignado = intval($rowAsign['nro_conteo']);

if ($nro_conteo_asignado !== $nro_conteo) {
    echo json_encode(array(
        "success" => false,
        "error" => "Intento inválido: debe capturar el conteo $nro_conteo_asignado."
    ));
    mssql_close($conn);
    exit;
}

$cantidad_sql = number_format($cantidad, 4, '.', '');

$existe = mssql_query("
    SELECT COUNT(*) AS total
    FROM CAP_INVENTARIO_CONTEOS
    WHERE id_inventario = $id_inventario
      AND nro_conteo = $nro_conteo
", $conn);

if (!$existe) {
    echo json_encode(array(
        "success" => false,
        "error" => "Error validando conteo existente: " . mssql_get_last_message()
    ));
    mssql_close($conn);
    exit;
}

$row = mssql_fetch_assoc($existe);

if ($row && intval($row['total']) > 0) {

    $sql = "
        UPDATE CAP_INVENTARIO_CONTEOS
        SET cantidad = $cantidad_sql,
            usuario = '$usuario_safe',
            fecha = GETDATE()
        WHERE id_inventario = $id_inventario
          AND nro_conteo = $nro_conteo
    ";

} else {

    $sql = "
        INSERT INTO CAP_INVENTARIO_CONTEOS
        (
            id_inventario,
            nro_conteo,
            cantidad,
            usuario,
            fecha
        )
        VALUES
        (
            $id_inventario,
            $nro_conteo,
            $cantidad_sql,
            '$usuario_safe',
            GETDATE()
        )
    ";
}

$res = mssql_query($sql, $conn);

if (!$res) {
    echo json_encode(array(
        "success" => false,
        "error" => "Error SQL: " . mssql_get_last_message()
    ));
    mssql_close($conn);
    exit;
}

$updInv = "
    UPDATE CAP_INVENTARIO
    SET cant_invfis = $cantidad_sql
    WHERE id = $id_inventario
";

$resInv = mssql_query($updInv, $conn);

if (!$resInv) {
    echo json_encode(array(
        "success" => false,
        "error" => "Error actualizando inventario: " . mssql_get_last_message()
    ));
    mssql_close($conn);
    exit;
}

echo json_encode(array(
    "success" => true,
    "mensaje" => "Conteo $nro_conteo guardado correctamente"
));

mssql_close($conn);
exit;
?>
