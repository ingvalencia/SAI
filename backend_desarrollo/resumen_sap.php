<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

function limpiar($valor)
{
  return str_replace("'", "''", trim((string)$valor));
}

function responder($data)
{
  echo json_encode($data);
  exit;
}

$cia = isset($_GET['cia']) ? limpiar($_GET['cia']) : null;
$almacen = isset($_GET['almacen']) ? limpiar($_GET['almacen']) : null;
$fecha = isset($_GET['fecha']) ? limpiar($_GET['fecha']) : null;
$idCierreParam = isset($_GET['id_cierre']) ? limpiar($_GET['id_cierre']) : null;

if (!$cia) {
  responder(["success" => false, "error" => "Falta parámetro cia"]);
}

if (!preg_match('/^[A-Za-z0-9_]+$/', $cia)) {
  responder(["success" => false, "error" => "CIA inválida"]);
}

$ciaSap = $cia;

if (strtolower($cia) == "recrefam") {
  $ciaSap = "Pruebas_RECREFAM";
}

if (!preg_match('/^[A-Za-z0-9_]+$/', $ciaSap)) {
  responder(["success" => false, "error" => "Base SAP inválida"]);
}

$server = "192.168.0.174";
$user = "sa";
$pass = "P@ssw0rd";
$db = "SAP_PROCESOS_DESARROLLO";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  responder(["success" => false, "error" => "No se pudo conectar"]);
}

mssql_select_db($db, $conn);

$idCierres = [];
$almacenesEncontrados = [];
$almacenesConFalloSap = [];
$cierresPorAlmacen = [];

