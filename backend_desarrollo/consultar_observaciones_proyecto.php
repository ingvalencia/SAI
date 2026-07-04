<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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
  header('Content-Type: application/json');
  echo json_encode($data);
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS_DESARROLLO";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  responder(array(
    "success" => false,
    "error" => "No se pudo conectar al servidor SQL"
  ));
}

if (!mssql_select_db($db, $conn)) {
  responder(array(
    "success" => false,
    "error" => "No se pudo seleccionar la base de datos"
  ));
}

if (isset($_GET['ver_evidencia']) && intval($_GET['ver_evidencia']) === 1) {
  $id_observacion = isset($_GET['id_observacion']) ? intval($_GET['id_observacion']) : 0;

  if ($id_observacion <= 0) {
    responder(array(
      "success" => false,
      "error" => "Falta id_observacion"
    ));
  }

  $sqlArchivo = "
    SELECT TOP 1
      evidencia_nombre,
      evidencia_binaria,
      evidencia_mime,
      evidencia_extension,
      evidencia_compresion
    FROM CAP_OBSERVACIONES_PROYECTO WITH (NOLOCK)
    WHERE id_observacion = $id_observacion
      AND activo = 1
      AND evidencia_binaria IS NOT NULL
      AND DATALENGTH(evidencia_binaria) > 0
  ";

  $resultArchivo = mssql_query($sqlArchivo, $conn);

  if (!$resultArchivo) {
    responder(array(
      "success" => false,
      "error" => "Error al consultar evidencia",
      "detalle" => mssql_get_last_message()
    ));
  }

  $archivo = mssql_fetch_assoc($resultArchivo);

  if (!$archivo) {
    responder(array(
      "success" => false,
      "error" => "No se encontró evidencia"
    ));
  }

  $nombre = isset($archivo["evidencia_nombre"]) && trim($archivo["evidencia_nombre"]) != ""
    ? $archivo["evidencia_nombre"]
    : "evidencia_" . $id_observacion;

  $mime = isset($archivo["evidencia_mime"]) && trim($archivo["evidencia_mime"]) != ""
    ? $archivo["evidencia_mime"]
    : "application/octet-stream";

  $compresion = isset($archivo["evidencia_compresion"]) ? strtoupper(trim($archivo["evidencia_compresion"])) : "";
  $binario = $archivo["evidencia_binaria"];

  if ($compresion === "GZIP") {
    $descomprimido = @gzuncompress($binario);
    if ($descomprimido !== false) {
      $binario = $descomprimido;
    }
  }

  if (ob_get_length()) {
    ob_clean();
  }

  header('Content-Type: ' . $mime);
  header('Content-Length: ' . strlen($binario));
  header('Content-Disposition: inline; filename="' . str_replace('"', '', $nombre) . '"');
  header('Cache-Control: private, max-age=86400');

  echo $binario;
  exit;
}

$cia      = isset($_GET['cia']) ? limpiar($_GET['cia']) : '';
$cef      = isset($_GET['cef']) ? limpiar($_GET['cef']) : '';
$tipo     = isset($_GET['tipo']) ? limpiar($_GET['tipo']) : '';
$estatus  = isset($_GET['estatus']) ? limpiar($_GET['estatus']) : '';
$fechaIni = isset($_GET['fecha_inicio']) ? limpiar($_GET['fecha_inicio']) : '';
$fechaFin = isset($_GET['fecha_fin']) ? limpiar($_GET['fecha_fin']) : '';

$where = " WHERE O.activo = 1 ";

if ($cia != '') {
  $where .= " AND O.cia = '$cia' ";
}

if ($cef != '') {
  $where .= " AND O.cef LIKE '%$cef%' ";
}

if ($tipo != '') {
  $where .= " AND O.tipo_observacion = '$tipo' ";
}

if ($estatus != '') {
  $where .= " AND O.estatus = '$estatus' ";
}

