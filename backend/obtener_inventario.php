<?php
header('Content-Type: application/json');


$origenPermitido = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}


$almacen  = isset($_GET['almacen'])  ? trim(addslashes($_GET['almacen']))  : null;
$fecha    = isset($_GET['fecha'])    ? trim(addslashes($_GET['fecha']))    : null;
$empleado = isset($_GET['empleado']) ? intval($_GET['empleado'])           : null;
$estatus  = isset($_GET['estatus'])  ? intval($_GET['estatus'])            : 1;
$cia      = isset($_GET['cia'])      ? trim(addslashes($_GET['cia']))      : null;

if (!$almacen || !$fecha || !$empleado || !$cia) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
  exit;
}
if ($estatus < 1) $estatus = 1;


$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'No se pudo conectar a la base de datos']);
  exit;
}
mssql_select_db($db, $conn);


function json_ok($data, $estatus, $brigada)
{
  echo json_encode([
    'success'    => true,
    'data'       => $data,
    'nro_conteo' => $estatus,
    'brigada'    => $brigada ? 1 : 0
  ]);
  exit;
}

function json_fail($msg)
{
  echo json_encode(['success' => false, 'error' => $msg]);
  exit;
}

function run($sql, $conn, $errPrefix = 'Error SQL: ')
{
  $r = mssql_query($sql, $conn);
  if (!$r) json_fail($errPrefix . mssql_get_last_message());
  return $r;
}

function loadSapMap($conn, $almacen, $fecha, $empleado, $cia, $soloNoCero = true)
{
  $spSap = mssql_query("EXEC USP_INVEN_SAP '$almacen', '$fecha', $empleado, '$cia'", $conn);
  if (!$spSap) json_fail('Error ejecutando USP_INVEN_SAP: ' . mssql_get_last_message());

  $map = [];
  while ($r = mssql_fetch_assoc($spSap)) {
    $code = trim($r['Codigo sap']);
    $sap  = floatval($r['Inventario_sap']);
    if ($soloNoCero) {
      if ($sap != 0) $map[$code] = $sap;
    } else {
      $map[$code] = $sap;
    }
  }
  return $map;
}

