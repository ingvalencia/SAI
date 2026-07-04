<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS_DESARROLLO";

function limpiar($valor) {
    return str_replace("'", "''", trim((string)$valor));
}

function responder($data) {
    echo json_encode($data);
    exit;
}

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
    responder(array(
        "success" => false,
        "error" => "Error de conexión SQL Server"
    ));
}

if (!mssql_select_db($db, $conn)) {
    responder(array(
        "success" => false,
        "error" => "Error seleccionando base de datos"
    ));
}

$cia         = isset($_GET['cia']) ? limpiar($_GET['cia']) : "";
$cef         = isset($_GET['cef']) ? limpiar($_GET['cef']) : "";
$almacen     = isset($_GET['almacen']) ? limpiar($_GET['almacen']) : "";
$empleado    = isset($_GET['empleado']) ? limpiar($_GET['empleado']) : "";
$fecha_desde = isset($_GET['fecha_desde']) ? limpiar($_GET['fecha_desde']) : "";
$fecha_hasta = isset($_GET['fecha_hasta']) ? limpiar($_GET['fecha_hasta']) : "";
$nro_conteo  = isset($_GET['nro_conteo']) ? intval($_GET['nro_conteo']) : 0;
$id_config   = isset($_GET['id_config']) ? intval($_GET['id_config']) : 0;
$estatus     = isset($_GET['estatus']) ? intval($_GET['estatus']) : -1;

$where = array();

if ($cia !== "") {
    $where[] = "s.cia = '" . $cia . "'";
}

if ($almacen !== "") {
    $where[] = "s.almacen = '" . $almacen . "'";
} else if ($cef !== "") {
    $where[] = "s.almacen LIKE '" . $cef . "-%'";
}

if ($empleado !== "") {
    $where[] = "s.empleado = '" . $empleado . "'";
}

if ($fecha_desde !== "") {
    $where[] = "s.fecha_inventario >= '" . $fecha_desde . "'";
}

if ($fecha_hasta !== "") {
    $where[] = "s.fecha_inventario <= '" . $fecha_hasta . "'";
}

if ($nro_conteo > 0) {
    $where[] = "s.nro_conteo = " . $nro_conteo;
}

if ($id_config > 0) {
    $where[] = "s.id_config = " . $id_config;
}

if ($estatus >= 0) {
    $where[] = "s.estatus = " . $estatus;
}

$filtro = "";

if (count($where) > 0) {
    $filtro = "WHERE " . implode(" AND ", $where);
}

