<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$almacen  = isset($_POST['almacen']) ? trim($_POST['almacen']) : null;
$fecha    = isset($_POST['fecha']) ? trim($_POST['fecha']) : null;
$empleado = isset($_POST['empleado']) ? trim($_POST['empleado']) : null;
$cia      = isset($_POST['cia']) ? trim($_POST['cia']) : null;
$estatus  = isset($_POST['estatus']) ? intval($_POST['estatus']) : 1;
$datos    = isset($_POST['datos']) ? json_decode($_POST['datos'], true) : array();

if (!$almacen || !$fecha || !$empleado || !$cia) {
    echo json_encode(array(
        "success" => false,
        "error" => "Faltan parámetros"
    ));
    exit;
}

if (!is_array($datos) || count($datos) === 0) {
    echo json_encode(array(
        "success" => false,
        "error" => "No se recibieron artículos para guardar"
    ));
    exit;
}

if (!in_array($estatus, array(1, 2, 3))) {
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
        "error" => "Error de conexión"
    ));
    exit;
}

if (!mssql_select_db($db, $conn)) {
    echo json_encode(array(
        "success" => false,
        "error" => "No se pudo seleccionar la base de datos"
    ));
    exit;
}

function responderError($conn, $mensaje)
{
    mssql_query("IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION", $conn);

    echo json_encode(array(
        "success" => false,
        "error" => $mensaje
    ));

    mssql_close($conn);
    exit;
}

function copiarConteoTresACuatro($conn, $almacen, $fecha, $empleado, $cia)
{
    $almacen_safe = str_replace("'", "''", $almacen);
    $fecha_safe = str_replace("'", "''", $fecha);
    $cia_safe = str_replace("'", "''", $cia);
    $empleado_safe = str_replace("'", "''", $empleado);

    $sqlUpdate = "
        UPDATE c4
        SET c4.cantidad = c3.cantidad,
            c4.usuario = c3.usuario,
            c4.fecha = c3.fecha,
            c4.estatus = c3.estatus
        FROM CAP_INVENTARIO_CONTEOS c4
        INNER JOIN CAP_INVENTARIO_CONTEOS c3
            ON c3.id_inventario = c4.id_inventario
           AND c3.nro_conteo = 3
        INNER JOIN CAP_INVENTARIO i
            ON i.id = c3.id_inventario
        WHERE c4.nro_conteo = 7
          AND i.almacen = '$almacen_safe'
          AND CONVERT(date, i.fecha_inv) = '$fecha_safe'
          AND i.cias = '$cia_safe'
          AND c3.usuario = '$empleado_safe'
    ";

    if (!mssql_query($sqlUpdate, $conn)) {
        return false;
    }

    $sqlInsert = "
        INSERT INTO CAP_INVENTARIO_CONTEOS
        (
            id_inventario,
            nro_conteo,
            cantidad,
            usuario,
            fecha,
            estatus
        )
        SELECT
            c3.id_inventario,
            7,
            c3.cantidad,
            c3.usuario,
            c3.fecha,
            c3.estatus
        FROM CAP_INVENTARIO_CONTEOS c3
        INNER JOIN CAP_INVENTARIO i
            ON i.id = c3.id_inventario
        WHERE c3.nro_conteo = 3
          AND i.almacen = '$almacen_safe'
          AND CONVERT(date, i.fecha_inv) = '$fecha_safe'
          AND i.cias = '$cia_safe'
          AND c3.usuario = '$empleado_safe'
          AND NOT EXISTS
          (
              SELECT 1
              FROM CAP_INVENTARIO_CONTEOS c4
              WHERE c4.id_inventario = c3.id_inventario
                AND c4.nro_conteo = 7
          )
    ";

    return mssql_query($sqlInsert, $conn) !== false;
}

