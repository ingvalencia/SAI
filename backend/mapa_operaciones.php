<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$cia   = isset($_GET['cia']) ? trim($_GET['cia']) : null;
$fecha = isset($_GET['fecha']) ? trim($_GET['fecha']) : null;

if (!$cia || !$fecha) {
  echo json_encode(array(
    "success" => false,
    "error" => "Faltan parámetros"
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
    "error" => "Conexión fallida"
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

$ciaSafe   = str_replace("'", "''", $cia);
$fechaSafe = str_replace("'", "''", $fecha);

$query = "
;WITH Inventario AS
(
    SELECT
        almacen,
        MAX(
            CASE
                WHEN estatus = 7 THEN 4
                ELSE estatus
            END
        ) AS estatus
    FROM dbo.CAP_INVENTARIO
    WHERE cias = '$ciaSafe'
      AND CONVERT(DATE, fecha_inv) = '$fechaSafe'
    GROUP BY almacen
),
Conteos AS
(
    SELECT
        i.almacen,
        MAX(
            CASE
                WHEN ct.nro_conteo = 1 THEN 1
                ELSE 0
            END
        ) AS tiene_c1,
        MAX(
            CASE
                WHEN ct.nro_conteo = 2 THEN 1
                ELSE 0
            END
        ) AS tiene_c2
    FROM dbo.CAP_INVENTARIO i
    INNER JOIN dbo.CAP_INVENTARIO_CONTEOS ct
        ON ct.id_inventario = i.id
    WHERE i.cias = '$ciaSafe'
      AND CONVERT(DATE, i.fecha_inv) = '$fechaSafe'
    GROUP BY i.almacen
),
Configuracion AS
(
    SELECT
        almacen,
        MAX(
            CASE
                WHEN nro_conteo = 3 THEN 1
                ELSE 0
            END
        ) AS tiene_c3
    FROM dbo.CAP_CONTEO_CONFIG
    WHERE cia = '$ciaSafe'
      AND CONVERT(DATE, fecha_asignacion) = '$fechaSafe'
    GROUP BY almacen
),
Base AS
(
    SELECT
        i.almacen,
        i.estatus,
        ISNULL(c.tiene_c1, 0) AS tiene_c1,
        ISNULL(c.tiene_c2, 0) AS tiene_c2,
        ISNULL(cfg.tiene_c3, 0) AS tiene_c3
    FROM Inventario i
    LEFT JOIN Conteos c
        ON c.almacen = i.almacen
    LEFT JOIN Configuracion cfg
        ON cfg.almacen = i.almacen
)
SELECT
    b.almacen,
    CASE
        WHEN cie.id_cierre IS NOT NULL THEN 5
        ELSE b.estatus
    END AS estatus
FROM Base b
LEFT JOIN dbo.CAP_INVENTARIO_CIERRE cie
    ON cie.cia = '$ciaSafe'
   AND CONVERT(DATE, cie.fecha_inventario) = '$fechaSafe'
   AND cie.almacen = b.almacen
   AND ISNULL(cie.activo, 1) = 1
WHERE NOT (
    b.estatus = 2
    AND b.tiene_c1 = 1
    AND b.tiene_c2 = 1
    AND b.tiene_c3 = 0
)
ORDER BY estatus DESC, b.almacen
";

$result = mssql_query($query, $conn);

if (!$result) {
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  mssql_close($conn);
  exit;
}

$bloques = array();

while ($row = mssql_fetch_assoc($result)) {

  $estatus = intval($row["estatus"]);
  $almacen = trim($row["almacen"]);

  if (!isset($bloques[$estatus])) {
    $bloques[$estatus] = array(
      "estatus" => $estatus,
      "registros" => array()
    );
  }

  $bloques[$estatus]["registros"][] = array(
    "almacen" => $almacen,
    "estatus" => $estatus
  );
}

echo json_encode(array(
  "success" => true,
  "data" => array_values($bloques)
));

mssql_close($conn);
exit;
?>
