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

  $itemCodeIn = " AND c.ItemCode IN (" . implode(",", $codesEsc) . ") ";
}


// =====================================================
// ESTATUS 7 (CUARTO CONTEO): SOLO DIFERENCIAS VS SAP
// - Base SAP: USP_INVEN_SAP
// - Conteo base: CAP_INVENTARIO_CONTEOS (nro_conteo=3) ligado a CAP_INVENTARIO (estatus=3)
// - Regresar estatus=7 SOLO para ItemCode donde (conteo3 - sap) != 0
// =====================================================
if ($estatus === 7) {

  // =====================================================
  // 1) Base SAP (SAP MANDA)
  // =====================================================
  $spSap = mssql_query("EXEC USP_INVEN_SAP '$almacen', '$fecha', $empleado, '$cia'", $conn);
  if (!$spSap) {
    echo json_encode([
      'success' => false,
      'error' => 'Error ejecutando USP_INVEN_SAP: ' . mssql_get_last_message()
    ]);
    exit;
  }

  $sapMap = []; // ItemCode => cant_sap (solo SAP != 0)
  while ($r = mssql_fetch_assoc($spSap)) {
    $code = trim($r['Codigo sap']);
    $sap  = floatval($r['Inventario_sap']);

    if ($sap != 0) {
      $sapMap[$code] = $sap;
    }
  }

  if (count($sapMap) === 0) {
    echo json_encode([
      'success'    => true,
      'data'       => [],
      'nro_conteo' => $estatus,
      'brigada'    => $esBrigada ? 1 : 0
    ]);
    exit;
  }

  // =====================================================
  // 2) Conteo 1 (puede NO existir)
  // =====================================================
  $c1Map = [];
  $resC1 = mssql_query("
    SELECT ItemCode, cant_invfis
    FROM CAP_INVENTARIO
    WHERE almacen   = '$almacen'
      AND fecha_inv = '$fecha'
      AND cias      = '$cia'
      AND estatus   = 1
  ", $conn);

  while ($r = mssql_fetch_assoc($resC1)) {
    $c1Map[trim($r['ItemCode'])] = floatval($r['cant_invfis']);
  }

  // =====================================================
  // 3) Conteo 2 (puede NO existir)
  // =====================================================
  $c2Map = [];
  $resC2 = mssql_query("
    SELECT ItemCode, cant_invfis
    FROM CAP_INVENTARIO
    WHERE almacen   = '$almacen'
      AND fecha_inv = '$fecha'
      AND cias      = '$cia'
      AND estatus   = 2
  ", $conn);

  while ($r = mssql_fetch_assoc($resC2)) {
    $c2Map[trim($r['ItemCode'])] = floatval($r['cant_invfis']);
  }

  // =====================================================
  // 4) Conteo 3 (puede NO existir)
  // =====================================================
  $conteo3Map = [];
  $resC3 = mssql_query("
    SELECT c.ItemCode, ct.cantidad
    FROM CAP_INVENTARIO c
    LEFT JOIN CAP_INVENTARIO_CONTEOS ct
      ON ct.id_inventario = c.id
     AND ct.nro_conteo = 3
    WHERE c.almacen   = '$almacen'
      AND c.fecha_inv = '$fecha'
      AND c.cias      = '$cia'
      AND c.estatus   = 3
  ", $conn);

  while ($r = mssql_fetch_assoc($resC3)) {
    $conteo3Map[trim($r['ItemCode'])] = floatval($r['cantidad']);
  }

  // =====================================================
  // 5) DIFERENCIA REAL PARA CUARTO CONTEO
  // Regla FINAL:
  // - SAP != 0
  // - NO conciliado en conteo 2 (c1=c2=SAP => SE EXCLUYE)
  // - Y (no existe conteo 3 OR conteo 3 != SAP)
  // =====================================================
  $diffCodes = [];

  foreach ($sapMap as $code => $sap) {

    // 🔕 Si ya quedó conciliado en conteo 2 vs SAP, SE IGNORA
    if (
      isset($c1Map[$code]) &&
      isset($c2Map[$code]) &&
      round($c1Map[$code] - $c2Map[$code], 2) == 0 &&
      round($c2Map[$code] - $sap, 2) == 0
    ) {
      continue;
    }

    // Si no existe conteo 3 → DIFERENCIA
    if (!isset($conteo3Map[$code])) {
      $diffCodes[] = $code;
      continue;
    }

    // Si conteo 3 ≠ SAP → DIFERENCIA
    if (round($conteo3Map[$code] - $sap, 2) != 0) {
      $diffCodes[] = $code;
    }
  }

  if (count($diffCodes) === 0) {
    echo json_encode([
      'success'    => true,
      'data'       => [],
      'nro_conteo' => $estatus,
      'brigada'    => $esBrigada ? 1 : 0
    ]);
    exit;
  }

  // =====================================================
  // 6) Filtro final por ItemCode
  // =====================================================
  $codesEsc = array_map(function($c) {
    return "'" . addslashes($c) . "'";
  }, array_unique($diffCodes));

  $itemCodeIn = " AND c.ItemCode IN (" . implode(",", $codesEsc) . ") ";
}



// =====================================================
// ESTATUS 3 (TERCER CONTEO): DIFERENCIAS REALES CON SAP COMO BASE
// Regla:
// SAP ≠ 0
// y (NO existe conteo 1 OR NO existe conteo 2 OR conteo 1 ≠ conteo 2)
// NULL cuenta como diferencia
// Aplica igual para INDIVIDUAL y BRIGADA
// =====================================================
if ($estatus === 3) {

  // 1) Base SAP (SAP MANDA)
  $spSap = mssql_query("EXEC USP_INVEN_SAP '$almacen', '$fecha', $empleado, '$cia'", $conn);
  if (!$spSap) {
    echo json_encode(['success' => false, 'error' => 'Error ejecutando USP_INVEN_SAP: ' . mssql_get_last_message()]);
    exit;
  }

  $sapMap = []; // ItemCode => cant_sap (solo SAP ≠ 0)
  while ($r = mssql_fetch_assoc($spSap)) {
    $code = trim($r['Codigo sap']);
    $sap  = floatval($r['Inventario_sap']);
    if ($sap != 0) {
      $sapMap[$code] = $sap;
    }
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

  // 2) Conteo 1 (puede NO existir)
  $sqlC1 = "
    SELECT ItemCode, cant_invfis
    FROM CAP_INVENTARIO
    WHERE almacen   = '$almacen'
      AND fecha_inv = '$fecha'
      AND cias      = '$cia'
      AND estatus   = 1
      AND usuario   = " . ($esBrigada ? intval($usuarioConteo1) : intval($empleado)) . "
  ";
  $resC1 = mssql_query($sqlC1, $conn);
  if (!$resC1) {
    echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
    exit;
  }

  $c1Map = []; // ItemCode => cantidad
  while ($r = mssql_fetch_assoc($resC1)) {
    $c1Map[trim($r['ItemCode'])] = floatval($r['cant_invfis']);
  }

  // 3) Conteo 2 (puede NO existir)
  $sqlC2 = "
    SELECT ItemCode, cant_invfis
    FROM CAP_INVENTARIO
    WHERE almacen   = '$almacen'
      AND fecha_inv = '$fecha'
      AND cias      = '$cia'
      AND estatus   = 2
      AND usuario   = " . ($esBrigada ? intval($usuarioConteo2) : intval($empleado)) . "
  ";
  $resC2 = mssql_query($sqlC2, $conn);
  if (!$resC2) {
    echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
    exit;
  }

  $c2Map = []; // ItemCode => cantidad
  while ($r = mssql_fetch_assoc($resC2)) {
    $c2Map[trim($r['ItemCode'])] = floatval($r['cant_invfis']);
  }

  // 4) Diferencias reales: SAP vs (conteo1 / conteo2)
  $diffCodes = [];

  foreach ($sapMap as $code => $sap) {
    // Si falta cualquiera de los conteos -> diferencia
    if (!isset($c1Map[$code]) || !isset($c2Map[$code])) {
      $diffCodes[] = $code;
      continue;
    }

    // Si conteo 1 ≠ conteo 2 -> diferencia
    if (round($c1Map[$code] - $c2Map[$code], 2) != 0) {
      $diffCodes[] = $code;
    }
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

  $codesEsc = array_map(function($c) {
    return "'" . addslashes($c) . "'";
  }, array_unique($diffCodes));

  // 5) Filtro final por ItemCode
  $itemCodeIn = " AND c.ItemCode IN (" . implode(",", $codesEsc) . ") ";
}


$extraSelect = "";
$extraJoins  = "";
$extraJoinsC3 = "";
$extraSelectC3 = "";

if ($estatus === 3 || $estatus === 7) {

  if ($esBrigada && $usuarioConteo1 && $usuarioConteo2) {

    $extraSelect = ",
      ISNULL(c1.cant_invfis, 0) AS conteo_1,
      ISNULL(c2.cant_invfis, 0) AS conteo_2
    ";

    $extraJoins = "
      LEFT JOIN CAP_INVENTARIO c1
        ON c1.almacen   = c.almacen
       AND c1.fecha_inv = c.fecha_inv
       AND c1.cias      = c.cias
       AND c1.ItemCode  = c.ItemCode
       AND c1.estatus   = 1
       AND c1.usuario   = $usuarioConteo1

      LEFT JOIN CAP_INVENTARIO c2
        ON c2.almacen   = c.almacen
       AND c2.fecha_inv = c.fecha_inv
       AND c2.cias      = c.cias
       AND c2.ItemCode  = c.ItemCode
       AND c2.estatus   = 2
       AND c2.usuario   = $usuarioConteo2
    ";

  } else {

    $extraSelect = ",
      ISNULL(c1.cant_invfis, 0) AS conteo_1,
      ISNULL(c2.cant_invfis, 0) AS conteo_2
    ";

    $extraJoins = "
      LEFT JOIN CAP_INVENTARIO c1
        ON c1.almacen   = c.almacen
       AND c1.fecha_inv = c.fecha_inv
       AND c1.cias      = c.cias
       AND c1.ItemCode  = c.ItemCode
       AND c1.estatus   = 1
       AND c1.usuario   = $empleado

      LEFT JOIN CAP_INVENTARIO c2
        ON c2.almacen   = c.almacen
       AND c2.fecha_inv = c.fecha_inv
       AND c2.cias      = c.cias
       AND c2.ItemCode  = c.ItemCode
       AND c2.estatus   = 2
       AND c2.usuario   = $empleado
    ";
  }

  // SOLO EN CUARTO CONTEO: traer el conteo 3 (desde CAP_INVENTARIO_CONTEOS nro_conteo=3 ligado al inventario estatus=3)
  if ($estatus === 7) {
    $extraSelect .= ",
      ISNULL(ct3.cantidad, 0) AS conteo_3
    ";

    $extraJoins .= "
      LEFT JOIN CAP_INVENTARIO i3
        ON i3.almacen   = c.almacen
       AND i3.fecha_inv = c.fecha_inv
       AND i3.cias      = c.cias
       AND i3.ItemCode  = c.ItemCode
       AND i3.estatus   = 3
       AND i3.usuario   = $empleado

      LEFT JOIN CAP_INVENTARIO_CONTEOS ct3
        ON ct3.id_inventario = i3.id
       AND ct3.nro_conteo    = 3
    ";
  }
}
// ============================
// Consulta principal (con filtro opcional por ItemCode)
// ============================
$sql = "
  SELECT c.* $extraSelect
  FROM CAP_INVENTARIO c
  $extraJoins
  $extraJoinsC3
  WHERE c.almacen   = '$almacen'
    AND c.fecha_inv = '$fecha'
    AND c.cias      = '$cia'
    AND c.usuario   = $empleado
    AND c.estatus   = $estatus
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
