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

$id_config = isset($data['id_config']) ? intval($data['id_config']) : null;
$usuario   = isset($data['usuario'])   ? trim($data['usuario'])     : null;

if (!$id_config || !$usuario) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
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


$usuario_safe = addslashes($usuario);


$sql = "
  EXEC dbo.USP_FINALIZAR_CONTEO_USUARIO
      @id_config = $id_config,
      @usuario   = '$usuario_safe';
";

$res = mssql_query($sql, $conn);

if (!$res) {
  error_log('Error SQL SP FINALIZAR_CONTEO_USUARIO: ' . mssql_get_last_message());
  echo json_encode(['success' => false, 'error' => mssql_get_last_message()]);
  exit;
}


echo json_encode([
  'success' => true,
  'mensaje' => 'Conteo finalizado correctamente. Si aplica, el sistema avanzará al siguiente estatus.'
]);
exit;
?>