$sql = "
WITH sesiones AS (
    SELECT
        s.id,
        s.cia,
        s.almacen,
        s.fecha_inventario,
        s.empleado,
        s.nro_conteo,
        s.id_config,
        s.tipo_conteo,
        s.fecha_inicio,
        s.fecha_fin,
        s.minutos_totales,
        s.estatus,
        s.fecha_creacion
    FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_SESIONES s
    $filtro
),
inventario_base AS (
    SELECT
        s.id AS id_sesion,
        i.id AS id_inventario,
        i.estatus AS estatus_inventario
    FROM sesiones s
    INNER JOIN SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO i
        ON i.cias = s.cia
       AND i.almacen = s.almacen
       AND CAST(i.fecha_inv AS DATE) = s.fecha_inventario
),
conteos_base AS (
    SELECT
        s.id AS id_sesion,
        c.id AS id_conteo,
        c.id_inventario,
        c.id_config,
        c.nro_conteo,
        ISNULL(c.cantidad, 0) AS cantidad,
        c.usuario,
        c.fecha,
        c.estatus
    FROM sesiones s
    INNER JOIN inventario_base ib
        ON ib.id_sesion = s.id
    INNER JOIN SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_CONTEOS c
        ON c.id_inventario = ib.id_inventario
       AND c.nro_conteo = s.nro_conteo
       AND c.usuario = s.empleado
       AND (
            c.id_config = s.id_config
            OR c.id_config IS NULL
       )
),
metricas_inventario AS (
    SELECT
        id_sesion,
        COUNT(DISTINCT id_inventario) AS total_articulos,
        MAX(estatus_inventario) AS estatus_actual_inventario
    FROM inventario_base
    GROUP BY id_sesion
),
metricas_conteos AS (
    SELECT
        id_sesion,
        COUNT(DISTINCT CASE WHEN cantidad > 0 THEN id_inventario END) AS articulos_capturados,
        COUNT(DISTINCT id_inventario) AS articulos_guardados,
        COUNT(id_conteo) AS total_guardados,
        SUM(CASE WHEN cantidad > 0 THEN 1 ELSE 0 END) AS total_guardados_con_valor,
        MIN(CASE WHEN cantidad > 0 THEN fecha END) AS primera_captura_guardada,
        MAX(CASE WHEN cantidad > 0 THEN fecha END) AS ultima_captura_guardada,
        SUM(CASE WHEN id_config IS NULL AND cantidad > 0 THEN 1 ELSE 0 END) AS capturas_sin_id_config,
        SUM(CASE WHEN id_config IS NOT NULL AND cantidad > 0 THEN 1 ELSE 0 END) AS capturas_con_id_config,
        SUM(CASE WHEN cantidad > 0 THEN CAST(cantidad AS DECIMAL(18,4)) ELSE 0 END) AS unidades_capturadas
    FROM conteos_base
    GROUP BY id_sesion
)
SELECT
    s.id AS id_sesion,
    s.cia,
    s.almacen,
    CONVERT(VARCHAR(10), s.fecha_inventario, 120) AS fecha_inventario,
    s.empleado,
    s.nro_conteo,
    s.id_config,
    s.tipo_conteo,

    CONVERT(VARCHAR(19), s.fecha_inicio, 120) AS fecha_inicio,
    CONVERT(VARCHAR(19), s.fecha_fin, 120) AS fecha_fin,
    CONVERT(VARCHAR(19), s.fecha_creacion, 120) AS fecha_creacion,

    CASE
        WHEN s.fecha_inicio IS NULL THEN 0
        WHEN s.fecha_fin IS NOT NULL THEN DATEDIFF(SECOND, s.fecha_inicio, s.fecha_fin)
        ELSE DATEDIFF(SECOND, s.fecha_inicio, GETDATE())
    END AS tiempo_sesion_segundos,

    CAST(
        CASE
            WHEN s.fecha_inicio IS NULL THEN 0
            WHEN s.fecha_fin IS NOT NULL THEN DATEDIFF(SECOND, s.fecha_inicio, s.fecha_fin) / 60.0
            ELSE DATEDIFF(SECOND, s.fecha_inicio, GETDATE()) / 60.0
        END
        AS DECIMAL(18,2)
    ) AS minutos_sesion,

    CASE
        WHEN s.fecha_fin IS NOT NULL THEN 'DURACION_FINAL_REAL'
        ELSE 'DURACION_EN_VIVO'
    END AS tipo_duracion_sesion,

    CASE
        WHEN s.estatus = 0 THEN 'SESION ABIERTA'
        WHEN s.estatus = 1 THEN 'SESION CERRADA'
        ELSE 'SIN ESTADO'
    END AS estado_sesion,

    ISNULL(mi.total_articulos, 0) AS total_articulos,
    ISNULL(mc.articulos_capturados, 0) AS articulos_capturados,
    ISNULL(mc.articulos_guardados, 0) AS articulos_guardados,
    ISNULL(mc.total_guardados, 0) AS total_guardados,
    ISNULL(mc.total_guardados_con_valor, 0) AS total_guardados_con_valor,
    ISNULL(mc.unidades_capturadas, 0) AS unidades_capturadas,

    CAST(
        ISNULL(mc.articulos_capturados, 0) * 100.0
        / NULLIF(ISNULL(mi.total_articulos, 0), 0)
        AS DECIMAL(18,2)
    ) AS avance_porcentaje,

    CONVERT(VARCHAR(19), mc.primera_captura_guardada, 120) AS primera_captura_guardada,
    CONVERT(VARCHAR(19), mc.ultima_captura_guardada, 120) AS ultima_captura_guardada,

    CASE
        WHEN mc.primera_captura_guardada IS NULL OR mc.ultima_captura_guardada IS NULL THEN 0
        ELSE DATEDIFF(SECOND, mc.primera_captura_guardada, mc.ultima_captura_guardada)
    END AS tiempo_guardado_lote_segundos,

    CAST(
        CASE
            WHEN mc.primera_captura_guardada IS NULL OR mc.ultima_captura_guardada IS NULL THEN 0
            ELSE DATEDIFF(SECOND, mc.primera_captura_guardada, mc.ultima_captura_guardada) / 60.0
        END
        AS DECIMAL(18,2)
    ) AS minutos_guardado_lote,

    CASE
        WHEN ISNULL(mi.estatus_actual_inventario, 0) = 4 THEN 'CERRADO'
        WHEN ISNULL(mi.estatus_actual_inventario, 0) = 3 THEN 'TERCER CONTEO'
        WHEN ISNULL(mi.estatus_actual_inventario, 0) = 2 THEN 'SEGUNDO CONTEO'
        WHEN ISNULL(mi.estatus_actual_inventario, 0) = 1 THEN 'PRIMER CONTEO'
        ELSE 'SIN CONTEO'
    END AS avance_actual,

    CASE
        WHEN ISNULL(mi.estatus_actual_inventario, 0) = 4 THEN 'CERRADO'
        WHEN s.fecha_inventario < CAST(GETDATE() AS DATE) THEN 'ATRASADO'
        WHEN s.fecha_inventario = CAST(GETDATE() AS DATE) THEN 'EN PROCESO HOY'
        WHEN s.fecha_inventario > CAST(GETDATE() AS DATE) THEN 'PROGRAMADO'
        ELSE 'SIN ESTADO'
    END AS estado_tiempo,

    ISNULL(mc.capturas_con_id_config, 0) AS capturas_con_id_config,
    ISNULL(mc.capturas_sin_id_config, 0) AS capturas_sin_id_config,

    CASE
        WHEN ISNULL(mc.total_guardados, 0) = 0 THEN 'SIN_CAPTURAS'
        WHEN ISNULL(mc.total_guardados_con_valor, 0) = 0 THEN 'SIN_CAPTURAS_CON_VALOR'
        WHEN ISNULL(mc.capturas_sin_id_config, 0) = 0 THEN 'EXACTA_CON_ID_CONFIG'
        WHEN ISNULL(mc.capturas_con_id_config, 0) = 0 THEN 'EXACTA_POR_EMPLEADO_CONTEO_ALMACEN_FECHA'
        ELSE 'MIXTA_REVISAR_ID_CONFIG'
    END AS nivel_confianza,

    CAST(
        CASE
            WHEN ISNULL(mc.articulos_capturados, 0) = 0 THEN 0
            ELSE ISNULL(mc.articulos_capturados, 0) * 1.0
                 / NULLIF(
                    CASE
                        WHEN s.fecha_inicio IS NULL THEN 0
                        WHEN s.fecha_fin IS NOT NULL THEN DATEDIFF(SECOND, s.fecha_inicio, s.fecha_fin) / 60.0
                        ELSE DATEDIFF(SECOND, s.fecha_inicio, GETDATE()) / 60.0
                    END,
                    0
                 )
        END
        AS DECIMAL(18,2)
    ) AS articulos_por_minuto_sesion,

    CAST(
        CASE
            WHEN mc.primera_captura_guardada IS NULL OR mc.ultima_captura_guardada IS NULL THEN 0
            WHEN DATEDIFF(SECOND, mc.primera_captura_guardada, mc.ultima_captura_guardada) = 0 THEN ISNULL(mc.articulos_capturados, 0)
            ELSE ISNULL(mc.articulos_capturados, 0) * 1.0
                 / NULLIF(DATEDIFF(SECOND, mc.primera_captura_guardada, mc.ultima_captura_guardada) / 60.0, 0)
        END
        AS DECIMAL(18,2)
    ) AS articulos_por_minuto_captura_real

