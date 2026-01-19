<?php
header('Content-Type: application/json');

// ====================
// CORS
// ====================
$origenPermitido = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

// ====================
// Parámetros requeridos
// ====================
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

// ====================
// Conexión SQL Server
// ====================
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

// =====================================================
// Helpers
// =====================================================
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

  $map = []; // ItemCode => sap
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

  $map = []; // ItemCode => cant_invfis
  while ($r = mssql_fetch_assoc($res)) {
    $map[trim($r['ItemCode'])] = floatval($r['cant_invfis']);
  }
  return $map;
}

function loadConteo3Map($conn, $almacen, $fecha, $cia)
{
  // Conteo 3 viene de CAP_INVENTARIO_CONTEOS (nro_conteo=3) ligado a inventario estatus=3
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

  $map = []; // ItemCode => cantidad
  while ($r = mssql_fetch_assoc($res)) {
    $map[trim($r['ItemCode'])] = floatval($r['cantidad']);
  }
  return $map;
}

// =====================================================
// Detectar modo (brigada / individual) para el empleado
// =====================================================
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

// Si no tengo ambos conteos (1 y 2), intento detectar pareja
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

// =====================================================
// Variables comunes
// =====================================================
$itemCodeIn = "";
$sapMap = []; // se llena en estatus 2/3/7
$extraSelect = "";
$extraJoins  = "";