function cerrarConfiguracionesYLocales($conn, $almacen, $fecha, $cia)
{
    $almacen_safe = str_replace("'", "''", $almacen);
    $fecha_safe = str_replace("'", "''", $fecha);
    $cia_safe = str_replace("'", "''", $cia);

    $sqlConfigs = "
        SELECT
            id,
            usuarios_asignados
        FROM CAP_CONTEO_CONFIG
        WHERE almacen = '$almacen_safe'
          AND cia = '$cia_safe'
          AND CONVERT(date, fecha_asignacion) = '$fecha_safe'
    ";

    $resConfigs = mssql_query($sqlConfigs, $conn);

    if (!$resConfigs) {
        return false;
    }

    while ($rowCfg = mssql_fetch_assoc($resConfigs)) {

        $id_cfg = intval($rowCfg['id']);
        $usuariosAsignados = $rowCfg['usuarios_asignados'];

        $qCerrarConfig = mssql_query("
            UPDATE CAP_CONTEO_CONFIG
            SET estatus = 2
            WHERE id = $id_cfg
        ", $conn);

        if (!$qCerrarConfig) {
            return false;
        }

        $usuariosAsignados = str_replace(
            array('[', ']', ' ', '"'),
            '',
            $usuariosAsignados
        );

        $ids = explode(',', $usuariosAsignados);

        foreach ($ids as $uid) {

            $uid = intval($uid);

            if ($uid > 0) {

                $qLocal = mssql_query("
                    UPDATE usuario_local
                    SET activo = 0
                    WHERE usuario_id = $uid
                      AND local_codigo = '$almacen_safe'
                      AND cia = '$cia_safe'
                ", $conn);

                if (!$qLocal) {
                    return false;
                }
            }
        }
    }

    return true;
}

$alm_safe = str_replace("'", "''", $almacen);
$cia_safe = str_replace("'", "''", $cia);
$fecha_safe = str_replace("'", "''", $fecha);
$empleado_safe = str_replace("'", "''", $empleado);

$sqlUsuario = "
    SELECT TOP 1 id
    FROM usuarios
    WHERE empleado = '$empleado_safe'
";

$resUsuario = mssql_query($sqlUsuario, $conn);

if (!$resUsuario || mssql_num_rows($resUsuario) === 0) {
    echo json_encode(array(
        "success" => false,
        "error" => "Empleado no encontrado"
    ));
    mssql_close($conn);
    exit;
}

$rowUsuario = mssql_fetch_assoc($resUsuario);
$usuario_id = intval($rowUsuario['id']);

$sqlBrig = "
    SELECT TOP 1 tipo_conteo
    FROM CAP_CONTEO_CONFIG
    WHERE almacen = '$alm_safe'
      AND cia = '$cia_safe'
      AND CONVERT(date, fecha_asignacion) = '$fecha_safe'
      AND nro_conteo = $estatus
";

$resBrig = mssql_query($sqlBrig, $conn);

if (!$resBrig) {
    echo json_encode(array(
        "success" => false,
        "error" => mssql_get_last_message()
    ));
    mssql_close($conn);
    exit;
}

$esBrigada = false;

if ($r = mssql_fetch_assoc($resBrig)) {
    if (strtolower(trim($r['tipo_conteo'])) === 'brigada') {
        $esBrigada = true;
    }
}

$id_config_actual = 0;

$sqlConfigActual = "
    SELECT TOP 1 c.id
    FROM CAP_CONTEO_CONFIG c
    CROSS APPLY OPENJSON(c.usuarios_asignados) uj
    WHERE c.almacen = '$alm_safe'
      AND c.cia = '$cia_safe'
      AND CONVERT(date, c.fecha_asignacion) = '$fecha_safe'
      AND c.nro_conteo = $estatus
      AND
      (
          TRY_CONVERT(INT, uj.value) = $usuario_id
          OR TRY_CONVERT(INT, uj.value) = TRY_CONVERT(INT, '$empleado_safe')
      )
    ORDER BY c.id DESC
";

$resConfigActual = mssql_query($sqlConfigActual, $conn);

if (!$resConfigActual) {
    echo json_encode(array(
        "success" => false,
        "error" => mssql_get_last_message()
    ));
    mssql_close($conn);
    exit;
}

if ($rowConfigActual = mssql_fetch_assoc($resConfigActual)) {
    $id_config_actual = intval($rowConfigActual['id']);
}

if ($esBrigada && $id_config_actual <= 0) {
    echo json_encode(array(
        "success" => false,
        "error" => "No se encontró la configuración activa correspondiente al conteo"
    ));
    mssql_close($conn);
    exit;
}

if (!mssql_query("BEGIN TRANSACTION", $conn)) {
    echo json_encode(array(
        "success" => false,
        "error" => "No se pudo iniciar la transacción"
    ));
    mssql_close($conn);
    exit;
}

$registrosGuardados = 0;

foreach ($datos as $d) {

    $id_inv = 0;

    if (isset($d['id']) && intval($d['id']) > 0) {
        $id_inv = intval($d['id']);
    } elseif (isset($d['id_inventario']) && intval($d['id_inventario']) > 0) {
        $id_inv = intval($d['id_inventario']);
    }

    $cant_raw = isset($d['cant_invfis']) ? trim((string)$d['cant_invfis']) : '0';
    $cant_raw = str_replace(',', '.', $cant_raw);
    $cant = is_numeric($cant_raw) ? floatval($cant_raw) : 0;
    $cant_sql = number_format($cant, 4, '.', '');

    if ($id_inv <= 0) {
        continue;
    }

    $qValidarInventario = mssql_query("
        SELECT TOP 1 id
        FROM CAP_INVENTARIO
        WHERE id = $id_inv
          AND almacen = '$alm_safe'
          AND CONVERT(date, fecha_inv) = '$fecha_safe'
          AND cias = '$cia_safe'
    ", $conn);

    if (!$qValidarInventario) {
        responderError($conn, mssql_get_last_message());
    }

    if (mssql_num_rows($qValidarInventario) === 0) {
        responderError(
            $conn,
            "Se recibió un artículo que no corresponde al almacén, fecha o compañía actual"
        );
    }

    $chk = mssql_query("
        SELECT COUNT(*) AS n
        FROM CAP_INVENTARIO_CONTEOS
        WHERE id_inventario = $id_inv
          AND nro_conteo = $estatus
    ", $conn);

    if (!$chk) {
        responderError($conn, mssql_get_last_message());
    }

    $row = mssql_fetch_assoc($chk);

    if (intval($row['n']) > 0) {

        $qUpdateConteo = mssql_query("
            UPDATE CAP_INVENTARIO_CONTEOS
            SET cantidad = $cant_sql,
                fecha = GETDATE(),
                usuario = '$empleado_safe',
                estatus = 1
            WHERE id_inventario = $id_inv
              AND nro_conteo = $estatus
        ", $conn);

        if (!$qUpdateConteo) {
            responderError(
                $conn,
                "Error guardando UPDATE de conteo. ID: $id_inv | Conteo: $estatus | Cantidad: $cant_sql | SQL: " . mssql_get_last_message()
            );
        }

    } else {

        $qInsertConteo = mssql_query("
            INSERT INTO CAP_INVENTARIO_CONTEOS
            (
                id_inventario,
                nro_conteo,
                cantidad,
                usuario,
                fecha,
                estatus
            )
            VALUES
            (
                $id_inv,
                $estatus,
                $cant_sql,
                '$empleado_safe',
                GETDATE(),
                1
            )
        ", $conn);

        if (!$qInsertConteo) {
            responderError(
                $conn,
                "Error guardando INSERT de conteo. ID: $id_inv | Conteo: $estatus | Cantidad: $cant_sql | SQL: " . mssql_get_last_message()
            );
        }
    }

    $registrosGuardados++;
}

if ($registrosGuardados <= 0) {
    responderError(
        $conn,
        "No se guardó ningún artículo del conteo"
    );
}

$qValidarGuardado = mssql_query("
    SELECT COUNT(*) AS registros
    FROM CAP_INVENTARIO_CONTEOS ct
    INNER JOIN CAP_INVENTARIO i
        ON i.id = ct.id_inventario
    WHERE i.almacen = '$alm_safe'
      AND CONVERT(date, i.fecha_inv) = '$fecha_safe'
      AND i.cias = '$cia_safe'
      AND ct.nro_conteo = $estatus
      AND ct.usuario = '$empleado_safe'
", $conn);

if (!$qValidarGuardado) {
    responderError($conn, mssql_get_last_message());
}

$rowValidarGuardado = mssql_fetch_assoc($qValidarGuardado);
$totalGuardadoBD = intval($rowValidarGuardado['registros']);

if ($totalGuardadoBD <= 0) {
    responderError(
        $conn,
        "El conteo no pudo verificarse después de guardar"
    );
}

$qSesion = mssql_query("
    UPDATE CAP_INVENTARIO_SESIONES
    SET fecha_fin = GETDATE(),
        minutos_totales = CAST(
            DATEDIFF(SECOND, fecha_inicio, GETDATE()) / 60.0
            AS DECIMAL(10,2)
        ),
        estatus = 1
    WHERE cia = '$cia_safe'
      AND almacen = '$alm_safe'
      AND CONVERT(date, fecha_inventario) = '$fecha_safe'
      AND empleado = '$empleado_safe'
      AND nro_conteo = $estatus
      AND estatus = 0
", $conn);

if (!$qSesion) {
    responderError($conn, mssql_get_last_message());
}

if ($estatus === 3) {

    if (!copiarConteoTresACuatro(
        $conn,
        $almacen,
        $fecha,
        $empleado,
        $cia
    )) {
        responderError(
            $conn,
            "No se pudo generar el Conteo 4 interno: " . mssql_get_last_message()
        );
    }
}

if ($id_config_actual > 0) {

    $qConfigActual = mssql_query("
        UPDATE CAP_CONTEO_CONFIG
        SET estatus = 1
        WHERE id = $id_config_actual
    ", $conn);

    if (!$qConfigActual) {
        responderError($conn, mssql_get_last_message());
    }
}

$qUpdateInventarioActual = mssql_query("
    UPDATE CAP_INVENTARIO
    SET estatus = $estatus
    WHERE almacen = '$alm_safe'
      AND CONVERT(date, fecha_inv) = '$fecha_safe'
      AND cias = '$cia_safe'
", $conn);

if (!$qUpdateInventarioActual) {
    responderError($conn, mssql_get_last_message());
}

if ($esBrigada) {

    if ($estatus === 3) {

        $qValidarC3 = mssql_query("
            SELECT COUNT(*) AS registros_c3
            FROM CAP_INVENTARIO_CONTEOS ct
            INNER JOIN CAP_INVENTARIO i
                ON i.id = ct.id_inventario
            WHERE i.almacen = '$alm_safe'
              AND CONVERT(date, i.fecha_inv) = '$fecha_safe'
              AND i.cias = '$cia_safe'
              AND ct.nro_conteo = 3
              AND ct.usuario = '$empleado_safe'
              AND ct.estatus = 1
        ", $conn);

        if (!$qValidarC3) {
            responderError($conn, mssql_get_last_message());
        }

        $rowC3 = mssql_fetch_assoc($qValidarC3);
        $registrosC3 = intval($rowC3['registros_c3']);

        if ($registrosC3 <= 0) {
            responderError(
                $conn,
                "No existen registros válidos del Conteo 3 para cerrar el proceso"
            );
        }

        $qCerrarInventarioC3 = mssql_query("
            UPDATE CAP_INVENTARIO
            SET estatus = 4
            WHERE almacen = '$alm_safe'
              AND CONVERT(date, fecha_inv) = '$fecha_safe'
              AND cias = '$cia_safe'
              AND estatus < 5
        ", $conn);

        if (!$qCerrarInventarioC3) {
            responderError($conn, mssql_get_last_message());
        }

        if (!cerrarConfiguracionesYLocales(
            $conn,
            $almacen,
            $fecha,
            $cia
        )) {
            responderError($conn, mssql_get_last_message());
        }

        if (!mssql_query("COMMIT TRANSACTION", $conn)) {
            responderError($conn, "No se pudo confirmar la transacción");
        }

        echo json_encode(array(
            "success" => true,
            "mensaje" => "Conteo 3 guardado correctamente. Proceso finalizado.",
            "next_status" => 4,
            "hay_diferencias" => true,
            "requiere_tercer_conteo" => false,
            "conteo_cerrado" => true,
            "registros_guardados" => $registrosGuardados
        ));

        mssql_close($conn);
        exit;
    }

    $sqlSesiones = "
        SELECT COUNT(DISTINCT nro_conteo) AS conteos_finalizados
        FROM CAP_INVENTARIO_SESIONES
        WHERE cia = '$cia_safe'
          AND almacen = '$alm_safe'
          AND CONVERT(date, fecha_inventario) = '$fecha_safe'
          AND nro_conteo IN (1,2)
          AND estatus = 1
    ";

    $resSesiones = mssql_query($sqlSesiones, $conn);

    if (!$resSesiones) {
        responderError($conn, mssql_get_last_message());
    }

    $conteos_finalizados = 0;

    if ($rowSesiones = mssql_fetch_assoc($resSesiones)) {
        $conteos_finalizados = intval($rowSesiones['conteos_finalizados']);
    }

    if ($conteos_finalizados < 2) {

        if (!mssql_query("COMMIT TRANSACTION", $conn)) {
            responderError($conn, "No se pudo confirmar la transacción");
        }

        echo json_encode(array(
            "success" => true,
            "mensaje" => "Conteo guardado correctamente. Pendiente finalizar ambos conteos de la brigada.",
            "next_status" => $estatus,
            "hay_diferencias" => false,
            "requiere_tercer_conteo" => false,
            "conteo_cerrado" => true,
            "registros_guardados" => $registrosGuardados
        ));

        mssql_close($conn);
        exit;
    }

    $sqlComparacion = "
        ;WITH Conteos AS
        (
            SELECT
                i.ItemCode,
                MAX(
                    CASE
                        WHEN ct.nro_conteo = 1
                        THEN ct.cantidad
                        ELSE NULL
                    END
                ) AS conteo1,
                MAX(
                    CASE
                        WHEN ct.nro_conteo = 2
                        THEN ct.cantidad
                        ELSE NULL
                    END
                ) AS conteo2
            FROM CAP_INVENTARIO i
            INNER JOIN CAP_INVENTARIO_CONTEOS ct
                ON ct.id_inventario = i.id
            WHERE i.almacen = '$alm_safe'
              AND CONVERT(date, i.fecha_inv) = '$fecha_safe'
              AND i.cias = '$cia_safe'
              AND ct.nro_conteo IN (1,2)
            GROUP BY i.ItemCode
        )
        SELECT
            COUNT(*) AS total_diferencias
        FROM CAP_INVENTARIO_SAP_FOTO f
        LEFT JOIN Conteos c
            ON c.ItemCode = f.ItemCode
        WHERE f.almacen = '$alm_safe'
          AND CONVERT(date, f.fecha_inv) = '$fecha_safe'
          AND f.cia = '$cia_safe'
          AND f.es_activa = 1
          AND
          (
              c.conteo1 IS NULL
              OR c.conteo2 IS NULL
              OR ABS(
                  CAST(ISNULL(c.conteo1,0) AS DECIMAL(18,4))
                  -
                  CAST(ISNULL(f.inventario_sap_foto,0) AS DECIMAL(18,4))
              ) > 0.0001
              OR ABS(
                  CAST(ISNULL(c.conteo2,0) AS DECIMAL(18,4))
                  -
                  CAST(ISNULL(f.inventario_sap_foto,0) AS DECIMAL(18,4))
              ) > 0.0001
          )
    ";

    $resComparacion = mssql_query($sqlComparacion, $conn);

    if (!$resComparacion) {
        responderError($conn, mssql_get_last_message());
    }

    $total_diferencias = 0;

    if ($rowComparacion = mssql_fetch_assoc($resComparacion)) {
        $total_diferencias = intval($rowComparacion['total_diferencias']);
    }

    if ($total_diferencias > 0) {

        if (!mssql_query("COMMIT TRANSACTION", $conn)) {
            responderError($conn, "No se pudo confirmar la transacción");
        }

        echo json_encode(array(
            "success" => true,
            "mensaje" => "Se detectaron diferencias contra SAP. Se requiere tercer conteo.",
            "next_status" => 3,
            "hay_diferencias" => true,
            "requiere_tercer_conteo" => true,
            "conteo_cerrado" => false,
            "total_diferencias" => $total_diferencias,
            "registros_guardados" => $registrosGuardados
        ));

        mssql_close($conn);
        exit;
    }

    $qCerrarInventario = mssql_query("
        UPDATE CAP_INVENTARIO
        SET estatus = 4
        WHERE almacen = '$alm_safe'
          AND CONVERT(date, fecha_inv) = '$fecha_safe'
          AND cias = '$cia_safe'
          AND estatus < 5
    ", $conn);

    if (!$qCerrarInventario) {
        responderError($conn, mssql_get_last_message());
    }

    if (!cerrarConfiguracionesYLocales(
        $conn,
        $almacen,
        $fecha,
        $cia
    )) {
        responderError($conn, mssql_get_last_message());
    }

    if (!mssql_query("COMMIT TRANSACTION", $conn)) {
        responderError($conn, "No se pudo confirmar la transacción");
    }

    echo json_encode(array(
        "success" => true,
        "mensaje" => "Conteos 1 y 2 coinciden contra SAP. Inventario cerrado correctamente.",
        "next_status" => 4,
        "hay_diferencias" => false,
        "requiere_tercer_conteo" => false,
        "conteo_cerrado" => true,
        "registros_guardados" => $registrosGuardados
    ));

    mssql_close($conn);
    exit;
}

$url = "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/comparar_inventarios.php?almacen=" . urlencode($almacen) .
       "&fecha=" . urlencode($fecha) .
       "&usuario=" . urlencode($empleado) .
       "&cia=" . urlencode($cia);

$resp = @file_get_contents($url);
$res = json_decode($resp, true);

$hay_diferencias = false;

if ($res && isset($res['hay_dif_mio_vs_sap'])) {
    $hay_diferencias = boolval($res['hay_dif_mio_vs_sap']);
}

$next_status = $estatus;
$mensaje_final = "";

if ($hay_diferencias) {

    if ($estatus < 3) {

        $next_status = $estatus + 1;

        $qActualizarEstado = mssql_query("
            UPDATE CAP_INVENTARIO
            SET estatus = $next_status
            WHERE almacen = '$alm_safe'
              AND CONVERT(date, fecha_inv) = '$fecha_safe'
              AND cias = '$cia_safe'
        ", $conn);

        if (!$qActualizarEstado) {
            responderError($conn, mssql_get_last_message());
        }

        $q = mssql_query("
            SELECT id
            FROM CAP_INVENTARIO
            WHERE almacen = '$alm_safe'
              AND CONVERT(date, fecha_inv) = '$fecha_safe'
              AND cias = '$cia_safe'
        ", $conn);

        if (!$q) {
            responderError($conn, mssql_get_last_message());
        }

        while ($r = mssql_fetch_assoc($q)) {

            $id_inv = intval($r['id']);

            $qExisteConteo = mssql_query("
                SELECT COUNT(*) AS n
                FROM CAP_INVENTARIO_CONTEOS
                WHERE id_inventario = $id_inv
                  AND nro_conteo = $next_status
            ", $conn);

            if (!$qExisteConteo) {
                responderError($conn, mssql_get_last_message());
            }

            $rowExisteConteo = mssql_fetch_assoc($qExisteConteo);

            if (intval($rowExisteConteo['n']) === 0) {

                $qInsertSiguiente = mssql_query("
                    INSERT INTO CAP_INVENTARIO_CONTEOS
                    (
                        id_inventario,
                        nro_conteo,
                        cantidad,
                        usuario,
                        fecha,
                        estatus
                    )
                    VALUES
                    (
                        $id_inv,
                        $next_status,
                        0,
                        '$empleado_safe',
                        GETDATE(),
                        1
                    )
                ", $conn);

                if (!$qInsertSiguiente) {
                    responderError($conn, mssql_get_last_message());
                }
            }
        }

        $mensaje_final = "Se detectaron diferencias. Se ha preparado el Conteo $next_status.";

    } else {

        $qCerrar = mssql_query("
            UPDATE CAP_INVENTARIO
            SET estatus = 4
            WHERE almacen = '$alm_safe'
              AND CONVERT(date, fecha_inv) = '$fecha_safe'
              AND cias = '$cia_safe'
        ", $conn);

        if (!$qCerrar) {
            responderError($conn, mssql_get_last_message());
        }

        $next_status = 4;
        $mensaje_final = "Conteo 3 finalizado con diferencias. Proceso cerrado.";
    }

} else {

    $qCerrar = mssql_query("
        UPDATE CAP_INVENTARIO
        SET estatus = 4
        WHERE almacen = '$alm_safe'
          AND CONVERT(date, fecha_inv) = '$fecha_safe'
          AND cias = '$cia_safe'
    ", $conn);

    if (!$qCerrar) {
        responderError($conn, mssql_get_last_message());
    }

    $next_status = 4;
    $mensaje_final = "No se encontraron diferencias. Proceso completado.";
}

if (!mssql_query("COMMIT TRANSACTION", $conn)) {
    responderError($conn, "No se pudo confirmar la transacción");
}

echo json_encode(array(
    "success" => true,
    "mensaje" => $mensaje_final,
    "next_status" => $next_status,
    "hay_diferencias" => $hay_diferencias,
    "registros_guardados" => $registrosGuardados
));

mssql_close($conn);
exit;
?>
