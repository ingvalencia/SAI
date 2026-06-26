<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
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

$sql = "
  SELECT
    id_tipo,
    nombre
  FROM CAP_OBSERVACIONES_TIPOS WITH (NOLOCK)
  WHERE activo = 1
  ORDER BY nombre ASC
";

$result = mssql_query($sql, $conn);

if (!$result) {
  responder(array(
    "success" => false,
    "error" => "Error al consultar tipos de observación"
  ));
}

$data = array();

while ($row = mssql_fetch_assoc($result)) {
  $data[] = array(
    "id_tipo" => intval($row["id_tipo"]),
    "nombre" => utf8_encode($row["nombre"])
  );
}

responder(array(
  "success" => true,
  "data" => $data
));
?>
