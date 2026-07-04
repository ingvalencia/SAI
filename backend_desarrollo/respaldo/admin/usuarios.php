<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit;
}

$conn = mssql_connect("192.168.0.174", "sa", "P@ssw0rd");

if (!$conn) {
  echo json_encode([
    'success' => false,
    'error' => 'Conexión fallida'
  ]);
  exit;
}

mssql_select_db("SAP_PROCESOS", $conn);

mssql_query("SET ANSI_NULLS ON", $conn);
mssql_query("SET ANSI_WARNINGS ON", $conn);
mssql_query("SET QUOTED_IDENTIFIER ON", $conn);
mssql_query("SET CONCAT_NULL_YIELDS_NULL ON", $conn);
mssql_query("SET ANSI_PADDING ON", $conn);
mssql_query("SET ARITHABORT ON", $conn);
mssql_query("SET NUMERIC_ROUNDABORT OFF", $conn);

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
        WHEN cfg.nro_conteo = 7 THEN '4'
        WHEN cfg.nro_conteo IS NULL THEN 'Sin asignación'
        ELSE CAST(cfg.nro_conteo AS VARCHAR(10))
    END AS nro_conteo,

    ISNULL(cfg.cias, 'Sin asignación') AS cia_asignada,
    ISNULL(cfg.almacenes, 'Sin asignación') AS locales_csv

FROM SAP_PROCESOS.dbo.usuarios u
LEFT JOIN SAP_PROCESOS.dbo.usuario_rol ur
       ON ur.usuario_id = u.id
LEFT JOIN SAP_PROCESOS.dbo.roles r
       ON r.id = ur.rol_id
LEFT JOIN SAP_PROCESOS.dbo.usuarios creador
       ON creador.empleado = u.creado_por

OUTER APPLY (
    SELECT
        tipo_conteo = (
            SELECT TOP 1 c.tipo_conteo
            FROM SAP_PROCESOS.dbo.CAP_CONTEO_CONFIG c
            WHERE ',' + REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(c.usuarios_asignados, ''), '[', ''), ']', ''), '\"', ''), ' ', '') + ','
                  LIKE '%,' + CAST(u.id AS VARCHAR(10)) + ',%'
            ORDER BY c.fecha_asignacion DESC, c.nro_conteo DESC
        ),

        nro_conteo = (
            SELECT TOP 1 c.nro_conteo
            FROM SAP_PROCESOS.dbo.CAP_CONTEO_CONFIG c
            WHERE ',' + REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(c.usuarios_asignados, ''), '[', ''), ']', ''), '\"', ''), ' ', '') + ','
                  LIKE '%,' + CAST(u.id AS VARCHAR(10)) + ',%'
            ORDER BY c.fecha_asignacion DESC, c.nro_conteo DESC
        ),

        cias = STUFF((
            SELECT DISTINCT ',' + c.cia
            FROM SAP_PROCESOS.dbo.CAP_CONTEO_CONFIG c
            WHERE ',' + REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(c.usuarios_asignados, ''), '[', ''), ']', ''), '\"', ''), ' ', '') + ','
                  LIKE '%,' + CAST(u.id AS VARCHAR(10)) + ',%'
              AND ISNULL(c.cia, '') <> ''
            FOR XML PATH(''), TYPE
        ).value('.', 'VARCHAR(MAX)'), 1, 1, ''),

        almacenes = STUFF((
            SELECT DISTINCT ',' + c.almacen
            FROM SAP_PROCESOS.dbo.CAP_CONTEO_CONFIG c
            WHERE ',' + REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(c.usuarios_asignados, ''), '[', ''), ']', ''), '\"', ''), ' ', '') + ','
                  LIKE '%,' + CAST(u.id AS VARCHAR(10)) + ',%'
              AND ISNULL(c.almacen, '') <> ''
            FOR XML PATH(''), TYPE
        ).value('.', 'VARCHAR(MAX)'), 1, 1, '')
) cfg

ORDER BY u.nombre;
";

$res = mssql_query($query, $conn);

if (!$res) {
  echo json_encode([
    'success' => false,
    'error' => mssql_get_last_message()
  ]);
  exit;
}

$data = [];

while ($row = mssql_fetch_assoc($res)) {
  $locales = [];

  if (
    isset($row['locales_csv']) &&
    $row['locales_csv'] !== '' &&
    $row['locales_csv'] !== 'Sin asignación'
  ) {
    $locales = array_map('trim', explode(',', $row['locales_csv']));
    $locales = array_values(array_filter($locales, function ($v) {
      return $v !== '';
    }));
  }

  $data[] = [
    'id' => (int)$row['id'],
    'empleado' => $row['empleado'],
    'nombre' => $row['nombre'],
    'email' => $row['email'],
    'rol' => $row['rol_id'],
    'activo' => (int)$row['activo'],
    'creado_por' => $row['creado_por'],
    'responsable_nombre' => $row['responsable_nombre'],
    'cia_asignada' => $row['cia_asignada'],
    'tipo_conteo' => $row['tipo_conteo'],
    'nro_conteo' => $row['nro_conteo'],
    'locales' => $locales
  ];
}

echo json_encode([
  'success' => true,
  'data' => $data
]);

exit;
?>
