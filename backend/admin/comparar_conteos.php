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


$raw = file_get_contents("php://input");
$data = json_decode($raw, true);
if (!$data) $data = $_POST;

$cia     = isset($data['cia'])     ? trim($data['cia'])     : null;
$almacen = isset($data['almacen']) ? trim($data['almacen']) : null;
$fecha   = isset($data['fecha'])   ? trim($data['fecha'])   : null;

if (!$cia || !$almacen || !$fecha) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos (cia, almacen, fecha)']);
  exit;
}


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


$cia_safe     = addslashes($cia);
$almacen_safe = addslashes($almacen);
$fecha_safe   = addslashes($fecha);


$sql = "
  EXEC dbo.USP_COMPARAR_CONTEOS
      @cia     = '$cia_safe',
      @almacen = '$almacen_safe',
      @fecha   = '$fecha_safe';
";

$res = mssql_query($sql, $conn);
if (!$res) {
  error_log('Error SQL SP COMPARAR_CONTEOS: ' . mssql_get_last_message());
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}


$datos = [];
while ($row = mssql_fetch_assoc($res)) {
  $datos[] = [
    'ItemCode'    => $row['codigo'],
    'ItemName'    => $row['nombre'],
    'CodeBars'    => $row['codebars'],
    'Conteo1'     => floatval($row['conteo1']),
    'Conteo2'     => floatval($row['conteo2']),
    'Diferencia'  => floatval($row['diferencia'])
  ];
}

echo json_encode([
  'success' => true,
  'mensaje' => 'Comparación realizada correctamente',
  'total'   => count($datos),
  'data'    => $datos
]);
exit;
?>
