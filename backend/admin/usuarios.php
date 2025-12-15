<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

$conn = mssql_connect("192.168.0.174", "sa", "P@ssw0rd");
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'Conexión fallida']);
  exit;
}
mssql_select_db("SAP_PROCESOS", $conn);

// SET obligatorios para columnas computadas, vistas indexadas, etc.
mssql_query("SET ANSI_NULLS ON", $conn);
mssql_query("SET ANSI_WARNINGS ON", $conn);
mssql_query("SET QUOTED_IDENTIFIER ON", $conn);
mssql_query("SET CONCAT_NULL_YIELDS_NULL ON", $conn);
mssql_query("SET ANSI_PADDING ON", $conn);

// Cargar usuarios con info de rol
$query = "
SELECT
    u.id,
    u.empleado,
    u.nombre,
    u.email,
    ur.rol_id,
    r.nombre AS rol_nombre,
    u.activo,

    ISNULL(CAST(u.creado_por AS VARCHAR(50)), 'Sin asignación') AS creado_por,

    ISNULL(creador.nombre, 'Sin asignación') AS responsable_nombre,

    ISNULL(cfg.tipo_conteo, 'Sin asignación') AS tipo_conteo,

    CASE
        WHEN cfg.nro_conteo = 4 THEN 'Finalizado'
        WHEN cfg.nro_conteo IS NULL THEN 'Sin asignación'
        ELSE CAST(cfg.nro_conteo AS VARCHAR(10))
    END AS nro_conteo,

    ISNULL((
        SELECT STUFF(
            (
                SELECT ',' + c2.almacen
                FROM CAP_CONTEO_CONFIG c2
                WHERE c2.usuarios_asignados LIKE '%[' + CAST(u.id AS VARCHAR(10)) + ']%'
                  AND c2.estatus IN (0,1,4)
                FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)')
        ,1,1,'')
    ), 'Sin asignación') AS locales_csv

FROM usuarios u
LEFT JOIN usuario_rol ur
       ON ur.usuario_id = u.id
LEFT JOIN roles r
       ON r.id = ur.rol_id
LEFT JOIN usuarios creador
       ON creador.empleado = u.creado_por
LEFT JOIN CAP_CONTEO_CONFIG cfg
       ON cfg.usuarios_asignados LIKE '%[' + CAST(u.id AS VARCHAR(10)) + ']%'
      AND cfg.estatus IN (0,1,4)

ORDER BY u.empleado;


;
";

$res = mssql_query($query, $conn);
if (!$res) {
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $locales = $row['locales_csv'] !== '' ? explode(',', $row['locales_csv']) : [];
  $data[] = [
    'id'       => (int)$row['id'],
    'empleado' => $row['empleado'],
    'nombre'   => $row['nombre'],
    'email'    => $row['email'],
    'rol'      => $row['rol_id'],
    'activo'   => (int)$row['activo'],
    'creado_por'=> $row['creado_por'],
    'responsable_nombre'=> $row['responsable_nombre'],
    'tipo_conteo' => $row['tipo_conteo'],
    'nro_conteo'  => $row['nro_conteo'],
    'locales'  => array_map('trim', $locales)
  ];
}

echo json_encode(['success' => true, 'data' => $data]);
exit;
