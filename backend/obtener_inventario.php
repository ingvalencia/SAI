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

// ============================
// Detectar modo correcto PARA ESTE EMPLEADO
// - Si el empleado tiene estatus 1 y 2 => INDIVIDUAL (aunque existan otros usuarios).
// - Si no, y el empleado es parte de la pareja (estatus 1/2) => BRIGADA.
// ============================
$esBrigada = false;
$usuarioConteo1 = null;
$usuarioConteo2 = null;

// ¿Tengo conteo 1?
$sqlMiC1 = "
  SELECT TOP 1 1 AS x
  FROM CAP_INVENTARIO
  WHERE almacen='$almacen' AND fecha_inv='$fecha' AND cias='$cia'
    AND usuario=$empleado AND estatus=1
";
$rMiC1 = mssql_query($sqlMiC1, $conn);
$tengoC1 = ($rMiC1 && mssql_fetch_assoc($rMiC1)) ? true : false;

// ¿Tengo conteo 2?
$sqlMiC2 = "
  SELECT TOP 1 1 AS x
  FROM CAP_INVENTARIO
  WHERE almacen='$almacen' AND fecha_inv='$fecha' AND cias='$cia'
    AND usuario=$empleado AND estatus=2
";
$rMiC2 = mssql_query($sqlMiC2, $conn);
$tengoC2 = ($rMiC2 && mssql_fetch_assoc($rMiC2)) ? true : false;

// Solo buscar brigada si NO tengo ambos (si tengo ambos soy individual sí o sí)
if (!($tengoC1 && $tengoC2)) {
  // Buscar “pareja” (asumiendo 1 usuario para estatus 1 y 1 usuario para estatus 2)
  $sqlU1 = "
    SELECT TOP 1 usuario
    FROM CAP_INVENTARIO
    WHERE almacen='$almacen' AND fecha_inv='$fecha' AND cias='$cia'
      AND estatus=1
    ORDER BY usuario
  ";
  $sqlU2 = "
    SELECT TOP 1 usuario
    FROM CAP_INVENTARIO
    WHERE almacen='$almacen' AND fecha_inv='$fecha' AND cias='$cia'
      AND estatus=2
    ORDER BY usuario
  ";
  $rU1 = mssql_query($sqlU1, $conn);
  $rU2 = mssql_query($sqlU2, $conn);

  if ($rU1 && $rU2) {
    $rowU1 = mssql_fetch_assoc($rU1);
    $rowU2 = mssql_fetch_assoc($rU2);

    if ($rowU1 && $rowU2) {
      $usuarioConteo1 = intval($rowU1['usuario']);
      $usuarioConteo2 = intval($rowU2['usuario']);

      // Brigada solo si el empleado actual es parte de esa pareja
      if (($usuarioConteo1 === $empleado) || ($usuarioConteo2 === $empleado)) {
        $esBrigada = true;
      }
    }
  }
}

// ============================
// Construir filtro ItemCode (solo cuando aplique)
// ============================
$itemCodeIn = ""; // " AND ItemCode IN (...)"


