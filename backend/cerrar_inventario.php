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


$almacen  = isset($_POST['almacen'])  ? $_POST['almacen']  : null;
$fechaRaw = isset($_POST['fecha'])    ? $_POST['fecha']    : null;
$empleado = isset($_POST['empleado']) ? $_POST['empleado'] : null;
$cia      = isset($_POST['cia'])      ? $_POST['cia']      : null;

if (!$almacen || !$fechaRaw || !$empleado || !$cia) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}

$fecha = normalizarFecha($fechaRaw);
if (!$fecha) {
  echo json_encode(["success" => false, "error" => "Fecha inválida"]);
  exit;
}


$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(["success" => false, "error" => "Error de conexión"]);
  exit;
}
mssql_select_db($db, $conn);

$alm_safe = addslashes($almacen);
$cia_safe = addslashes($cia);


$sqlUser = "SELECT TOP 1 id FROM usuarios WHERE empleado = $empleado";
$resUser = mssql_query($sqlUser, $conn);
$usuario_id = null;

if ($resUser && $rowU = mssql_fetch_assoc($resUser)) {
  $usuario_id = intval($rowU['id']);
}


$sqlMaxEst = "
    SELECT MAX(estatus) AS max_estatus
    FROM CAP_INVENTARIO
    WHERE almacen   = '$alm_safe'
      AND fecha_inv = '$fecha'
      AND usuario   = $empleado
      AND cias      = '$cia_safe'
";

$resMaxEst = mssql_query($sqlMaxEst, $conn);
$max_estatus = null;

if ($resMaxEst && $rowE = mssql_fetch_assoc($resMaxEst)) {
  $max_estatus = $rowE["max_estatus"] !== null ? intval($rowE["max_estatus"]) : null;

}

if ($max_estatus !== null) {



  mssql_query("
        UPDATE CAP_INVENTARIO
        SET estatus = 4
        WHERE almacen   = '$alm_safe'
          AND fecha_inv = '$fecha'
          AND usuario   = $empleado
          AND cias      = '$cia_safe'
          AND estatus   = $max_estatus
    ", $conn);
}


$sqlMaxConteo = "
    SELECT MAX(ct.nro_conteo) AS max_conteo
    FROM CAP_INVENTARIO_CONTEOS ct
    INNER JOIN CAP_INVENTARIO i ON i.id = ct.id_inventario
    WHERE i.almacen   = '$alm_safe'
      AND i.fecha_inv = '$fecha'
      AND i.usuario   = $empleado
      AND i.cias      = '$cia_safe'
";


$resMaxConteo = mssql_query($sqlMaxConteo, $conn);
$max_conteo = null;

if ($resMaxConteo && $rowC = mssql_fetch_assoc($resMaxConteo)) {
  $max_conteo = $rowC["max_conteo"] !== null ? intval($rowC["max_conteo"]) : null;
}

if ($max_conteo !== null) {


  mssql_query("
    UPDATE CAP_INVENTARIO_CONTEOS
    SET estatus = 4
    WHERE nro_conteo = $max_conteo
      AND id_inventario IN (
          SELECT id
          FROM CAP_INVENTARIO
          WHERE almacen   = '$alm_safe'
            AND fecha_inv = '$fecha'
            AND usuario   = $empleado
            AND cias      = '$cia_safe'
      )
", $conn);

}


if ($usuario_id !== null) {

  $sqlCfg = "
        SELECT id, usuarios_asignados
        FROM CAP_CONTEO_CONFIG
        WHERE almacen = '$alm_safe'
          AND cia     = '$cia_safe'
          AND fecha_asignacion = '$fecha'
  ";

  $resCfg = mssql_query($sqlCfg, $conn);

  while ($resCfg && $rowCfg = mssql_fetch_assoc($resCfg)) {

    $id_cfg = intval($rowCfg["id"]);
    $usuariosAsignados = $rowCfg["usuarios_asignados"];


    mssql_query("
        UPDATE CAP_CONTEO_CONFIG
        SET nro_conteo = 4,
            estatus = 2
        WHERE id = $id_cfg
    ", $conn);


    $usuariosAsignados = str_replace(['[', ']', ' '], '', $usuariosAsignados);
    $ids = explode(',', $usuariosAsignados);

    foreach ($ids as $uid) {
      $uid = intval($uid);

      mssql_query("
          UPDATE SAP_PROCESOS.dbo.usuario_local
          SET activo = 0
          WHERE usuario_id = $uid
            AND local_codigo = '$alm_safe'
            AND cia = '$cia_safe'
      ", $conn);
    }
  }
}


echo json_encode([
  "success"     => true,
  "mensaje"     => "Inventario cerrado correctamente.",
  "next_status" => 4
]);
exit;