FROM sesiones s

LEFT JOIN metricas_inventario mi
    ON mi.id_sesion = s.id

LEFT JOIN metricas_conteos mc
    ON mc.id_sesion = s.id

ORDER BY
    s.fecha_inventario DESC,
    s.cia,
    s.almacen,
    s.nro_conteo,
    s.empleado,
    s.fecha_inicio DESC
";

$res = mssql_query($sql, $conn);

if (!$res) {
    responder(array(
        "success" => false,
        "error" => "Error consultando estadísticas",
        "detalle" => mssql_get_last_message()
    ));
}

$data = array();

while ($row = mssql_fetch_assoc($res)) {
    $data[] = array(
        "id_sesion" => isset($row["id_sesion"]) ? intval($row["id_sesion"]) : 0,
        "cia" => $row["cia"],
        "almacen" => $row["almacen"],
        "fecha_inventario" => $row["fecha_inventario"],
        "empleado" => $row["empleado"],
        "nro_conteo" => isset($row["nro_conteo"]) ? intval($row["nro_conteo"]) : 0,
        "id_config" => isset($row["id_config"]) ? intval($row["id_config"]) : 0,
        "tipo_conteo" => $row["tipo_conteo"],
        "fecha_inicio" => $row["fecha_inicio"],
        "fecha_fin" => $row["fecha_fin"],
        "fecha_creacion" => $row["fecha_creacion"],
        "tiempo_sesion_segundos" => isset($row["tiempo_sesion_segundos"]) ? intval($row["tiempo_sesion_segundos"]) : 0,
        "minutos_sesion" => isset($row["minutos_sesion"]) ? floatval($row["minutos_sesion"]) : 0,
        "tipo_duracion_sesion" => $row["tipo_duracion_sesion"],
        "estado_sesion" => $row["estado_sesion"],
        "total_articulos" => isset($row["total_articulos"]) ? intval($row["total_articulos"]) : 0,
        "articulos_capturados" => isset($row["articulos_capturados"]) ? intval($row["articulos_capturados"]) : 0,
        "articulos_guardados" => isset($row["articulos_guardados"]) ? intval($row["articulos_guardados"]) : 0,
        "total_guardados" => isset($row["total_guardados"]) ? intval($row["total_guardados"]) : 0,
        "total_guardados_con_valor" => isset($row["total_guardados_con_valor"]) ? intval($row["total_guardados_con_valor"]) : 0,
        "unidades_capturadas" => isset($row["unidades_capturadas"]) ? floatval($row["unidades_capturadas"]) : 0,
        "avance_porcentaje" => isset($row["avance_porcentaje"]) ? floatval($row["avance_porcentaje"]) : 0,
        "primera_captura_guardada" => $row["primera_captura_guardada"],
        "ultima_captura_guardada" => $row["ultima_captura_guardada"],
        "tiempo_guardado_lote_segundos" => isset($row["tiempo_guardado_lote_segundos"]) ? intval($row["tiempo_guardado_lote_segundos"]) : 0,
        "minutos_guardado_lote" => isset($row["minutos_guardado_lote"]) ? floatval($row["minutos_guardado_lote"]) : 0,
        "avance_actual" => $row["avance_actual"],
        "estado_tiempo" => $row["estado_tiempo"],
        "capturas_con_id_config" => isset($row["capturas_con_id_config"]) ? intval($row["capturas_con_id_config"]) : 0,
        "capturas_sin_id_config" => isset($row["capturas_sin_id_config"]) ? intval($row["capturas_sin_id_config"]) : 0,
        "nivel_confianza" => $row["nivel_confianza"],
        "articulos_por_minuto_sesion" => isset($row["articulos_por_minuto_sesion"]) ? floatval($row["articulos_por_minuto_sesion"]) : 0,
        "articulos_por_minuto_captura_real" => isset($row["articulos_por_minuto_captura_real"]) ? floatval($row["articulos_por_minuto_captura_real"]) : 0
    );
}

