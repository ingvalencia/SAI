<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

function normalizarFecha($f)
{
  if (!$f) return false;

  $f = str_replace("+", " ", $f);
  $f = str_replace(":AM", " AM", $f);
  $f = str_replace(":PM", " PM", $f);

  $ts = strtotime($f);

  if ($ts === false) return false;

  return date("Y-m-d", $ts);
}

$almacen  = isset($_POST['almacen']) ? trim($_POST['almacen']) : null;
$fechaRaw = isset($_POST['fecha']) ? trim($_POST['fecha']) : null;
$empleado = isset($_POST['empleado']) ? trim($_POST['empleado']) : null;
$cia      = isset($_POST['cia']) ? trim($_POST['cia']) : null;
$estatus  = isset($_POST['estatus']) ? intval($_POST['estatus']) : 0;

if (!$almacen || !$fechaRaw || !$empleado || !$cia) {
  echo json_encode(array(
    "success" => false,
    "error" => "Faltan parámetros"
  ));
  exit;
}

$fecha = normalizarFecha($fechaRaw);

if (!$fecha) {
  echo json_encode(array(
    "success" => false,
    "error" => "Fecha inválida"
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

$alm_safe      = str_replace("'", "''", $almacen);
$cia_safe      = str_replace("'", "''", $cia);
$fecha_safe    = str_replace("'", "''", $fecha);
$empleado_safe = intval($empleado);

$sqlUser = "
  SELECT TOP 1 id
  FROM usuarios
  WHERE empleado = CONVERT(VARCHAR(50), $empleado_safe)
";

$resUser = mssql_query($sqlUser, $conn);

if (!$resUser) {
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  mssql_close($conn);
  exit;
}

$usuario_id = null;

if ($rowU = mssql_fetch_assoc($resUser)) {
  $usuario_id = intval($rowU['id']);
}

if ($usuario_id === null) {
  echo json_encode(array(
    "success" => false,
    "error" => "Empleado no encontrado en tabla de usuarios."
  ));
  mssql_close($conn);
  exit;
}

$sqlValidacion = "
  ;WITH Conteos AS
  (
    SELECT
      i.ItemCode,
      MAX(
        CASE
          WHEN ct.nro_conteo = 1 THEN ct.cantidad
          ELSE NULL
        END
      ) AS conteo1,
      MAX(
        CASE
          WHEN ct.nro_conteo = 2 THEN ct.cantidad
          ELSE NULL
        END
      ) AS conteo2
    FROM CAP_INVENTARIO i
    INNER JOIN CAP_INVENTARIO_CONTEOS ct
      ON ct.id_inventario = i.id
    WHERE i.almacen = '$alm_safe'
      AND i.fecha_inv = '$fecha_safe'
      AND i.cias = '$cia_safe'
      AND ct.nro_conteo IN (1,2)
    GROUP BY i.ItemCode
  ),
  Comparacion AS
  (
    SELECT
      f.ItemCode,
      CAST(ISNULL(f.inventario_sap_foto, 0) AS DECIMAL(18,4)) AS sap,
      CAST(c.conteo1 AS DECIMAL(18,4)) AS conteo1,
      CAST(c.conteo2 AS DECIMAL(18,4)) AS conteo2
    FROM CAP_INVENTARIO_SAP_FOTO f
    LEFT JOIN Conteos c
      ON c.ItemCode = f.ItemCode
    WHERE f.almacen = '$alm_safe'
      AND f.fecha_inv = '$fecha_safe'
      AND f.cia = '$cia_safe'
      AND f.es_activa = 1
  )
  SELECT
    COUNT(*) AS total_articulos,
    SUM(
      CASE
        WHEN conteo1 IS NULL THEN 1
        ELSE 0
      END
    ) AS faltan_conteo1,
    SUM(
      CASE
        WHEN conteo2 IS NULL THEN 1
        ELSE 0
      END
    ) AS faltan_conteo2,
    SUM(
      CASE
        WHEN conteo1 IS NOT NULL
         AND ABS(conteo1 - sap) > 0.0001
        THEN 1
        ELSE 0
      END
    ) AS diferencias_c1_sap,
    SUM(
      CASE
        WHEN conteo2 IS NOT NULL
         AND ABS(conteo2 - sap) > 0.0001
        THEN 1
        ELSE 0
      END
    ) AS diferencias_c2_sap,
    SUM(
      CASE
        WHEN conteo1 IS NOT NULL
         AND conteo2 IS NOT NULL
         AND ABS(conteo1 - conteo2) > 0.0001
        THEN 1
        ELSE 0
      END
    ) AS diferencias_c1_c2
  FROM Comparacion
";

$resValidacion = mssql_query($sqlValidacion, $conn);

if (!$resValidacion) {
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  mssql_close($conn);
  exit;
}

$total_articulos = 0;
$faltan_conteo1 = 0;
$faltan_conteo2 = 0;
$diferencias_c1_sap = 0;
$diferencias_c2_sap = 0;
$diferencias_c1_c2 = 0;

if ($rowV = mssql_fetch_assoc($resValidacion)) {
  $total_articulos = intval($rowV['total_articulos']);
  $faltan_conteo1 = intval($rowV['faltan_conteo1']);
  $faltan_conteo2 = intval($rowV['faltan_conteo2']);
  $diferencias_c1_sap = intval($rowV['diferencias_c1_sap']);
  $diferencias_c2_sap = intval($rowV['diferencias_c2_sap']);
  $diferencias_c1_c2 = intval($rowV['diferencias_c1_c2']);
}

if ($total_articulos <= 0) {
  echo json_encode(array(
    "success" => false,
    "error" => "No se encontró información de SAP para validar el inventario."
  ));
  mssql_close($conn);
  exit;
}

if ($faltan_conteo1 > 0 || $faltan_conteo2 > 0) {
  echo json_encode(array(
    "success" => false,
    "error" => "Los conteos 1 y 2 todavía no están completos."
  ));
  mssql_close($conn);
  exit;
}

$requiere_tercer_conteo =
  $diferencias_c1_sap > 0 ||
  $diferencias_c2_sap > 0 ||
  $diferencias_c1_c2 > 0;

if ($requiere_tercer_conteo && $estatus < 3) {
  echo json_encode(array(
    "success" => true,
    "mensaje" => "Se detectaron diferencias. Es necesario realizar el tercer conteo.",
    "requiere_tercer_conteo" => true,
    "next_status" => 3,
    "diferencias_c1_sap" => $diferencias_c1_sap,
    "diferencias_c2_sap" => $diferencias_c2_sap,
    "diferencias_c1_c2" => $diferencias_c1_c2
  ));
  mssql_close($conn);
  exit;
}

$sqlMaxEst = "
  SELECT MAX(estatus) AS max_estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$alm_safe'
    AND fecha_inv = '$fecha_safe'
    AND cias = '$cia_safe'
";

$resMaxEst = mssql_query($sqlMaxEst, $conn);

if (!$resMaxEst) {
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  mssql_close($conn);
  exit;
}

$max_estatus = null;

if ($rowE = mssql_fetch_assoc($resMaxEst)) {
  $max_estatus = $rowE["max_estatus"] !== null
    ? intval($rowE["max_estatus"])
    : null;
}

if ($max_estatus !== null && $max_estatus < 5) {

  $qUpdateInv = mssql_query("
    UPDATE CAP_INVENTARIO
    SET estatus = 4
    WHERE almacen = '$alm_safe'
      AND fecha_inv = '$fecha_safe'
      AND cias = '$cia_safe'
      AND estatus < 5
  ", $conn);

  if (!$qUpdateInv) {
    echo json_encode(array(
      "success" => false,
      "error" => mssql_get_last_message()
    ));
    mssql_close($conn);
    exit;
  }
}

$sqlMaxConteo = "
  SELECT MAX(ct.nro_conteo) AS max_conteo
  FROM CAP_INVENTARIO_CONTEOS ct
  INNER JOIN CAP_INVENTARIO i
    ON i.id = ct.id_inventario
  WHERE i.almacen = '$alm_safe'
    AND i.fecha_inv = '$fecha_safe'
    AND i.cias = '$cia_safe'
";

$resMaxConteo = mssql_query($sqlMaxConteo, $conn);

if (!$resMaxConteo) {
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  mssql_close($conn);
  exit;
}

$max_conteo = null;

if ($rowC = mssql_fetch_assoc($resMaxConteo)) {
  $max_conteo = $rowC["max_conteo"] !== null
    ? intval($rowC["max_conteo"])
    : null;
}

if ($max_conteo !== null) {

  $qUpdateConteos = mssql_query("
    UPDATE CAP_INVENTARIO_CONTEOS
    SET estatus = 4
    WHERE nro_conteo = $max_conteo
      AND id_inventario IN (
        SELECT id
        FROM CAP_INVENTARIO
        WHERE almacen = '$alm_safe'
          AND fecha_inv = '$fecha_safe'
          AND cias = '$cia_safe'
      )
  ", $conn);

  if (!$qUpdateConteos) {
    echo json_encode(array(
      "success" => false,
      "error" => mssql_get_last_message()
    ));
    mssql_close($conn);
    exit;
  }
}

$sqlCfg = "
  SELECT
    id,
    usuarios_asignados
  FROM CAP_CONTEO_CONFIG
  WHERE almacen = '$alm_safe'
    AND cia = '$cia_safe'
    AND CONVERT(date, fecha_asignacion) = '$fecha_safe'
";

$resCfg = mssql_query($sqlCfg, $conn);

if (!$resCfg) {
  echo json_encode(array(
    "success" => false,
    "error" => mssql_get_last_message()
  ));
  mssql_close($conn);
  exit;
}

while ($rowCfg = mssql_fetch_assoc($resCfg)) {

  $id_cfg = intval($rowCfg["id"]);
  $usuariosAsignados = $rowCfg["usuarios_asignados"];

  $qUpdateCfg = mssql_query("
    UPDATE CAP_CONTEO_CONFIG
    SET estatus = 2
    WHERE id = $id_cfg
  ", $conn);

  if (!$qUpdateCfg) {
    echo json_encode(array(
      "success" => false,
      "error" => mssql_get_last_message()
    ));
    mssql_close($conn);
    exit;
  }

  $usuariosAsignados = str_replace(
    array('[', ']', ' '),
    '',
    $usuariosAsignados
  );

  $ids = explode(',', $usuariosAsignados);

  foreach ($ids as $uid) {

    $uid = intval($uid);

    if ($uid > 0) {

      $qUpdateLocal = mssql_query("
        UPDATE SAP_PROCESOS.dbo.usuario_local
        SET activo = 0
        WHERE usuario_id = $uid
          AND local_codigo = '$alm_safe'
          AND cia = '$cia_safe'
      ", $conn);

      if (!$qUpdateLocal) {
        echo json_encode(array(
          "success" => false,
          "error" => mssql_get_last_message()
        ));
        mssql_close($conn);
        exit;
      }
    }
  }
}

echo json_encode(array(
  "success" => true,
  "mensaje" => "Inventario cerrado correctamente.",
  "requiere_tercer_conteo" => false,
  "next_status" => 4,
  "diferencias_c1_sap" => $diferencias_c1_sap,
  "diferencias_c2_sap" => $diferencias_c2_sap,
  "diferencias_c1_c2" => $diferencias_c1_c2
));

mssql_close($conn);
exit;
?>