// =====================================================
// ESTATUS 2 (INDIVIDUAL): SOLO DIFERENCIAS VS SAP
// - Base SAP: USP_INVEN_SAP
// - Conteo del usuario: CAP_INVENTARIO_CONTEOS (nro_conteo=1) ligado a CAP_INVENTARIO
// - Regresar estatus=2 SOLO para ItemCode donde (conteo1 - sap) != 0
// =====================================================
if ($estatus === 2 && !$esBrigada) {

  // 1) Base SAP
  $spSap = mssql_query("EXEC USP_INVEN_SAP '$almacen', '$fecha', $empleado, '$cia'", $conn);
  if (!$spSap) {
    echo json_encode(['success' => false, 'error' => 'Error ejecutando USP_INVEN_SAP: ' . mssql_get_last_message()]);
    exit;
  }

  $sapMap = []; // ItemCode => cant_sap
  while ($r = mssql_fetch_assoc($spSap)) {
    $code = trim($r['Codigo sap']);
    $sapMap[$code] = floatval($r['Inventario_sap']);
  }

  if (count($sapMap) === 0) {
    echo json_encode([
      'success' => true,
      'data' => [],
      'nro_conteo' => $estatus,
      'brigada' => 0
    ]);
    exit;
  }

  // 2) Conteo 1 del usuario (desde CAP_INVENTARIO_CONTEOS)
  $sqlC1 = "
    SELECT c.ItemCode, ISNULL(ct.cantidad, 0) AS cantidad
    FROM CAP_INVENTARIO c
    LEFT JOIN CAP_INVENTARIO_CONTEOS ct
      ON c.id = ct.id_inventario
     AND ct.nro_conteo = 1
    WHERE c.almacen   = '$almacen'
      AND c.fecha_inv = '$fecha'
      AND c.cias      = '$cia'
      AND c.usuario   = $empleado
      AND c.estatus   = 1
  ";
  $resC1 = mssql_query($sqlC1, $conn);
  if (!$resC1) {
    echo json_encode(['success' => false, 'error' => 'Error consultando conteo 1: ' . mssql_get_last_message()]);
    exit;
  }

  $diffCodes = [];
  while ($r = mssql_fetch_assoc($resC1)) {
    $code = trim($r['ItemCode']);
    if (!isset($sapMap[$code])) continue;

    $conteo1 = floatval($r['cantidad']);
    $sap     = floatval($sapMap[$code]);
    $dif     = round($conteo1 - $sap, 2);

    if ($dif != 0) $diffCodes[] = $code;
  }

  if (count($diffCodes) === 0) {
    echo json_encode([
      'success' => true,
      'data' => [],
      'nro_conteo' => $estatus,
      'brigada' => 0
    ]);
    exit;
  }

  $diffCodes = array_values(array_unique($diffCodes));

  $codesEsc = array_map(function($c) {
    return "'" . addslashes($c) . "'";
  }, $diffCodes);

  $itemCodeIn = " AND ItemCode IN (" . implode(",", $codesEsc) . ") ";
}


// =====================================================
// ESTATUS 7 (CUARTO CONTEO): SOLO DIFERENCIAS VS SAP
// - Base SAP: USP_INVEN_SAP
// - Conteo base: CAP_INVENTARIO_CONTEOS (nro_conteo=3) ligado a CAP_INVENTARIO (estatus=3)
// - Regresar estatus=7 SOLO para ItemCode donde (conteo3 - sap) != 0
// =====================================================
if ($estatus === 7) {

  // 1) Base SAP
  $spSap = mssql_query("EXEC USP_INVEN_SAP '$almacen', '$fecha', $empleado, '$cia'", $conn);
  if (!$spSap) {
    echo json_encode(['success' => false, 'error' => 'Error ejecutando USP_INVEN_SAP: ' . mssql_get_last_message()]);
    exit;
  }

  $sapMap = []; // ItemCode => cant_sap
  while ($r = mssql_fetch_assoc($spSap)) {
    $code = trim($r['Codigo sap']);
    $sapMap[$code] = floatval($r['Inventario_sap']);
  }

  if (count($sapMap) === 0) {
    echo json_encode([
      'success' => true,
      'data' => [],
      'nro_conteo' => $estatus,
      'brigada' => $esBrigada ? 1 : 0
    ]);
    exit;
  }

  // 2) Conteo 3 del usuario (desde CAP_INVENTARIO_CONTEOS)
  //    OJO: se lee desde estatus=3, nro_conteo=3
  $sqlC3 = "
    SELECT c.ItemCode, ISNULL(ct.cantidad, 0) AS cantidad
    FROM CAP_INVENTARIO c
    LEFT JOIN CAP_INVENTARIO_CONTEOS ct
      ON c.id = ct.id_inventario
     AND ct.nro_conteo = 3
    WHERE c.almacen   = '$almacen'
      AND c.fecha_inv = '$fecha'
      AND c.cias      = '$cia'
      AND c.usuario   = $empleado
      AND c.estatus   = 3
  ";
  $resC3 = mssql_query($sqlC3, $conn);
  if (!$resC3) {
    echo json_encode(['success' => false, 'error' => 'Error consultando conteo 3: ' . mssql_get_last_message()]);
    exit;
  }

  $diffCodes = [];
  while ($r = mssql_fetch_assoc($resC3)) {
    $code = trim($r['ItemCode']);
    if (!isset($sapMap[$code])) continue;

    $conteo3 = floatval($r['cantidad']);
    $sap     = floatval($sapMap[$code]);
    $dif     = round($conteo3 - $sap, 2);

    if ($dif != 0) $diffCodes[] = $code;
  }

  if (count($diffCodes) === 0) {
    echo json_encode([
      'success' => true,
      'data' => [],
      'nro_conteo' => $estatus,
      'brigada' => $esBrigada ? 1 : 0
    ]);
    exit;
  }

  $diffCodes = array_values(array_unique($diffCodes));
  $codesEsc = array_map(function($c) {
    return "'" . addslashes($c) . "'";
  }, $diffCodes);

  $itemCodeIn = " AND ItemCode IN (" . implode(",", $codesEsc) . ") ";
}