$sqlSerieTiempo = "
WITH sesiones AS (
    SELECT
        s.id,
        s.cia,
        s.almacen,
        s.fecha_inventario,
        s.empleado,
        s.nro_conteo,
        s.id_config
    FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_SESIONES s
    $filtro
),
inventario_base AS (
    SELECT
        s.id AS id_sesion,
        i.id AS id_inventario
    FROM sesiones s
    INNER JOIN SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO i
        ON i.cias = s.cia
       AND i.almacen = s.almacen
       AND CAST(i.fecha_inv AS DATE) = s.fecha_inventario
),
conteos_distintos AS (
    SELECT DISTINCT
        c.id,
        c.id_inventario,
        c.fecha,
        c.usuario,
        c.nro_conteo,
        ISNULL(c.cantidad, 0) AS cantidad
    FROM sesiones s
    INNER JOIN inventario_base ib
        ON ib.id_sesion = s.id
    INNER JOIN SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_CONTEOS c
        ON c.id_inventario = ib.id_inventario
       AND c.nro_conteo = s.nro_conteo
       AND c.usuario = s.empleado
       AND (
            c.id_config = s.id_config
            OR c.id_config IS NULL
       )
    WHERE ISNULL(c.cantidad, 0) > 0
)
SELECT
    CONVERT(VARCHAR(16), fecha, 120) AS periodo,
    COUNT(id) AS registros_capturados,
    COUNT(DISTINCT id_inventario) AS articulos_unicos
