<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$cia     = isset($_GET['cia'])     ? trim($_GET['cia'])     : null;
$almacen = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;
$fecha   = isset($_GET['fecha'])   ? trim($_GET['fecha'])   : null;

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

/* ================================
   OBTENER ID_CIERRE
================================ */
$qCierre = mssql_query("
    SELECT id_cierre
    FROM CAP_INVENTARIO_CIERRE
    WHERE cia = '$cia'
      AND fecha_inventario = '$fecha'
      AND almacen = '$almacen'
", $conn);

if (!$qCierre || mssql_num_rows($qCierre) == 0) {
  echo json_encode(["success" => false, "error" => "No existe cierre generado"]);
  exit;
}

$rowCierre = mssql_fetch_assoc($qCierre);
$id_cierre = intval($rowCierre["id_cierre"]);

/* ================================
   FALTANTES (OIGN)
================================ */
$qEntrada = mssql_query("
    SELECT T0.DocNum, SUM(T1.LineTotal) AS total_importe
    FROM {$cia}_X.dbo.OIGN T0
    INNER JOIN {$cia}_X.dbo.IGN1 T1 ON T0.DocEntry = T1.DocEntry
    WHERE T0.DocEntry IN (
        SELECT DocEntry_sap
        FROM CAP_INVENTARIO_AJUSTES_SAP
        WHERE tipo_documento_sap = 'OIGN'
          AND id_cierre = $id_cierre
    )
    GROUP BY T0.DocNum
", $conn);

$faltante_total = 0;
$faltante_docs = [];

if ($qEntrada) {
  while ($r = mssql_fetch_assoc($qEntrada)) {
    $faltante_total += floatval($r["total_importe"]);
    $faltante_docs[] = $r["DocNum"];
  }
}

$doc_faltante = count($faltante_docs) > 0 ? implode(", ", $faltante_docs) : "-";

/* ================================
   SOBRANTES (OIGE)
================================ */
$qSalida = mssql_query("
    SELECT T0.DocNum, SUM(T1.LineTotal) AS total_importe
    FROM {$cia}_X.dbo.OIGE T0
    INNER JOIN {$cia}_X.dbo.IGE1 T1 ON T0.DocEntry = T1.DocEntry
    WHERE T0.DocEntry IN (
        SELECT DocEntry_sap
        FROM CAP_INVENTARIO_AJUSTES_SAP
        WHERE tipo_documento_sap = 'OIGE'
          AND id_cierre = $id_cierre
    )
    GROUP BY T0.DocNum
", $conn);

$sobrante_total = 0;
$sobrante_docs = [];

if ($qSalida) {
  while ($r = mssql_fetch_assoc($qSalida)) {
    $sobrante_total += floatval($r["total_importe"]);
    $sobrante_docs[] = $r["DocNum"];
  }
}

$doc_sobrante = count($sobrante_docs) > 0 ? implode(", ", $sobrante_docs) : "-";

$total = $faltante_total + $sobrante_total;

/* ================================
   RESPUESTA FINAL
================================ */
$data = [
  [
    "almacen"       => $almacen,
    "FALTANTE"      => round($faltante_total, 2),
    "DOC_FALTANTE"  => $doc_faltante,
    "SOBRANTE"      => round($sobrante_total, 2),
    "DOC_SOBRANTE"  => $doc_sobrante,
    "TOTAL"         => round($total, 2)
  ],
  [
    "almacen"       => "TOTAL GENERAL",
    "FALTANTE"      => round($faltante_total, 2),
    "DOC_FALTANTE"  => "-",
    "SOBRANTE"      => round($sobrante_total, 2),
    "DOC_SOBRANTE"  => "-",
    "TOTAL"         => round($total, 2)
  ]
];

echo json_encode([
  "success" => true,
  "id_cierre" => $id_cierre,
  "data" => $data
]);

exit;
