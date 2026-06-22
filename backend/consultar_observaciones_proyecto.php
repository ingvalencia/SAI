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

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

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
    "error" => "Error al consultar observaciones"
  ));
}

$data = array();

while ($row = mssql_fetch_assoc($result)) {
  $ruta = isset($row["evidencia_ruta"]) ? $row["evidencia_ruta"] : "";
  $url = "";

  if ($ruta != "") {
    $url = "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/" . $ruta;
  }

  $data[] = array(
    "id_observacion" => intval($row["id_observacion"]),
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