FROM conteos_distintos
GROUP BY
    CONVERT(VARCHAR(16), fecha, 120)
ORDER BY
    periodo
";

$resSerieTiempo = mssql_query($sqlSerieTiempo, $conn);

$serie_tiempo = array();
$acumulado_registros = 0;
$acumulado_articulos = 0;

if ($resSerieTiempo) {
    while ($rowSerie = mssql_fetch_assoc($resSerieTiempo)) {
        $registros = isset($rowSerie["registros_capturados"]) ? intval($rowSerie["registros_capturados"]) : 0;
        $articulos = isset($rowSerie["articulos_unicos"]) ? intval($rowSerie["articulos_unicos"]) : 0;

        $acumulado_registros += $registros;
        $acumulado_articulos += $articulos;

        $serie_tiempo[] = array(
            "periodo" => $rowSerie["periodo"],
            "hora" => substr($rowSerie["periodo"], 11, 5),
            "registros_capturados" => $registros,
            "articulos_unicos" => $articulos,
            "acumulado_registros" => $acumulado_registros,
            "acumulado_articulos" => $acumulado_articulos
        );
    }
}

$resumen = array(
    "total_sesiones" => count($data),
    "sesiones_abiertas" => 0,
    "sesiones_cerradas" => 0,
    "total_articulos" => 0,
    "total_articulos_capturados" => 0,
    "total_articulos_guardados" => 0,
    "total_guardados" => 0,
    "total_guardados_con_valor" => 0,
    "capturas_con_id_config" => 0,
    "capturas_sin_id_config" => 0,
    "tiempo_operativo_segundos" => 0
);

for ($i = 0; $i < count($data); $i++) {
    if ($data[$i]["estado_sesion"] === "SESION ABIERTA") {
        $resumen["sesiones_abiertas"]++;
    }

    if ($data[$i]["estado_sesion"] === "SESION CERRADA") {
        $resumen["sesiones_cerradas"]++;
    }

    $resumen["total_articulos"] += $data[$i]["total_articulos"];
    $resumen["total_articulos_capturados"] += $data[$i]["articulos_capturados"];
    $resumen["total_articulos_guardados"] += $data[$i]["articulos_guardados"];
    $resumen["total_guardados"] += $data[$i]["total_guardados"];
    $resumen["total_guardados_con_valor"] += $data[$i]["total_guardados_con_valor"];
    $resumen["capturas_con_id_config"] += $data[$i]["capturas_con_id_config"];
    $resumen["capturas_sin_id_config"] += $data[$i]["capturas_sin_id_config"];
    $resumen["tiempo_operativo_segundos"] += $data[$i]["tiempo_sesion_segundos"];
}

$resumen["avance_global_porcentaje"] = 0;

if ($resumen["total_articulos"] > 0) {
    $resumen["avance_global_porcentaje"] = round(($resumen["total_articulos_capturados"] * 100) / $resumen["total_articulos"], 2);
}

responder(array(
    "success" => true,
    "fuente" => array(
        "db" => "SAP_PROCESOS_DESARROLLO",
        "tablas" => array(
            "CAP_INVENTARIO_SESIONES",
            "CAP_INVENTARIO",
            "CAP_INVENTARIO_CONTEOS"
        )
    ),
    "regla_exactitud" => array(
        "principal" => "Solo cuenta artículos capturados cuando cantidad > 0",
        "conteos" => "C1/C2/C3/C4/C7 y capturados salen de CAP_INVENTARIO_CONTEOS con ISNULL(cantidad, 0) > 0",
        "nota" => "Los registros con cantidad 0 quedan como guardados, pero no como capturados."
    ),
    "resumen" => $resumen,
    "serie_tiempo" => $serie_tiempo,
    "data" => $data
));
?>