// =====================================================
// ESTATUS 3: SOLO DIFERENCIAS
// - Brigada: (conteo 1 usuario A) vs (conteo 2 usuario B) en CAP_INVENTARIO (cant_invfis)
// - Individual: (estatus 1) vs (estatus 2) del mismo usuario en CAP_INVENTARIO (cant_invfis)
// =====================================================
if ($estatus === 3) {

  if ($esBrigada) {
    // BRIGADA: comparar SOLO la pareja usuarioConteo1 vs usuarioConteo2
    $sqlDiff = "
      SELECT DISTINCT i1.ItemCode
      FROM CAP_INVENTARIO i1
      JOIN CAP_INVENTARIO i2
        ON i2.almacen   = i1.almacen
       AND i2.fecha_inv = i1.fecha_inv
       AND i2.cias      = i1.cias
       AND i2.ItemCode  = i1.ItemCode
       AND i2.estatus   = 2
       AND i2.usuario   = $usuarioConteo2
      WHERE i1.almacen   = '$almacen'
        AND i1.fecha_inv = '$fecha'
        AND i1.cias      = '$cia'
        AND i1.estatus   = 1
        AND i1.usuario   = $usuarioConteo1
        AND ISNULL(i1.cant_invfis,0) <> ISNULL(i2.cant_invfis,0)
    ";
  } else {
    // INDIVIDUAL: comparar estatus 1 vs estatus 2 del mismo usuario
    $sqlDiff = "
      SELECT DISTINCT i1.ItemCode
      FROM CAP_INVENTARIO i1
      JOIN CAP_INVENTARIO i2
        ON i2.almacen   = i1.almacen
       AND i2.fecha_inv = i1.fecha_inv
       AND i2.cias      = i1.cias
       AND i2.ItemCode  = i1.ItemCode
       AND i2.usuario   = i1.usuario
       AND i2.estatus   = 2
      WHERE i1.almacen   = '$almacen'
        AND i1.fecha_inv = '$fecha'
        AND i1.cias      = '$cia'
        AND i1.usuario   = $empleado
        AND i1.estatus   = 1
        AND ISNULL(i1.cant_invfis,0) <> ISNULL(i2.cant_invfis,0)
    ";
  }

  $resDiff = mssql_query($sqlDiff, $conn);
  if (!$resDiff) {
    echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
    exit;
  }

  $codes = [];
  while ($r = mssql_fetch_assoc($resDiff)) {
    $codes[] = $r['ItemCode'];
  }

  if (count($codes) === 0) {
    echo json_encode([
      'success' => true,
      'data' => [],
      'nro_conteo' => $estatus,
      'brigada' => $esBrigada ? 1 : 0
    ]);
    exit;
  }

  $codes = array_values(array_unique($codes));
  $codesEsc = array_map(function($c) {
    return "'" . addslashes($c) . "'";
  }, $codes);

  $itemCodeIn = " AND ItemCode IN (" . implode(",", $codesEsc) . ") ";
}

// ============================
// Consulta principal (con filtro opcional por ItemCode)
// ============================
$sql = "
  SELECT *
  FROM CAP_INVENTARIO
  WHERE almacen   = '$almacen'
    AND fecha_inv = '$fecha'
    AND cias      = '$cia'
    AND usuario   = $empleado
    AND estatus   = $estatus
    $itemCodeIn
";

$res = mssql_query($sql, $conn);
if (!$res) {
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}

// ============================
// Procesar resultados
// ============================
$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $data[] = array_map('utf8_encode', $row);
}

// ============================
// Respuesta final
// ============================
echo json_encode([
  'success'    => true,
  'data'       => $data,
  'nro_conteo' => $estatus,
  'brigada'    => $esBrigada ? 1 : 0
]);
exit;
?>