if ($fechaIni != '') {
  $where .= " AND CAST(O.fecha_observacion AS DATE) >= '$fechaIni' ";
}

if ($fechaFin != '') {
  $where .= " AND CAST(O.fecha_observacion AS DATE) <= '$fechaFin' ";
}

$sql = "
  SELECT
    O.id_observacion,
    O.cia,
    O.cef,
    CONVERT(VARCHAR(10), O.fecha_observacion, 120) AS fecha_observacion,
    O.responsable,
    O.tipo_observacion,
    O.descripcion,
    O.accion_sugerida,
    O.evidencia_nombre,
    O.evidencia_ruta,
    CASE
      WHEN O.evidencia_binaria IS NOT NULL AND DATALENGTH(O.evidencia_binaria) > 0 THEN 1
      ELSE 0
    END AS tiene_evidencia,
    O.evidencia_mime,
    O.evidencia_extension,
    O.evidencia_peso_original,
    O.evidencia_peso_final,
    O.evidencia_compresion,
    O.estatus,
    O.usuario_creacion,
    CONVERT(VARCHAR(19), O.fecha_creacion, 120) AS fecha_creacion
  FROM CAP_OBSERVACIONES_PROYECTO O WITH (NOLOCK)
  $where
  ORDER BY O.fecha_creacion DESC
";

$result = mssql_query($sql, $conn);

if (!$result) {
  responder(array(
    "success" => false,
    "error" => "Error al consultar observaciones",
    "detalle" => mssql_get_last_message()
  ));
}

$data = array();

$protocolo = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : "diniz.com.mx";
$script = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : "/diniz/servicios/services/admin_inventarios_sap/consultar_observaciones_proyecto.php";
$baseUrl = $protocolo . $host . $script;

while ($row = mssql_fetch_assoc($result)) {
  $ruta = isset($row["evidencia_ruta"]) ? $row["evidencia_ruta"] : "";
  $tiene_evidencia = isset($row["tiene_evidencia"]) ? intval($row["tiene_evidencia"]) : 0;
  $id = intval($row["id_observacion"]);
  $url = "";

  if ($tiene_evidencia == 1) {
    $url = $baseUrl . "?ver_evidencia=1&id_observacion=" . $id;
  }

  $data[] = array(
    "id_observacion" => $id,
    "cia" => utf8_encode($row["cia"]),
    "cef" => utf8_encode($row["cef"]),
    "fecha_observacion" => $row["fecha_observacion"],
    "responsable" => utf8_encode($row["responsable"]),
    "tipo_observacion" => utf8_encode($row["tipo_observacion"]),
    "descripcion" => utf8_encode($row["descripcion"]),
    "accion_sugerida" => utf8_encode($row["accion_sugerida"]),
    "evidencia_nombre" => utf8_encode($row["evidencia_nombre"]),
    "evidencia_ruta" => $ruta,
    "evidencia_url" => $url,
    "tiene_evidencia" => $tiene_evidencia,
    "evidencia_mime" => isset($row["evidencia_mime"]) ? $row["evidencia_mime"] : "",
    "evidencia_extension" => isset($row["evidencia_extension"]) ? $row["evidencia_extension"] : "",
    "evidencia_peso_original" => isset($row["evidencia_peso_original"]) ? intval($row["evidencia_peso_original"]) : 0,
    "evidencia_peso_final" => isset($row["evidencia_peso_final"]) ? intval($row["evidencia_peso_final"]) : 0,
    "evidencia_compresion" => isset($row["evidencia_compresion"]) ? $row["evidencia_compresion"] : "",
    "estatus" => utf8_encode($row["estatus"]),
    "usuario_creacion" => utf8_encode($row["usuario_creacion"]),
    "fecha_creacion" => $row["fecha_creacion"]
  );
}

responder(array(
  "success" => true,
  "total" => count($data),
  "data" => $data
));
?>
