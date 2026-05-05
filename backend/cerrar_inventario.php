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

$almacen  = isset($_POST['almacen'])  ? trim($_POST['almacen'])  : null;
$fechaRaw = isset($_POST['fecha'])    ? trim($_POST['fecha'])    : null;
$empleado = isset($_POST['empleado']) ? trim($_POST['empleado']) : null;
$cia      = isset($_POST['cia'])      ? trim($_POST['cia'])      : null;

if (!$almacen || !$fechaRaw || !$empleado || !$cia) {
  echo json_encode(array("success" => false, "error" => "Faltan parámetros"));
  exit;
}

$fecha = normalizarFecha($fechaRaw);

if (!$fecha) {
  echo json_encode(array("success" => false, "error" => "Fecha inválida"));
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  echo json_encode(array("success" => false, "error" => "Error de conexión"));
  exit;
}

if (!mssql_select_db($db, $conn)) {
  echo json_encode(array("success" => false, "error" => "No se pudo seleccionar la base de datos"));
  exit;
}

$alm_safe = str_replace("'", "''", $almacen);
$cia_safe = str_replace("'", "''", $cia);
$fecha_safe = str_replace("'", "''", $fecha);
$empleado_safe = intval($empleado);

$sqlUser = "
  SELECT TOP 1 id
  FROM usuarios
  WHERE empleado = $empleado_safe
";

$resUser = mssql_query($sqlUser, $conn);
$usuario_id = null;

if ($resUser && $rowU = mssql_fetch_assoc($resUser)) {
  $usuario_id = intval($rowU['id']);
}

$sqlMaxEst = "
  SELECT MAX(estatus) AS max_estatus
  FROM CAP_INVENTARIO
  WHERE almacen   = '$alm_safe'
    AND fecha_inv = '$fecha_safe'
    AND cias      = '$cia_safe'
";

$resMaxEst = mssql_query($sqlMaxEst, $conn);
$max_estatus = null;

if ($resMaxEst && $rowE = mssql_fetch_assoc($resMaxEst)) {
  $max_estatus = $rowE["max_estatus"] !== null ? intval($rowE["max_estatus"]) : null;
}

if ($max_estatus !== null && $max_estatus < 5) {
  $qUpdateInv = mssql_query("
    UPDATE CAP_INVENTARIO
    SET estatus = 4
    WHERE almacen   = '$alm_safe'
      AND fecha_inv = '$fecha_safe'
      AND cias      = '$cia_safe'
      AND estatus   < 5
  ", $conn);

  if (!$qUpdateInv) {
    echo json_encode(array("success" => false, "error" => mssql_get_last_message()));
    mssql_close($conn);
    exit;
  }
}

$sqlMaxConteo = "
  SELECT MAX(ct.nro_conteo) AS max_conteo
  FROM CAP_INVENTARIO_CONTEOS ct
  INNER JOIN CAP_INVENTARIO i ON i.id = ct.id_inventario
  WHERE i.almacen   = '$alm_safe'
    AND i.fecha_inv = '$fecha_safe'
    AND i.cias      = '$cia_safe'
";

$resMaxConteo = mssql_query($sqlMaxConteo, $conn);
$max_conteo = null;

if ($resMaxConteo && $rowC = mssql_fetch_assoc($resMaxConteo)) {
  $max_conteo = $rowC["max_conteo"] !== null ? intval($rowC["max_conteo"]) : null;
}

if ($max_conteo !== null) {
  $qUpdateConteos = mssql_query("
    UPDATE CAP_INVENTARIO_CONTEOS
    SET estatus = 4
    WHERE nro_conteo = $max_conteo
      AND id_inventario IN (
        SELECT id
        FROM CAP_INVENTARIO
        WHERE almacen   = '$alm_safe'
          AND fecha_inv = '$fecha_safe'
          AND cias      = '$cia_safe'
      )
  ", $conn);

  if (!$qUpdateConteos) {
    echo json_encode(array("success" => false, "error" => mssql_get_last_message()));
    mssql_close($conn);
    exit;
  }
}

if ($usuario_id !== null) {
  $sqlCfg = "
    SELECT id, usuarios_asignados
    FROM CAP_CONTEO_CONFIG
    WHERE almacen = '$alm_safe'
      AND cia     = '$cia_safe'
      AND fecha_asignacion = '$fecha_safe'
  ";

  $resCfg = mssql_query($sqlCfg, $conn);

  while ($resCfg && $rowCfg = mssql_fetch_assoc($resCfg)) {
    $id_cfg = intval($rowCfg["id"]);
    $usuariosAsignados = $rowCfg["usuarios_asignados"];

    $qUpdateCfg = mssql_query("
      UPDATE CAP_CONTEO_CONFIG
      SET nro_conteo = 4,
          estatus = 2
      WHERE id = $id_cfg
    ", $conn);

    if (!$qUpdateCfg) {
      echo json_encode(array("success" => false, "error" => mssql_get_last_message()));
      mssql_close($conn);
      exit;
    }

    $usuariosAsignados = str_replace(array('[', ']', ' '), '', $usuariosAsignados);
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
          echo json_encode(array("success" => false, "error" => mssql_get_last_message()));
          mssql_close($conn);
          exit;
        }
      }
    }
  }
}

echo json_encode(array(
  "success"     => true,
  "mensaje"     => "Inventario cerrado correctamente.",
  "next_status" => 4
));

mssql_close($conn);
exit;
?>
