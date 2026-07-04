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

function valorEntero($row, $campo) {
    return isset($row[$campo]) ? intval($row[$campo]) : 0;
}

function valorDecimal($row, $campo) {
    return isset($row[$campo]) ? floatval($row[$campo]) : 0;
}

function valorTexto($row, $campo) {
    return isset($row[$campo]) ? $row[$campo] : "";
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

$cia     = isset($_GET['cia']) ? limpiar($_GET['cia']) : "";
$almacen = isset($_GET['almacen']) ? limpiar($_GET['almacen']) : "";
$fecha   = isset($_GET['fecha']) ? limpiar($_GET['fecha']) : "";

if ($cia === "" || $almacen === "" || $fecha === "") {
    responder(array(
        "success" => false,
        "error" => "Faltan parámetros: cia, almacen, fecha"
    ));
}

$sqlTotal = "
SELECT
    COUNT(*) AS total_articulos,
    ISNULL(MAX(estatus), 0) AS estatus_actual
FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO
WHERE cias = '$cia'
  AND almacen = '$almacen'
  AND CONVERT(VARCHAR(10), fecha_inv, 120) = '$fecha'
";

$resTotal = mssql_query($sqlTotal, $conn);

if (!$resTotal) {
    responder(array(
        "success" => false,
        "error" => "Error consultando total de inventario",
        "detalle" => mssql_get_last_message()
    ));
}

$rowTotal = mssql_fetch_assoc($resTotal);

$totalArticulos = valorEntero($rowTotal, "total_articulos");
$estatusActual = valorEntero($rowTotal, "estatus_actual");

if ($totalArticulos <= 0) {
    responder(array(
        "success" => true,
        "resumen" => null,
        "usuarios" => array(),
        "diferencias" => array(
            "total_articulos" => 0,
            "diferencias_c1_c2" => 0,
            "diferencias_c2_c3" => 0,
            "diferencias_vs_sap" => 0
        ),
        "cierre" => null,
        "sap" => null,
        "logs" => array()
    ));
}

function contarConteo($conn, $cia, $almacen, $fecha, $conteo) {
    $sql = "
    SELECT COUNT(DISTINCT CASE WHEN ISNULL(c.cantidad, 0) > 0 THEN c.id_inventario END) AS total
    FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_CONTEOS c
    INNER JOIN SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO i
        ON i.id = c.id_inventario
    WHERE i.cias = '$cia'
      AND i.almacen = '$almacen'
      AND CONVERT(VARCHAR(10), i.fecha_inv, 120) = '$fecha'
      AND c.nro_conteo = $conteo
    ";

    $res = mssql_query($sql, $conn);

    if (!$res) {
        responder(array(
            "success" => false,
            "error" => "Error contando conteo " . $conteo,
            "detalle" => mssql_get_last_message()
        ));
    }

    $row = mssql_fetch_assoc($res);
    return valorEntero($row, "total");
}

$capturadosC1 = contarConteo($conn, $cia, $almacen, $fecha, 1);
$capturadosC2 = contarConteo($conn, $cia, $almacen, $fecha, 2);
$capturadosC3 = contarConteo($conn, $cia, $almacen, $fecha, 3);
$capturadosC7 = contarConteo($conn, $cia, $almacen, $fecha, 7);

$sqlUltimos = "
SELECT
    c.nro_conteo,
    MAX(CONVERT(VARCHAR(19), c.fecha, 120)) AS ultimo_movimiento
FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_CONTEOS c
INNER JOIN SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO i
    ON i.id = c.id_inventario
WHERE i.cias = '$cia'
  AND i.almacen = '$almacen'
  AND CONVERT(VARCHAR(10), i.fecha_inv, 120) = '$fecha'
GROUP BY c.nro_conteo
";

$resUltimos = mssql_query($sqlUltimos, $conn);

if (!$resUltimos) {
    responder(array(
        "success" => false,
        "error" => "Error consultando últimos movimientos",
        "detalle" => mssql_get_last_message()
    ));
}

$ultimoC1 = null;
$ultimoC2 = null;
$ultimoC3 = null;
$ultimoC7 = null;

while ($rowUltimo = mssql_fetch_assoc($resUltimos)) {
    $nro = intval($rowUltimo["nro_conteo"]);

    if ($nro === 1) {
        $ultimoC1 = $rowUltimo["ultimo_movimiento"];
    }

    if ($nro === 2) {
        $ultimoC2 = $rowUltimo["ultimo_movimiento"];
    }

    if ($nro === 3) {
        $ultimoC3 = $rowUltimo["ultimo_movimiento"];
    }

    if ($nro === 7) {
        $ultimoC7 = $rowUltimo["ultimo_movimiento"];
    }
}

$estadoTexto = "ESTATUS DESCONOCIDO";

if ($estatusActual === 0) {
    $estadoTexto = "SIN INICIAR";
}

if ($estatusActual === 1) {
    $estadoTexto = "CONTEO 1";
}

if ($estatusActual === 2) {
    $estadoTexto = "CONTEO 2";
}

if ($estatusActual === 3) {
    $estadoTexto = "CONTEO 3";
}

if ($estatusActual === 4) {
    $estadoTexto = "FINALIZADO";
}

$avanceC1 = $totalArticulos > 0 ? round(($capturadosC1 * 100) / $totalArticulos, 2) : 0;
$avanceC2 = $totalArticulos > 0 ? round(($capturadosC2 * 100) / $totalArticulos, 2) : 0;
$avanceC3 = $totalArticulos > 0 ? round(($capturadosC3 * 100) / $totalArticulos, 2) : 0;
$avanceC7 = $totalArticulos > 0 ? round(($capturadosC7 * 100) / $totalArticulos, 2) : 0;

$resumen = array(
    "cias" => $cia,
    "almacen" => $almacen,
    "fecha_inv" => $fecha,
    "total_articulos" => $totalArticulos,
    "estatus_actual" => $estatusActual,
    "estado_texto" => $estadoTexto,
    "capturados_conteo_1" => $capturadosC1,
    "capturados_conteo_2" => $capturadosC2,
    "capturados_conteo_3" => $capturadosC3,
    "capturados_conteo_7" => $capturadosC7,
    "faltantes_conteo_1" => $totalArticulos - $capturadosC1,
    "faltantes_conteo_2" => $totalArticulos - $capturadosC2,
    "faltantes_conteo_3" => $totalArticulos - $capturadosC3,
    "faltantes_conteo_7" => $totalArticulos - $capturadosC7,
    "avance_conteo_1" => $avanceC1,
    "avance_conteo_2" => $avanceC2,
    "avance_conteo_3" => $avanceC3,
    "avance_conteo_7" => $avanceC7,
    "ultimo_movimiento_c1" => $ultimoC1,
    "ultimo_movimiento_c2" => $ultimoC2,
    "ultimo_movimiento_c3" => $ultimoC3,
    "ultimo_movimiento_c7" => $ultimoC7
);

$sqlUsuarios = "
SELECT
    c.nro_conteo,
    c.usuario AS empleado,
    ISNULL(u.nombre, 'SIN NOMBRE') AS nombre,
    COUNT(DISTINCT CASE WHEN ISNULL(c.cantidad, 0) > 0 THEN c.id_inventario END) AS articulos_capturados,
    SUM(CASE WHEN ISNULL(c.cantidad, 0) > 0 THEN 1 ELSE 0 END) AS total_guardados,
    SUM(CASE WHEN ISNULL(c.cantidad, 0) > 0 THEN CAST(c.cantidad AS DECIMAL(18,4)) ELSE 0 END) AS unidades_capturadas,
    MIN(CASE WHEN ISNULL(c.cantidad, 0) > 0 THEN CONVERT(VARCHAR(19), c.fecha, 120) END) AS primer_registro,
    MAX(CASE WHEN ISNULL(c.cantidad, 0) > 0 THEN CONVERT(VARCHAR(19), c.fecha, 120) END) AS ultimo_registro
FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_CONTEOS c
INNER JOIN SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO i
    ON i.id = c.id_inventario
LEFT JOIN SAP_PROCESOS_DESARROLLO.dbo.usuarios u
    ON CONVERT(VARCHAR(50), u.empleado) = CONVERT(VARCHAR(50), c.usuario)
WHERE i.cias = '$cia'
  AND i.almacen = '$almacen'
  AND CONVERT(VARCHAR(10), i.fecha_inv, 120) = '$fecha'
GROUP BY
    c.nro_conteo,
    c.usuario,
    u.nombre
ORDER BY
    c.nro_conteo,
    c.usuario
";

$resUsuarios = mssql_query($sqlUsuarios, $conn);

if (!$resUsuarios) {
    responder(array(
        "success" => false,
        "error" => "Error consultando usuarios capturistas",
        "detalle" => mssql_get_last_message()
    ));
}

$usuarios = array();

while ($row = mssql_fetch_assoc($resUsuarios)) {
    $usuarios[] = array(
        "nro_conteo" => valorEntero($row, "nro_conteo"),
        "empleado" => valorTexto($row, "empleado"),
        "nombre" => valorTexto($row, "nombre"),
        "articulos_capturados" => valorEntero($row, "articulos_capturados"),
        "total_guardados" => valorEntero($row, "total_guardados"),
        "unidades_capturadas" => valorDecimal($row, "unidades_capturadas"),
        "primer_registro" => valorTexto($row, "primer_registro"),
        "ultimo_registro" => valorTexto($row, "ultimo_registro")
    );
}

$sqlDifC1C2 = "
SELECT COUNT(*) AS total
FROM (
    SELECT
        i.id,
        MAX(CASE WHEN c.nro_conteo = 1 THEN c.cantidad END) AS c1,
        MAX(CASE WHEN c.nro_conteo = 2 THEN c.cantidad END) AS c2
    FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO i
    LEFT JOIN SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_CONTEOS c
        ON c.id_inventario = i.id
    WHERE i.cias = '$cia'
      AND i.almacen = '$almacen'
      AND CONVERT(VARCHAR(10), i.fecha_inv, 120) = '$fecha'
    GROUP BY i.id
) x
WHERE x.c1 IS NOT NULL
  AND x.c2 IS NOT NULL
  AND x.c1 <> x.c2
";

$resDifC1C2 = mssql_query($sqlDifC1C2, $conn);

if (!$resDifC1C2) {
    responder(array(
        "success" => false,
        "error" => "Error consultando diferencias conteo 1 vs conteo 2",
        "detalle" => mssql_get_last_message()
    ));
}

$rowDifC1C2 = mssql_fetch_assoc($resDifC1C2);

$sqlDifC2C3 = "
SELECT COUNT(*) AS total
FROM (
    SELECT
        i.id,
        MAX(CASE WHEN c.nro_conteo = 2 THEN c.cantidad END) AS c2,
        MAX(CASE WHEN c.nro_conteo = 3 THEN c.cantidad END) AS c3
    FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO i
    LEFT JOIN SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_CONTEOS c
        ON c.id_inventario = i.id
    WHERE i.cias = '$cia'
      AND i.almacen = '$almacen'
      AND CONVERT(VARCHAR(10), i.fecha_inv, 120) = '$fecha'
    GROUP BY i.id
) x
WHERE x.c2 IS NOT NULL
  AND x.c3 IS NOT NULL
  AND x.c2 <> x.c3
";

$resDifC2C3 = mssql_query($sqlDifC2C3, $conn);

if (!$resDifC2C3) {
    responder(array(
        "success" => false,
        "error" => "Error consultando diferencias conteo 2 vs conteo 3",
        "detalle" => mssql_get_last_message()
    ));
}

$rowDifC2C3 = mssql_fetch_assoc($resDifC2C3);

$sqlDifSap = "
SELECT COUNT(*) AS total
FROM (
    SELECT
        i.id,
        i.cant_invfis AS sap_base,
        MAX(CASE WHEN c.nro_conteo = 1 THEN c.cantidad END) AS c1,
        MAX(CASE WHEN c.nro_conteo = 2 THEN c.cantidad END) AS c2,
        MAX(CASE WHEN c.nro_conteo = 3 THEN c.cantidad END) AS c3
    FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO i
    LEFT JOIN SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_CONTEOS c
        ON c.id_inventario = i.id
    WHERE i.cias = '$cia'
      AND i.almacen = '$almacen'
      AND CONVERT(VARCHAR(10), i.fecha_inv, 120) = '$fecha'
    GROUP BY
        i.id,
        i.cant_invfis
) x
WHERE
    (
        x.c3 IS NOT NULL
        AND x.sap_base <> x.c3
    )
    OR
    (
        x.c3 IS NULL
        AND x.c2 IS NOT NULL
        AND x.sap_base <> x.c2
    )
    OR
    (
        x.c3 IS NULL
        AND x.c2 IS NULL
        AND x.c1 IS NOT NULL
        AND x.sap_base <> x.c1
    )
";

$resDifSap = mssql_query($sqlDifSap, $conn);

if (!$resDifSap) {
    responder(array(
        "success" => false,
        "error" => "Error consultando diferencias vs SAP",
        "detalle" => mssql_get_last_message()
    ));
}

$rowDifSap = mssql_fetch_assoc($resDifSap);

$diferencias = array(
    "total_articulos" => $totalArticulos,
    "diferencias_c1_c2" => valorEntero($rowDifC1C2, "total"),
    "diferencias_c2_c3" => valorEntero($rowDifC2C3, "total"),
    "diferencias_vs_sap" => valorEntero($rowDifSap, "total")
);

$sqlSesiones = "
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
    s.minutos_totales,
    s.estatus,
    CONVERT(VARCHAR(19), s.fecha_creacion, 120) AS fecha_creacion,
    CASE
        WHEN s.estatus = 0 THEN 'SESION ABIERTA'
        WHEN s.estatus = 1 THEN 'CONTEO FINALIZADO'
        ELSE 'SIN ESTADO'
    END AS estado_sesion
FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_SESIONES s
WHERE s.cia = '$cia'
  AND s.almacen = '$almacen'
  AND CONVERT(VARCHAR(10), s.fecha_inventario, 120) = '$fecha'
ORDER BY
    s.nro_conteo,
    s.empleado,
    s.fecha_inicio DESC
";

$resSesiones = mssql_query($sqlSesiones, $conn);

$sesiones = array();

if ($resSesiones) {
    while ($rowSesion = mssql_fetch_assoc($resSesiones)) {
        $sesiones[] = array(
            "id_sesion" => valorEntero($rowSesion, "id_sesion"),
            "cia" => valorTexto($rowSesion, "cia"),
            "almacen" => valorTexto($rowSesion, "almacen"),
            "fecha_inventario" => valorTexto($rowSesion, "fecha_inventario"),
            "empleado" => valorTexto($rowSesion, "empleado"),
            "nro_conteo" => valorEntero($rowSesion, "nro_conteo"),
            "id_config" => valorEntero($rowSesion, "id_config"),
            "tipo_conteo" => valorTexto($rowSesion, "tipo_conteo"),
            "fecha_inicio" => valorTexto($rowSesion, "fecha_inicio"),
            "fecha_fin" => valorTexto($rowSesion, "fecha_fin"),
            "minutos_totales" => valorDecimal($rowSesion, "minutos_totales"),
            "estatus" => valorEntero($rowSesion, "estatus"),
            "estado_sesion" => valorTexto($rowSesion, "estado_sesion"),
            "fecha_creacion" => valorTexto($rowSesion, "fecha_creacion")
        );
    }
}

$cierre = null;
$sap = null;

$sqlCierre = "
SELECT TOP 1
    *
FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_INVENTARIO_CIERRE
WHERE cia = '$cia'
  AND almacen = '$almacen'
  AND CONVERT(VARCHAR(10), fecha_inventario, 120) = '$fecha'
ORDER BY id_cierre DESC
";

$resCierre = mssql_query($sqlCierre, $conn);

if ($resCierre && $rowCierre = mssql_fetch_assoc($resCierre)) {
    $cierre = array();

    foreach ($rowCierre as $k => $v) {
        $cierre[$k] = $v;
    }
}

$idCierre = 0;

if ($cierre && isset($cierre["id_cierre"])) {
    $idCierre = intval($cierre["id_cierre"]);
}

if ($idCierre > 0) {
    $sqlSap = "
    SELECT TOP 1
        *
    FROM SAP_PROCESOS_DESARROLLO.dbo.CAP_SAP_SIGNAL
    WHERE id_cierre = $idCierre
    ORDER BY id_signal DESC
    ";

    $resSap = mssql_query($sqlSap, $conn);

    if ($resSap && $rowSap = mssql_fetch_assoc($resSap)) {
        $sap = array();

        foreach ($rowSap as $k => $v) {
            $sap[$k] = $v;
        }
    }
}

responder(array(
    "success" => true,
    "resumen" => $resumen,
    "usuarios" => $usuarios,
    "diferencias" => $diferencias,
    "sesiones" => $sesiones,
    "cierre" => $cierre,
    "sap" => $sap,
    "logs" => array()
));
?>
