<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

function limpiar($valor) {
  return str_replace("'", "''", trim((string)$valor));
}

$cia     = isset($_GET['cia'])     ? limpiar($_GET['cia'])     : null;
$almacen = isset($_GET['almacen']) ? limpiar($_GET['almacen']) : null;
$fecha   = isset($_GET['fecha'])   ? limpiar($_GET['fecha'])   : null;

if (!$cia || !$almacen || !$fecha) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  echo json_encode(["success" => false, "error" => "No se pudo conectar"]);
  exit;
}

mssql_select_db($db, $conn);

$almacenesArray = array_filter(array_map('trim', explode(',', $almacen)));

if (count($almacenesArray) === 0) {
  echo json_encode(["success" => false, "error" => "No hay almacenes válidos"]);
  exit;
}

$almacenesEscapados = [];

foreach ($almacenesArray as $alm) {
  $almacenesEscapados[] = "'" . limpiar($alm) . "'";
}

$almacenesSql = implode(",", $almacenesEscapados);

$qCierre = mssql_query("
    SELECT id_cierre, almacen, ISNULL(procesado_sap, 0) AS procesado_sap
    FROM CAP_INVENTARIO_CIERRE
    WHERE cia = '$cia'
      AND almacen IN ($almacenesSql)
      AND CAST(fecha_inventario AS DATE) = '$fecha'
", $conn);

if (!$qCierre) {
  echo json_encode([
    "success" => false,
    "error" => "Error consultando cierre: " . mssql_get_last_message()
  ]);
  exit;
}

if (mssql_num_rows($qCierre) == 0) {
  echo json_encode(["success" => false, "error" => "No existe cierre generado"]);
  exit;
}

$idCierres = [];
$almacenesEncontrados = [];
$almacenesConFalloSap = [];
$cierresPorAlmacen = [];

while ($row = mssql_fetch_assoc($qCierre)) {
  $idCierre = intval($row["id_cierre"]);
  $almacenCierre = $row["almacen"];

  $idCierres[] = $idCierre;
  $almacenesEncontrados[] = $almacenCierre;

  $cierresPorAlmacen[] = [
    "id_cierre" => $idCierre,
    "almacen" => $almacenCierre
  ];

  if (intval($row["procesado_sap"]) !== 1) {
    $almacenesConFalloSap[] = $almacenCierre;
  }
}

if (count($idCierres) === 0) {
  echo json_encode(["success" => false, "error" => "No se encontraron cierres válidos"]);
  exit;
}

$idCierresSql = implode(",", $idCierres);

$qSignal = mssql_query("
  SELECT
    COUNT(*) AS total_signals,
    SUM(CASE WHEN ISNULL(procesado, 0) = 1 THEN 1 ELSE 0 END) AS total_procesados,
    SUM(CASE WHEN ISNULL(procesado, 0) = 0 THEN 1 ELSE 0 END) AS total_pendientes
  FROM CAP_SAP_SIGNAL
  WHERE id_cierre IN ($idCierresSql)
", $conn);

if (!$qSignal) {
  echo json_encode([
    "success" => false,
    "error" => "Error validando procesamiento SAP: " . mssql_get_last_message()
  ]);
  exit;
}

$rowSignal = mssql_fetch_assoc($qSignal);

$totalSignals = isset($rowSignal["total_signals"]) ? intval($rowSignal["total_signals"]) : 0;
$totalProcesados = isset($rowSignal["total_procesados"]) ? intval($rowSignal["total_procesados"]) : 0;
$totalPendientes = isset($rowSignal["total_pendientes"]) ? intval($rowSignal["total_pendientes"]) : 0;

if ($totalSignals === 0) {
  echo json_encode([
    "success" => false,
    "error" => "Aún no se ha procesado a SAP, favor de contactar al administrador."
  ]);
  exit;
}

if ($totalPendientes > 0 || $totalProcesados < count($idCierres)) {
  echo json_encode([
    "success" => false,
    "error" => "Aún no se ha procesado a SAP, favor de contactar al administrador."
  ]);
  exit;
}

if (count($almacenesConFalloSap) > 0) {
  echo json_encode([
    "success" => false,
    "error" => "El servicio ya procesó el cierre, pero SAP arrojó un fallo en uno o más almacenes. Favor de consultar con el administrador.",
    "almacenes_con_fallo_sap" => $almacenesConFalloSap
  ]);
  exit;
}

$data = [];

$total_faltante_general = 0;
$total_sobrante_general = 0;

foreach ($cierresPorAlmacen as $cierre) {
  $idCierreActual = intval($cierre["id_cierre"]);
  $almacenActual = str_replace("'", "''", $cierre["almacen"]);

  $faltante_total = 0;
  $faltante_docs = [];

  $qEntrada = mssql_query("
    SELECT T0.DocNum, SUM(T1.LineTotal) AS total_importe
    FROM {$cia}_X.dbo.OIGN T0
    INNER JOIN {$cia}_X.dbo.IGN1 T1 ON T0.DocEntry = T1.DocEntry
    WHERE T0.DocEntry IN (
      SELECT DocEntry_sap
      FROM CAP_INVENTARIO_AJUSTES_SAP
      WHERE tipo_documento_sap = 'OIGN'
        AND id_cierre = $idCierreActual
    )
    GROUP BY T0.DocNum
  ", $conn);

  if ($qEntrada) {
    while ($r = mssql_fetch_assoc($qEntrada)) {
      $faltante_total += floatval($r["total_importe"]);
      $faltante_docs[] = $r["DocNum"];
    }
  }

  $doc_faltante = count($faltante_docs) > 0 ? implode(", ", $faltante_docs) : "-";

  $sobrante_total = 0;
  $sobrante_docs = [];

  $qSalida = mssql_query("
    SELECT T0.DocNum, SUM(T1.LineTotal) AS total_importe
    FROM {$cia}_X.dbo.OIGE T0
    INNER JOIN {$cia}_X.dbo.IGE1 T1 ON T0.DocEntry = T1.DocEntry
    WHERE T0.DocEntry IN (
      SELECT DocEntry_sap
      FROM CAP_INVENTARIO_AJUSTES_SAP
      WHERE tipo_documento_sap = 'OIGE'
        AND id_cierre = $idCierreActual
    )
    GROUP BY T0.DocNum
  ", $conn);

  if ($qSalida) {
    while ($r = mssql_fetch_assoc($qSalida)) {
      $sobrante_total += floatval($r["total_importe"]);
      $sobrante_docs[] = $r["DocNum"];
    }
  }

  $doc_sobrante = count($sobrante_docs) > 0 ? implode(", ", $sobrante_docs) : "-";

  $total = $faltante_total + $sobrante_total;

  $total_faltante_general += $faltante_total;
  $total_sobrante_general += $sobrante_total;

  $data[] = [
    "almacen"       => $almacenActual,
    "FALTANTE"      => round($faltante_total, 2),
    "DOC_FALTANTE"  => $doc_faltante,
    "SOBRANTE"      => round($sobrante_total, 2),
    "DOC_SOBRANTE"  => $doc_sobrante,
    "TOTAL"         => round($total, 2)
  ];
}

$data[] = [
  "almacen"       => "TOTAL GENERAL",
  "FALTANTE"      => round($total_faltante_general, 2),
  "DOC_FALTANTE"  => "-",
  "SOBRANTE"      => round($total_sobrante_general, 2),
  "DOC_SOBRANTE"  => "-",
  "TOTAL"         => round($total_faltante_general + $total_sobrante_general, 2)
];
echo json_encode([
  "success" => true,
  "id_cierres" => $idCierres,
  "almacenes_encontrados" => $almacenesEncontrados,
  "sap_signal" => [
    "total_signals" => $totalSignals,
    "total_procesados" => $totalProcesados,
    "total_pendientes" => $totalPendientes
  ],
  "data" => $data
]);

exit;
?>
