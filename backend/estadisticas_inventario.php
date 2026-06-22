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
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
    echo json_encode(array(
        "success" => false,
        "error" => "Error de conexión"
    ));
    exit;
}

mssql_select_db($db, $conn);

$sql = "
SELECT
    s.cia,
    s.almacen,
    CONVERT(VARCHAR(10), s.fecha_inventario, 120) AS fecha_inventario,
    s.empleado,
    s.nro_conteo,
    s.tipo_conteo,

    CONVERT(VARCHAR(19), s.fecha_inicio, 120) AS fecha_inicio,
    CONVERT(VARCHAR(19), s.fecha_fin, 120) AS fecha_fin,

    CAST(
        DATEDIFF(SECOND, s.fecha_inicio, ISNULL(s.fecha_fin, GETDATE())) / 60.0
        AS DECIMAL(10,2)
    ) AS minutos_sesion,

    CASE
        WHEN s.estatus = 0 THEN 'SESION ABIERTA'
        WHEN s.estatus = 1 THEN 'SESION CERRADA'
        ELSE 'SIN ESTADO'
    END AS estado_sesion,

    COUNT(DISTINCT i.id) AS total_articulos,

    COUNT(DISTINCT c.id_inventario) AS articulos_capturados,

    CAST(
        COUNT(DISTINCT c.id_inventario) * 100.0
        / NULLIF(COUNT(DISTINCT i.id), 0)
        AS DECIMAL(10,2)
    ) AS avance_porcentaje,

    MIN(c.fecha) AS primera_captura_guardada,
    MAX(c.fecha) AS ultima_captura_guardada,

    CAST(
        DATEDIFF(SECOND, MIN(c.fecha), MAX(c.fecha)) / 60.0
        AS DECIMAL(10,2)
    ) AS minutos_guardado_lote,

    CASE
        WHEN MAX(i.estatus) = 4 THEN 'CERRADO'
        WHEN MAX(i.estatus) = 3 THEN 'TERCER CONTEO'
        WHEN MAX(i.estatus) = 2 THEN 'SEGUNDO CONTEO'
        WHEN MAX(i.estatus) = 1 THEN 'PRIMER CONTEO'
        ELSE 'SIN CONTEO'
    END AS avance_actual,

    CASE
        WHEN MAX(i.estatus) = 4 THEN 'CERRADO'
        WHEN s.fecha_inventario < CAST(GETDATE() AS DATE) THEN 'ATRASADO'
        WHEN s.fecha_inventario = CAST(GETDATE() AS DATE) THEN 'EN PROCESO HOY'
        WHEN s.fecha_inventario > CAST(GETDATE() AS DATE) THEN 'PROGRAMADO'
        ELSE 'SIN ESTADO'
    END AS estado_tiempo

FROM CAP_INVENTARIO_SESIONES s

LEFT JOIN CAP_INVENTARIO i
    ON i.cias = s.cia
   AND i.almacen = s.almacen
   AND CAST(i.fecha_inv AS DATE) = s.fecha_inventario

LEFT JOIN CAP_INVENTARIO_CONTEOS c
    ON c.id_inventario = i.id
   AND c.nro_conteo = s.nro_conteo
   AND c.usuario = s.empleado

GROUP BY
    s.cia,
    s.almacen,
    s.fecha_inventario,
    s.empleado,
    s.nro_conteo,
    s.tipo_conteo,
    s.fecha_inicio,
    s.fecha_fin,
    s.estatus

ORDER BY
    s.fecha_inventario DESC,
    s.cia,
    s.almacen,
    s.nro_conteo,
    s.empleado
";

$res = mssql_query($sql, $conn);

if (!$res) {
    echo json_encode(array(
        "success" => false,
        "error" => "Error consultando estadísticas"
    ));
    exit;
}

$data = array();

while ($row = mssql_fetch_assoc($res)) {
    $data[] = $row;
}

echo json_encode(array(
    "success" => true,
    "data" => $data
));
exit;
?>