// =====================================================
// BLOQUE POR ESTATUS (separado, claro, sin mezclar)
// =====================================================
switch ($estatus) {

  // =====================================================
  // ESTATUS 1: regresa inventario del empleado (tal cual)
  // =====================================================
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

    // =====================================================
    // ESTATUS 2 (INDIVIDUAL): SOLO DIFERENCIAS VS SAP
    // =====================================================
  case 2: {
      $sql = "
    SELECT c.id AS id_inventario, c.*
    FROM CAP_INVENTARIO c
    WHERE c.almacen   = '$almacen'
      AND c.fecha_inv = '$fecha'
      AND c.cias      = '$cia'
      AND c.estatus   = 2
  ";
  $res = run($sql, $conn);
  $data = [];
  while ($row = mssql_fetch_assoc($res)) {
    $data[] = array_map('utf8_encode', $row);
  }
  json_ok($data, 2, $esBrigada);
    }

    // =====================================================
    // ESTATUS 3: DOS ESCENARIOS (lo que pediste)
    //  A) Diferencia entre conteo1 vs conteo2
    //  B) SAP>0 y conteo1=0 y conteo2=0
    // =====================================================

    case 3: {

  // =========================
  // SAP (solo con stock > 0)
  // =========================
  $sapMap = loadSapMap($conn, $almacen, $fecha, $empleado, $cia, true);
  if (count($sapMap) === 0) {
    json_ok([], 3, $esBrigada);
  }

  // =========================
  // Usuarios reales
  // =========================
  $u1 = $esBrigada ? intval($usuarioConteo1) : intval($empleado);
  $u2 = $esBrigada ? intval($usuarioConteo2) : intval($empleado);

  // =========================
  // Mapas de conteos
  // =========================
  $c1Map = loadConteoMap_CapInventario($conn, $almacen, $fecha, $cia, 1, $u1);
  $c2Map = loadConteoMap_CapInventario($conn, $almacen, $fecha, $cia, 2, $u2);

  // =========================
  // UNIVERSO REAL
  // =========================
  $allCodes = array_unique(array_merge(
    array_keys($c1Map),
    array_keys($c2Map),
    array_keys($sapMap)
  ));

  if (count($allCodes) === 0) {
    json_ok([], 3, $esBrigada);
  }

  // =========================
  // REGLAS CASE 3
  // =========================
  $diffCodes = [];

  foreach ($allCodes as $code) {

    $c1  = isset($c1Map[$code]) ? floatval($c1Map[$code]) : 0;
    $c2  = isset($c2Map[$code]) ? floatval($c2Map[$code]) : 0;
    $sap = isset($sapMap[$code]) ? floatval($sapMap[$code]) : 0;

    // A) Diferencia C1 vs C2
    if (round($c1 - $c2, 2) != 0) {
      $diffCodes[] = $code;
      continue;
    }

    // B) SAP tiene stock y nadie contó
    if ($sap > 0 && $c1 == 0 && $c2 == 0) {
      $diffCodes[] = $code;
    }
  }

  $diffCodes = array_values(array_unique($diffCodes));
  if (count($diffCodes) === 0) {
    json_ok([], 3, $esBrigada);
  }

  // =========================
  // SQL FINAL (MISMA BASE QUE CASE 7)
  // =========================
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
      base.cod_subfam,

      ISNULL(c1.conteo_1, 0) AS conteo_1,
      ISNULL(c2.conteo_2, 0) AS conteo_2

    FROM (
      SELECT
        ItemCode,
        MAX(id)          AS id_inventario,
        MAX(Itemname)    AS Itemname,
        MAX(almacen)     AS almacen,
        MAX(fecha_inv)   AS fecha_inv,
        MAX(cias)        AS cias,
        MAX(codebars)    AS codebars,
        MAX(nom_fam)     AS nom_fam,
        MAX(nom_subfam)  AS nom_subfam,
        MAX(cod_subfam)  AS cod_subfam
      FROM CAP_INVENTARIO
      WHERE almacen   = '$almacen'
        AND fecha_inv = '$fecha'
        AND cias      = '$cia'
      GROUP BY ItemCode
    ) base


    -- CONTEO 1
    LEFT JOIN (
      SELECT
        ItemCode,
        almacen,
        fecha_inv,
        cias,
        SUM(cant_invfis) AS conteo_1
      FROM CAP_INVENTARIO
      WHERE estatus = 1
      GROUP BY ItemCode, almacen, fecha_inv, cias
    ) c1
      ON c1.ItemCode  = base.ItemCode
    AND c1.almacen   = base.almacen
    AND c1.fecha_inv = base.fecha_inv
    AND c1.cias      = base.cias

    -- CONTEO 2 (MISMA FUENTE QUE CASE 7)
    LEFT JOIN (
      SELECT
        i.ItemCode,
        i.almacen,
        i.fecha_inv,
        i.cias,
        SUM(ct.cantidad) AS conteo_2
      FROM CAP_INVENTARIO i
      JOIN CAP_INVENTARIO_CONTEOS ct
        ON ct.id_inventario = i.id
      AND ct.nro_conteo = 2
      WHERE i.estatus = 2
      GROUP BY i.ItemCode, i.almacen, i.fecha_inv, i.cias
    ) c2
      ON c2.ItemCode  = base.ItemCode
    AND c2.almacen   = base.almacen
    AND c2.fecha_inv = base.fecha_inv
    AND c2.cias      = base.cias

    WHERE base.ItemCode IN (" . implode(",", $codesEsc) . ")
  ";

  $res = run($sql, $conn, 'Error SQL Caso 3: ');

  $data = [];
  while ($row = mssql_fetch_assoc($res)) {
    $code = trim($row['ItemCode']);
    $row['sap'] = isset($sapMap[$code]) ? $sapMap[$code] : 0;
    $data[] = array_map('utf8_encode', $row);
  }

  json_ok($data, 3, $esBrigada);
}




    // =====================================================
    // ESTATUS 7 (CONTEO 4): BASE = ESTATUS 1 (NO 7)
    // Regla (análoga al caso 3 pero con C3 vs SAP):
    //  A) C3 != SAP
    //  B) SAP>0 y C3==0 (o no existe C3)
    //
    // IMPORTANTE:
    // - Para que NO te regrese todo en 0, el "base row" lo tomamos del usuario de conteo 1:
    //   * Brigada: usuarioConteo1
    //   * Individual: empleado
    // =====================================================
  case 7: {

    // =========================
    // SAP (solo con stock > 0)
    // =========================
    $sapMap = loadSapMap($conn, $almacen, $fecha, $empleado, $cia, true);
    if (count($sapMap) === 0) {
      json_ok([], 7, $esBrigada);
    }

    // =========================
    // Usuarios reales
    // =========================
    $u1 = $esBrigada ? intval($usuarioConteo1) : intval($empleado);
    $u2 = $esBrigada ? intval($usuarioConteo2) : intval($empleado);

    // =========================
    // Mapas de conteos
    // =========================
    $c1Map = loadConteoMap_CapInventario($conn, $almacen, $fecha, $cia, 1, $u1);
    $c2Map = loadConteoMap_CapInventario($conn, $almacen, $fecha, $cia, 2, $u2);
    $c3Map = loadConteo3Map($conn, $almacen, $fecha, $cia);

    // =========================
    // UNIVERSO REAL
    // =========================
    $allCodes = array_unique(array_merge(
      array_keys($c1Map),
      array_keys($c2Map),
      array_keys($c3Map),
      array_keys($sapMap)
    ));

    if (count($allCodes) === 0) {
      json_ok([], 7, $esBrigada);
    }

    // =========================
    // REGLAS CONTEO 4
    // =========================
    $diffCodes = [];

    foreach ($allCodes as $code) {

      $c1  = isset($c1Map[$code]) ? floatval($c1Map[$code]) : 0;
      $c2  = isset($c2Map[$code]) ? floatval($c2Map[$code]) : 0;
      $c3  = isset($c3Map[$code]) ? floatval($c3Map[$code]) : 0;
      $sap = isset($sapMap[$code]) ? floatval($sapMap[$code]) : 0;

      // A) Diferencias entre conteos
      if (
        round($c1 - $c2, 2) != 0 ||
        round($c1 - $c3, 2) != 0 ||
        round($c2 - $c3, 2) != 0
      ) {
        $diffCodes[] = $code;
        continue;
      }

      // B) SAP tiene stock y nadie contó
      if ($sap > 0 && $c1 == 0 && $c2 == 0 && $c3 == 0) {
        $diffCodes[] = $code;
      }
    }

    $diffCodes = array_values(array_unique($diffCodes));
    if (count($diffCodes) === 0) {
      json_ok([], 7, $esBrigada);
    }

    // =========================
    // SQL FINAL (BASE SEGURA)
    // =========================
    $codesEsc = array_map(function ($c) {
      return "'" . addslashes($c) . "'";
    }, $diffCodes);

    $itemCodeIn = " AND c.ItemCode IN (" . implode(",", $codesEsc) . ") ";

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
      base.cod_subfam,

      ISNULL(c1.conteo_1, 0) AS conteo_1,
      ISNULL(c2.conteo_2, 0) AS conteo_2,
      ISNULL(c3.conteo_3, 0) AS conteo_3

   FROM (
  SELECT
    ItemCode,
    MAX(id)          AS id_inventario,
    MAX(Itemname)    AS Itemname,
    MAX(almacen)     AS almacen,
    MAX(fecha_inv)   AS fecha_inv,
    MAX(cias)        AS cias,
    MAX(codebars)    AS codebars,
    MAX(nom_fam)     AS nom_fam,
    MAX(nom_subfam)  AS nom_subfam,
    MAX(cod_subfam)  AS cod_subfam
  FROM CAP_INVENTARIO
  WHERE almacen   = '$almacen'
    AND fecha_inv = '$fecha'
    AND cias      = '$cia'
  GROUP BY ItemCode
) base


    -- CONTEO 1
    LEFT JOIN (
      SELECT
        ItemCode,
        almacen,
        fecha_inv,
        cias,
        SUM(cant_invfis) AS conteo_1
      FROM CAP_INVENTARIO
      WHERE estatus = 1
      GROUP BY ItemCode, almacen, fecha_inv, cias
    ) c1
      ON c1.ItemCode  = base.ItemCode
    AND c1.almacen   = base.almacen
    AND c1.fecha_inv = base.fecha_inv
    AND c1.cias      = base.cias

    -- CONTEO 2 (REAL)
    LEFT JOIN (
      SELECT
        i.ItemCode,
        i.almacen,
        i.fecha_inv,
        i.cias,
        SUM(ct.cantidad) AS conteo_2
      FROM CAP_INVENTARIO i
      JOIN CAP_INVENTARIO_CONTEOS ct
        ON ct.id_inventario = i.id
      AND ct.nro_conteo = 2
      WHERE i.estatus = 2
      GROUP BY i.ItemCode, i.almacen, i.fecha_inv, i.cias
    ) c2
      ON c2.ItemCode  = base.ItemCode
    AND c2.almacen   = base.almacen
    AND c2.fecha_inv = base.fecha_inv
    AND c2.cias      = base.cias

    -- CONTEO 3
    LEFT JOIN (
      SELECT
        i.ItemCode,
        i.almacen,
        i.fecha_inv,
        i.cias,
        SUM(ct.cantidad) AS conteo_3
      FROM CAP_INVENTARIO i
      JOIN CAP_INVENTARIO_CONTEOS ct
        ON ct.id_inventario = i.id
      AND ct.nro_conteo = 3
      WHERE i.estatus = 3
      GROUP BY i.ItemCode, i.almacen, i.fecha_inv, i.cias
    ) c3
      ON c3.ItemCode  = base.ItemCode
    AND c3.almacen   = base.almacen
    AND c3.fecha_inv = base.fecha_inv
    AND c3.cias      = base.cias

    WHERE base.ItemCode IN (" . implode(",", $codesEsc) . ")
    ";


    $res = run($sql, $conn, 'Error SQL Caso 7: ');

    $data = [];
    while ($row = mssql_fetch_assoc($res)) {
      $code = trim($row['ItemCode']);
      $row['sap'] = isset($sapMap[$code]) ? $sapMap[$code] : 0;
      $data[] = array_map('utf8_encode', $row);
    }

    json_ok($data, 7, $esBrigada);
  }


  default:
    // Si llega un estatus que no manejas, responde vacío
    json_ok([], $estatus, $esBrigada);
}