function loadConteoMap_CapInventario($conn, $almacen, $fecha, $cia, $estatus, $usuario = null)
{
  $whereUser = ($usuario !== null) ? " AND usuario = $usuario " : "";
  $res = run("
    SELECT ItemCode, cant_invfis
    FROM CAP_INVENTARIO
    WHERE almacen   = '$almacen'
      AND fecha_inv = '$fecha'
      AND cias      = '$cia'
      AND estatus   = $estatus
      $whereUser
  ", $conn, "Error consultando CAP_INVENTARIO estatus=$estatus: ");

  $map = [];
  while ($r = mssql_fetch_assoc($res)) {
    $map[trim($r['ItemCode'])] = floatval($r['cant_invfis']);
  }
  return $map;
}

function loadConteo3Map($conn, $almacen, $fecha, $cia)
{

  $res = run("
    SELECT c.ItemCode, ISNULL(ct.cantidad, 0) AS cantidad
    FROM CAP_INVENTARIO c
    LEFT JOIN CAP_INVENTARIO_CONTEOS ct
      ON ct.id_inventario = c.id
     AND ct.nro_conteo = 3
    WHERE c.almacen   = '$almacen'
      AND c.fecha_inv = '$fecha'
      AND c.cias      = '$cia'
      AND c.estatus   = 3
  ", $conn, "Error consultando conteo 3: ");

  $map = [];
  while ($r = mssql_fetch_assoc($res)) {
    $map[trim($r['ItemCode'])] = floatval($r['cantidad']);
  }
  return $map;
}


$esBrigada = false;
$usuarioConteo1 = null;
$usuarioConteo2 = null;

$rMiC1 = mssql_query("
  SELECT TOP 1 1 AS x
  FROM CAP_INVENTARIO
  WHERE almacen='$almacen' AND fecha_inv='$fecha' AND cias='$cia'
    AND usuario=$empleado AND estatus=1
", $conn);
$tengoC1 = ($rMiC1 && mssql_fetch_assoc($rMiC1)) ? true : false;

$rMiC2 = mssql_query("
  SELECT TOP 1 1 AS x
  FROM CAP_INVENTARIO
  WHERE almacen='$almacen' AND fecha_inv='$fecha' AND cias='$cia'
    AND usuario=$empleado AND estatus=2
", $conn);
$tengoC2 = ($rMiC2 && mssql_fetch_assoc($rMiC2)) ? true : false;


if (!($tengoC1 && $tengoC2)) {
  $rU1 = mssql_query("
    SELECT TOP 1 usuario
    FROM CAP_INVENTARIO
    WHERE almacen='$almacen' AND fecha_inv='$fecha' AND cias='$cia' AND estatus=1
    ORDER BY usuario
  ", $conn);

  $rU2 = mssql_query("
    SELECT TOP 1 usuario
    FROM CAP_INVENTARIO
    WHERE almacen='$almacen' AND fecha_inv='$fecha' AND cias='$cia' AND estatus=2
    ORDER BY usuario
  ", $conn);

  if ($rU1 && $rU2) {
    $rowU1 = mssql_fetch_assoc($rU1);
    $rowU2 = mssql_fetch_assoc($rU2);
    if ($rowU1 && $rowU2) {
      $usuarioConteo1 = intval($rowU1['usuario']);
      $usuarioConteo2 = intval($rowU2['usuario']);
      if ($usuarioConteo1 === $empleado || $usuarioConteo2 === $empleado) {
        $esBrigada = true;
      }
    }
  }
}


$itemCodeIn = "";
$sapMap = [];
$extraSelect = "";
$extraJoins  = "";


switch ($estatus) {


  case 1: {
      $sql = "
      SELECT  c.id AS id_inventario,c.*
      FROM CAP_INVENTARIO c
      WHERE c.almacen   = '$almacen'
        AND c.fecha_inv = '$fecha'
        AND c.cias      = '$cia'
        AND c.usuario   = $empleado
        AND c.estatus   = 1
    ";
      $res = run($sql, $conn);
      $data = [];
      while ($row = mssql_fetch_assoc($res)) {
        $data[] = array_map('utf8_encode', $row);
      }
      json_ok($data, 1, $esBrigada);
    }


  case 2: {

  if ($esBrigada) {

    $sql = "
      SELECT c.id AS id_inventario, c.*
      FROM CAP_INVENTARIO c
      WHERE c.almacen   = '$almacen'
        AND c.fecha_inv = '$fecha'
        AND c.cias      = '$cia'
        AND c.estatus   = 2
    ";

  } else {

    $sql = "
      SELECT
        c.id AS id_inventario,
        c.ItemCode,
        c.Itemname,
        c.almacen,
        c.fecha_inv,
        c.cias,
        c.codebars,
        c.nom_fam,
        c.nom_subfam,
        c.cod_subfam,
        ISNULL(ct.cantidad,0) AS cant_invfis
      FROM CAP_INVENTARIO c
      LEFT JOIN CAP_INVENTARIO_CONTEOS ct
        ON ct.id_inventario = c.id
       AND ct.nro_conteo = 2
       AND ct.usuario = $empleado
      WHERE c.almacen   = '$almacen'
        AND c.fecha_inv = '$fecha'
        AND c.cias      = '$cia'
    ";
  }

  $res = run($sql, $conn);
  $data = [];

  while ($row = mssql_fetch_assoc($res)) {
    $data[] = array_map('utf8_encode', $row);
  }

  json_ok($data, 2, $esBrigada);
}



  case 3: {

  $sapMap = loadSapMap($conn, $almacen, $fecha, $empleado, $cia, false);

  if (count($sapMap) === 0) {
    json_ok([], 3, $esBrigada);
  }

  if ($esBrigada) {

    $c1Map = loadConteoMap_CapInventario($conn, $almacen, $fecha, $cia, 1, $usuarioConteo1);
    $c2Map = loadConteoMap_CapInventario($conn, $almacen, $fecha, $cia, 2, $usuarioConteo2);
    $c3Map = loadConteo3Map($conn, $almacen, $fecha, $cia);

  } else {

    $c1Map = [];
    $resC1 = run("
      SELECT i.ItemCode, SUM(ct.cantidad) AS cantidad
      FROM CAP_INVENTARIO i
      JOIN CAP_INVENTARIO_CONTEOS ct
        ON ct.id_inventario = i.id
       AND ct.nro_conteo = 1
      WHERE i.almacen   = '$almacen'
        AND i.fecha_inv = '$fecha'
        AND i.cias      = '$cia'
        AND i.usuario   = $empleado
      GROUP BY i.ItemCode
    ", $conn);

    while ($r = mssql_fetch_assoc($resC1)) {
      $c1Map[trim($r['ItemCode'])] = floatval($r['cantidad']);
    }

    $c2Map = [];
    $resC2 = run("
      SELECT i.ItemCode, SUM(ct.cantidad) AS cantidad
      FROM CAP_INVENTARIO i
      JOIN CAP_INVENTARIO_CONTEOS ct
        ON ct.id_inventario = i.id
       AND ct.nro_conteo = 2
      WHERE i.almacen   = '$almacen'
        AND i.fecha_inv = '$fecha'
        AND i.cias      = '$cia'
        AND i.usuario   = $empleado
      GROUP BY i.ItemCode
    ", $conn);

    while ($r = mssql_fetch_assoc($resC2)) {
      $c2Map[trim($r['ItemCode'])] = floatval($r['cantidad']);
    }

    $c3Map = [];
    $resC3 = run("
      SELECT i.ItemCode, SUM(ct.cantidad) AS cantidad
      FROM CAP_INVENTARIO i
      JOIN CAP_INVENTARIO_CONTEOS ct
        ON ct.id_inventario = i.id
       AND ct.nro_conteo = 3
      WHERE i.almacen   = '$almacen'
        AND i.fecha_inv = '$fecha'
        AND i.cias      = '$cia'
        AND i.usuario   = $empleado
      GROUP BY i.ItemCode
    ", $conn);

    while ($r = mssql_fetch_assoc($resC3)) {
      $c3Map[trim($r['ItemCode'])] = floatval($r['cantidad']);
    }
  }

  $allCodes = array_unique(array_merge(
    array_keys($c1Map),
    array_keys($c2Map),
    array_keys($c3Map),
    array_keys($sapMap)
  ));

  if (count($allCodes) === 0) {
    json_ok([], 3, $esBrigada);
  }

  $diffCodes = [];

  foreach ($allCodes as $code) {

    $c1  = isset($c1Map[$code]) ? floatval($c1Map[$code]) : 0;
    $c2  = isset($c2Map[$code]) ? floatval($c2Map[$code]) : 0;
    $c3  = isset($c3Map[$code]) ? floatval($c3Map[$code]) : 0;
    $sap = isset($sapMap[$code]) ? floatval($sapMap[$code]) : 0;

    $diferencia =
        round($c1 - $c3, 2) != 0 ||
        round($c2 - $c3, 2) != 0 ||
        round($c3 - $sap, 2) != 0;

    if ($diferencia) {
      $diffCodes[] = $code;
    }
  }

  $diffCodes = array_values(array_unique($diffCodes));

  if (count($diffCodes) === 0) {
    json_ok([], 3, $esBrigada);
  }

  $codesEsc = array_map(function ($c) {
    return "'" . addslashes($c) . "'";
  }, $diffCodes);

  $sql = "
    SELECT
      base.id_inventario,
      base.ItemCode,
      base.Itemname,
      base.almacen,
      base.fecha_inv,
      base.cias,
      base.codebars,
      base.nom_fam,
      base.nom_subfam,
      base.cod_subfam
    FROM (
      SELECT
        ItemCode,
        MAX(id) AS id_inventario,
        MAX(Itemname) AS Itemname,
        MAX(almacen) AS almacen,
        MAX(fecha_inv) AS fecha_inv,
        MAX(cias) AS cias,
        MAX(codebars) AS codebars,
        MAX(nom_fam) AS nom_fam,
        MAX(nom_subfam) AS nom_subfam,
        MAX(cod_subfam) AS cod_subfam
      FROM CAP_INVENTARIO
      WHERE almacen   = '$almacen'
        AND fecha_inv = '$fecha'
        AND cias      = '$cia'
      GROUP BY ItemCode
    ) base
    WHERE base.ItemCode IN (" . implode(",", $codesEsc) . ")
  ";

  $res = run($sql, $conn);

  $data = [];
  while ($row = mssql_fetch_assoc($res)) {
    $code = trim($row['ItemCode']);
    $row['conteo_1'] = isset($c1Map[$code]) ? $c1Map[$code] : 0;
    $row['conteo_2'] = isset($c2Map[$code]) ? $c2Map[$code] : 0;
    $row['conteo_3'] = isset($c3Map[$code]) ? $c3Map[$code] : 0;
    $row['sap']      = isset($sapMap[$code]) ? $sapMap[$code] : 0;
    $data[] = array_map('utf8_encode', $row);
  }

  json_ok($data, 3, $esBrigada);
}

    case 7: {

  $sapMap = loadSapMap($conn, $almacen, $fecha, $empleado, $cia, false);

  if ($esBrigada) {

    $c1Map = loadConteoMap_CapInventario($conn, $almacen, $fecha, $cia, 1, $usuarioConteo1);
    $c2Map = loadConteoMap_CapInventario($conn, $almacen, $fecha, $cia, 2, $usuarioConteo2);
    $c3Map = loadConteo3Map($conn, $almacen, $fecha, $cia);

  } else {

    $c1Map = [];
    $resC1 = run("
      SELECT i.ItemCode, SUM(ct.cantidad) AS cantidad
      FROM CAP_INVENTARIO i
      JOIN CAP_INVENTARIO_CONTEOS ct
        ON ct.id_inventario = i.id
       AND ct.nro_conteo = 1
      WHERE i.almacen   = '$almacen'
        AND i.fecha_inv = '$fecha'
        AND i.cias      = '$cia'
        AND i.usuario   = $empleado
      GROUP BY i.ItemCode
    ", $conn);

    while ($r = mssql_fetch_assoc($resC1)) {
      $c1Map[trim($r['ItemCode'])] = floatval($r['cantidad']);
    }

    $c2Map = [];
    $resC2 = run("
      SELECT i.ItemCode, SUM(ct.cantidad) AS cantidad
      FROM CAP_INVENTARIO i
      JOIN CAP_INVENTARIO_CONTEOS ct
        ON ct.id_inventario = i.id
       AND ct.nro_conteo = 2
      WHERE i.almacen   = '$almacen'
        AND i.fecha_inv = '$fecha'
        AND i.cias      = '$cia'
        AND i.usuario   = $empleado
      GROUP BY i.ItemCode
    ", $conn);

    while ($r = mssql_fetch_assoc($resC2)) {
      $c2Map[trim($r['ItemCode'])] = floatval($r['cantidad']);
    }

    $c3Map = [];
    $resC3 = run("
      SELECT i.ItemCode, SUM(ct.cantidad) AS cantidad
      FROM CAP_INVENTARIO i
      JOIN CAP_INVENTARIO_CONTEOS ct
        ON ct.id_inventario = i.id
       AND ct.nro_conteo = 3
      WHERE i.almacen   = '$almacen'
        AND i.fecha_inv = '$fecha'
        AND i.cias      = '$cia'
        AND i.usuario   = $empleado
      GROUP BY i.ItemCode
    ", $conn);

    while ($r = mssql_fetch_assoc($resC3)) {
      $c3Map[trim($r['ItemCode'])] = floatval($r['cantidad']);
    }
  }

  $allCodes = array_unique(array_merge(
    array_keys($c1Map),
    array_keys($c2Map),
    array_keys($c3Map),
    array_keys($sapMap)
  ));

  if (count($allCodes) === 0) {
    json_ok([], 7, $esBrigada);
  }

  $diffCodes = [];

  foreach ($allCodes as $code) {

    $c1  = isset($c1Map[$code]) ? floatval($c1Map[$code]) : 0;
    $c2  = isset($c2Map[$code]) ? floatval($c2Map[$code]) : 0;
    $c3  = isset($c3Map[$code]) ? floatval($c3Map[$code]) : 0;
    $sap = isset($sapMap[$code]) ? floatval($sapMap[$code]) : 0;

    $diferenciaSAP = round($c3 - $sap, 2) != 0;

    if ($diferenciaSAP) {
      $diffCodes[] = $code;
    }


  }

  $diffCodes = array_values(array_unique($diffCodes));

  if (count($diffCodes) === 0) {
    json_ok([], 7, $esBrigada);
  }

  $codesEsc = array_map(function ($c) {
    return "'" . addslashes($c) . "'";
  }, $diffCodes);

  $sql = "
    SELECT
      base.id_inventario,
      base.ItemCode,
      base.Itemname,
      base.almacen,
      base.fecha_inv,
      base.cias,
      base.codebars,
      base.nom_fam,
      base.nom_subfam,
      base.cod_subfam
    FROM (
      SELECT
        ItemCode,
        MAX(id) AS id_inventario,
        MAX(Itemname) AS Itemname,
        MAX(almacen) AS almacen,
        MAX(fecha_inv) AS fecha_inv,
        MAX(cias) AS cias,
        MAX(codebars) AS codebars,
        MAX(nom_fam) AS nom_fam,
        MAX(nom_subfam) AS nom_subfam,
        MAX(cod_subfam) AS cod_subfam
      FROM CAP_INVENTARIO
      WHERE almacen   = '$almacen'
        AND fecha_inv = '$fecha'
        AND cias      = '$cia'
      GROUP BY ItemCode
    ) base
    WHERE base.ItemCode IN (" . implode(",", $codesEsc) . ")
  ";

  $res = run($sql, $conn);

  $data = [];
  while ($row = mssql_fetch_assoc($res)) {
    $code = trim($row['ItemCode']);
    $row['conteo_1'] = isset($c1Map[$code]) ? $c1Map[$code] : 0;
    $row['conteo_2'] = isset($c2Map[$code]) ? $c2Map[$code] : 0;
    $row['conteo_3'] = isset($c3Map[$code]) ? $c3Map[$code] : 0;
    $row['sap'] = isset($sapMap[$code]) ? $sapMap[$code] : 0;
    $data[] = array_map('utf8_encode', $row);
  }

  json_ok($data, 7, $esBrigada);
}


  default:

    json_ok([], $estatus, $esBrigada);
}