if ($idCierreParam) {
  $idsRaw = array_filter(array_map('trim', explode(',', $idCierreParam)));
  $ids = [];

  foreach ($idsRaw as $idRaw) {
    $id = intval($idRaw);
    if ($id > 0) {
      $ids[] = $id;
    }
  }

  if (count($ids) === 0) {
    responder(["success" => false, "error" => "id_cierre inválido"]);
  }

  $idsSql = implode(",", $ids);

  $qCierre = mssql_query("
    SELECT id_cierre, almacen, ISNULL(procesado_sap, 0) AS procesado_sap
    FROM CAP_INVENTARIO_CIERRE
    WHERE cia = '$cia'
      AND id_cierre IN ($idsSql)
  ", $conn);
} else {
  if (!$almacen || !$fecha) {
    responder(["success" => false, "error" => "Faltan parámetros"]);
  }

  $almacenesArray = array_filter(array_map('trim', explode(',', $almacen)));

  if (count($almacenesArray) === 0) {
    responder(["success" => false, "error" => "No hay almacenes válidos"]);
  }

  $almacenesEscapados = [];

  foreach ($almacenesArray as $alm) {
    $almacenesEscapados[] = "'" . limpiar($alm) . "'";
  }

  $almacenesSql = implode(",", $almacenesEscapados);

  $qUltimoLote = mssql_query("
    SELECT CONVERT(VARCHAR(23), MAX(fecha_cierre), 121) AS fecha_lote
    FROM CAP_INVENTARIO_CIERRE
    WHERE cia = '$cia'
      AND almacen IN ($almacenesSql)
      AND CAST(fecha_inventario AS DATE) = '$fecha'
      AND estatus_cierre = 5
  ", $conn);

  if (!$qUltimoLote) {
    responder([
      "success" => false,
      "error" => "Error consultando último lote de cierre: " . mssql_get_last_message()
    ]);
  }

  $rowUltimoLote = mssql_fetch_assoc($qUltimoLote);
  $fechaLote = isset($rowUltimoLote["fecha_lote"]) ? trim((string)$rowUltimoLote["fecha_lote"]) : "";

  if ($fechaLote === "") {
    responder(["success" => false, "error" => "No existe cierre generado"]);
  }

  $qCierre = mssql_query("
    SELECT id_cierre, almacen, ISNULL(procesado_sap, 0) AS procesado_sap
    FROM CAP_INVENTARIO_CIERRE
    WHERE cia = '$cia'
      AND almacen IN ($almacenesSql)
      AND CAST(fecha_inventario AS DATE) = '$fecha'
      AND estatus_cierre = 5
      AND fecha_cierre >= DATEADD(MINUTE, -5, '$fechaLote')
      AND fecha_cierre <= DATEADD(MINUTE, 5, '$fechaLote')
  ", $conn);
}

if (!$qCierre) {
  responder([
    "success" => false,
    "error" => "Error consultando cierre: " . mssql_get_last_message()
  ]);
}

if (mssql_num_rows($qCierre) == 0) {
  responder(["success" => false, "error" => "No existe cierre generado"]);
}

while ($row = mssql_fetch_assoc($qCierre)) {
  $idCierre = intval($row["id_cierre"]);
  $almacenCierre = $row["almacen"];

  if ($idCierre <= 0) {
    continue;
  }

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

$idCierres = array_values(array_unique($idCierres));

if (count($idCierres) === 0) {
  responder(["success" => false, "error" => "No se encontraron cierres válidos"]);
}

$idCierresSql = implode(",", $idCierres);

$qSignal = mssql_query("
  SELECT
    COUNT(DISTINCT id_cierre) AS total_signals,
    COUNT(DISTINCT CASE WHEN ISNULL(procesado, 0) = 1 THEN id_cierre END) AS total_procesados,
    COUNT(DISTINCT CASE WHEN ISNULL(procesado, 0) = 0 THEN id_cierre END) AS total_pendientes
  FROM CAP_SAP_SIGNAL
  WHERE id_cierre IN ($idCierresSql)
", $conn);

if (!$qSignal) {
  responder([
    "success" => false,
    "error" => "Error validando procesamiento SAP: " . mssql_get_last_message()
  ]);
}

$rowSignal = mssql_fetch_assoc($qSignal);

$totalSignals = isset($rowSignal["total_signals"]) ? intval($rowSignal["total_signals"]) : 0;
$totalProcesados = isset($rowSignal["total_procesados"]) ? intval($rowSignal["total_procesados"]) : 0;
$totalPendientes = isset($rowSignal["total_pendientes"]) ? intval($rowSignal["total_pendientes"]) : 0;

if ($totalSignals === 0) {
  responder([
    "success" => false,
    "error" => "Aún no se ha procesado a SAP, favor de contactar al administrador."
  ]);
}

if ($totalPendientes > 0 || $totalProcesados < count($idCierres)) {
  responder([
    "success" => false,
    "error" => "Aún no se ha procesado a SAP, favor de contactar al administrador."
  ]);
}

if (count($almacenesConFalloSap) > 0) {
  responder([
    "success" => false,
    "error" => "El servicio ya procesó el cierre, pero SAP arrojó un fallo en uno o más almacenes. Favor de consultar con el administrador.",
    "almacenes_con_fallo_sap" => $almacenesConFalloSap
  ]);
}

$data = [];
$total_faltante_general = 0;
$total_sobrante_general = 0;

foreach ($cierresPorAlmacen as $cierre) {
  $idCierreActual = intval($cierre["id_cierre"]);
  $almacenActual = str_replace("'", "''", $cierre["almacen"]);

  $faltante_total = 0;
  $sobrante_total = 0;
  $faltante_docs = [];
  $sobrante_docs = [];

  $qAjustes = mssql_query("
    SELECT
      ISNULL(SUM(
        CASE
          WHEN A.tipo_ajuste = 'F'
          THEN ABS(A.cantidad_ajuste) * ISNULL(P.precio, 0)
          ELSE 0
        END
      ), 0) AS total_faltante,

      ISNULL(SUM(
        CASE
          WHEN A.tipo_ajuste = 'S'
          THEN ABS(A.cantidad_ajuste) * ISNULL(P.precio, 0)
          ELSE 0
        END
      ), 0) AS total_sobrante
    FROM CAP_INVENTARIO_AJUSTES_SAP A
    OUTER APPLY (
  SELECT TOP 1
    ISNULL(T1.Price, 0) AS precio
  FROM {$ciaSap}.dbo.ITM1 T1
  WHERE T1.ItemCode COLLATE SQL_Latin1_General_CP850_CI_AS =
        A.ItemCode COLLATE SQL_Latin1_General_CP850_CI_AS
    AND T1.PriceList = 1
) P
    WHERE A.id_cierre = $idCierreActual
      AND ISNULL(A.estado_proceso, 0) = 2
  ", $conn);

  if (!$qAjustes) {
    responder([
      "success" => false,
      "error" => "Error consultando ajustes del cierre $idCierreActual: " . mssql_get_last_message()
    ]);
  }

  if ($rAjustes = mssql_fetch_assoc($qAjustes)) {
    $faltante_total = isset($rAjustes["total_faltante"]) ? floatval($rAjustes["total_faltante"]) : 0;
    $sobrante_total = isset($rAjustes["total_sobrante"]) ? floatval($rAjustes["total_sobrante"]) : 0;
  }

  $qDocEntrada = mssql_query("
    SELECT DISTINCT T0.DocNum
    FROM {$ciaSap}.dbo.OIGN T0
    INNER JOIN CAP_INVENTARIO_AJUSTES_SAP A
      ON A.DocEntry_sap = T0.DocEntry
    WHERE A.id_cierre = $idCierreActual
      AND A.tipo_documento_sap = 'OIGN'
      AND A.tipo_ajuste = 'S'
      AND ISNULL(A.estado_proceso, 0) = 2
  ", $conn);

  if ($qDocEntrada) {
    while ($r = mssql_fetch_assoc($qDocEntrada)) {
      if (isset($r["DocNum"]) && trim((string)$r["DocNum"]) !== "") {
        $sobrante_docs[] = $r["DocNum"];
      }
    }
  }

  $qDocSalida = mssql_query("
    SELECT DISTINCT T0.DocNum
    FROM {$ciaSap}.dbo.OIGE T0
    INNER JOIN CAP_INVENTARIO_AJUSTES_SAP A
      ON A.DocEntry_sap = T0.DocEntry
    WHERE A.id_cierre = $idCierreActual
      AND A.tipo_documento_sap = 'OIGE'
      AND A.tipo_ajuste = 'F'
      AND ISNULL(A.estado_proceso, 0) = 2
  ", $conn);

  if ($qDocSalida) {
    while ($r = mssql_fetch_assoc($qDocSalida)) {
      if (isset($r["DocNum"]) && trim((string)$r["DocNum"]) !== "") {
        $faltante_docs[] = $r["DocNum"];
      }
    }
  }

  $doc_sobrante = $sobrante_total > 0 && count($sobrante_docs) > 0 ? implode(", ", array_unique($sobrante_docs)) : "-";
  $doc_faltante = $faltante_total > 0 && count($faltante_docs) > 0 ? implode(", ", array_unique($faltante_docs)) : "-";

  $total = $faltante_total + $sobrante_total;

  $total_faltante_general += $faltante_total;
  $total_sobrante_general += $sobrante_total;

  $data[] = [
    "almacen" => $almacenActual,
    "FALTANTE" => round($faltante_total, 2),
    "DOC_FALTANTE" => $doc_faltante,
    "SOBRANTE" => round($sobrante_total, 2),
    "DOC_SOBRANTE" => $doc_sobrante,
    "TOTAL" => round($total, 2)
  ];
}

$data[] = [
  "almacen" => "TOTAL GENERAL",
  "FALTANTE" => round($total_faltante_general, 2),
  "DOC_FALTANTE" => "-",
  "SOBRANTE" => round($total_sobrante_general, 2),
  "DOC_SOBRANTE" => "-",
  "TOTAL" => round($total_faltante_general + $total_sobrante_general, 2)
];

responder([
  "success" => true,
  "db_control" => $db,
  "db_sap" => $ciaSap,
  "id_cierres" => $idCierres,
  "almacenes_encontrados" => $almacenesEncontrados,
  "sap_signal" => [
    "total_signals" => $totalSignals,
    "total_procesados" => $totalProcesados,
    "total_pendientes" => $totalPendientes
  ],
  "data" => $data
]);
