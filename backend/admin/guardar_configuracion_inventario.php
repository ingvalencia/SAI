<?php
$origenPermitido = 'http://localhost:3000';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}


$cia             = isset($_POST['cia']) ? trim($_POST['cia']) : null;
$fecha_gestion   = isset($_POST['fecha_gestion']) ? trim($_POST['fecha_gestion']) : null;
$actualizado_por = isset($_POST['actualizado_por']) ? trim($_POST['actualizado_por']) : null;
$nivel_conteo    = isset($_POST['nivel_conteo']) ? trim($_POST['nivel_conteo']) : null;

$almacenes = [];
if (isset($_POST['almacenes'])) {
  if (is_array($_POST['almacenes'])) {
    foreach ($_POST['almacenes'] as $a) {
      $almacenes[] = trim($a);
    }
  } else {
    $almacenes[] = trim($_POST['almacenes']);
  }
}

if ($cia === null || $fecha_gestion === null || $actualizado_por === null || $nivel_conteo === null || count($almacenes) === 0) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros obligatorios']);
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


$sqlInsert = "
  INSERT INTO configuracion_inventario (cia, fecha_gestion, actualizado_por, actualizado_en)
  VALUES ('$cia', '$fecha_gestion', $actualizado_por, GETDATE())
";
$insertado = mssql_query($sqlInsert, $conn);
if (!$insertado) {
  echo json_encode(['success' => false, 'error' => 'Error al insertar configuración: ' . mssql_get_last_message()]);
  exit;
}


$resId = mssql_query("SELECT @@IDENTITY AS id", $conn);
$rowId = mssql_fetch_assoc($resId);
$configId = $rowId['id'];


foreach ($almacenes as $alm) {
  $almacen = trim($alm);
  if ($almacen !== "") {
    $sqlAlmacen = "
      INSERT INTO configuracion_inventario_almacenes (configuracion_id, almacen, conteo)
      VALUES ($configId, '$almacen', '$nivel_conteo')
    ";
    $resAlm = mssql_query($sqlAlmacen, $conn);
    if (!$resAlm) {
      echo json_encode(['success' => false, 'error' => 'Error al insertar almacén: ' . mssql_get_last_message()]);
      exit;
    }
  }
}


echo json_encode([
  'success' => true,
  'mensaje' => 'Configuración guardada correctamente',
  'configuracion_id' => $configId
]);
exit;
?>
