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

$cia                = isset($_POST['cia']) ? limpiar($_POST['cia']) : '';
$cef                = isset($_POST['cef']) ? limpiar($_POST['cef']) : '';
$fecha_observacion  = isset($_POST['fecha_observacion']) ? limpiar($_POST['fecha_observacion']) : '';
$responsable        = isset($_POST['responsable']) ? limpiar($_POST['responsable']) : '';
$tipo_observacion   = isset($_POST['tipo_observacion']) ? limpiar($_POST['tipo_observacion']) : '';
$descripcion        = isset($_POST['descripcion']) ? limpiar($_POST['descripcion']) : '';
$accion_sugerida    = isset($_POST['accion_sugerida']) ? limpiar($_POST['accion_sugerida']) : '';
$usuario_creacion   = isset($_POST['usuario_creacion']) ? limpiar($_POST['usuario_creacion']) : '';

if ($cef == '' || $fecha_observacion == '' || $responsable == '' || $tipo_observacion == '' || $descripcion == '') {
  responder(array(
    "success" => false,
    "error" => "Faltan datos obligatorios"
  ));
}

$evidencia_nombre = '';
$evidencia_ruta = '';

if (isset($_FILES['evidencia']) && $_FILES['evidencia']['error'] === UPLOAD_ERR_OK) {
  $uploadDir = __DIR__ . "/evidencias_observaciones/";

  if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
  }

  $nombreOriginal = $_FILES['evidencia']['name'];
  $tmpName = $_FILES['evidencia']['tmp_name'];
  $extension = strtolower(pathinfo($nombreOriginal, PATHINFO_EXTENSION));

  $pesoArchivo = isset($_FILES['evidencia']['size']) ? intval($_FILES['evidencia']['size']) : 0;
  $pesoMaximo = 1024 * 1024;

  if ($pesoArchivo > $pesoMaximo) {
    responder(array(
      "success" => false,
      "error" => "La evidencia supera el peso máximo permitido de 1 MB"
    ));
  }

  $permitidas = array('jpg', 'jpeg', 'png', 'gif', 'pdf', 'xlsx', 'xls', 'doc', 'docx');

  if (!in_array($extension, $permitidas)) {
    responder(array(
      "success" => false,
      "error" => "Tipo de archivo no permitido"
    ));
  }

  $nombreSeguro = "OBS_" . date("Ymd_His") . "_" . rand(1000, 9999) . "." . $extension;
  $rutaFisica = $uploadDir . $nombreSeguro;

  if (!move_uploaded_file($tmpName, $rutaFisica)) {
    responder(array(
      "success" => false,
      "error" => "No se pudo guardar la evidencia"
    ));
  }

  $evidencia_nombre = limpiar($nombreOriginal);
  $evidencia_ruta = "evidencias_observaciones/" . $nombreSeguro;
}

$sqlInsert = "
  INSERT INTO CAP_OBSERVACIONES_PROYECTO (
    cia,
    cef,
    fecha_observacion,
    responsable,
    tipo_observacion,
    descripcion,
    accion_sugerida,
    evidencia_nombre,
    evidencia_ruta,
    estatus,
    activo,
    usuario_creacion,
    fecha_creacion
  )
  VALUES (
    '$cia',
    '$cef',
    '$fecha_observacion',
    '$responsable',
    '$tipo_observacion',
    '$descripcion',
    '$accion_sugerida',
    '$evidencia_nombre',
    '$evidencia_ruta',
    'ABIERTA',
    1,
    '$usuario_creacion',
    GETDATE()
  );

  SELECT SCOPE_IDENTITY() AS id_observacion;
";

$result = mssql_query($sqlInsert, $conn);

if (!$result) {
  responder(array(
    "success" => false,
    "error" => "Error al guardar la observación"
  ));
}

$row = mssql_fetch_assoc($result);
$id_observacion = isset($row['id_observacion']) ? intval($row['id_observacion']) : 0;

if ($id_observacion > 0 && $evidencia_ruta != '') {
  $extension = strtolower(pathinfo($evidencia_nombre, PATHINFO_EXTENSION));
  $peso_bytes = isset($_FILES['evidencia']['size']) ? intval($_FILES['evidencia']['size']) : 0;

  $sqlEvidencia = "
    INSERT INTO CAP_OBSERVACIONES_EVIDENCIAS (
      id_observacion,
      nombre_archivo,
      ruta_archivo,
      extension,
      peso_bytes,
      activo,
      fecha_creacion
    )
    VALUES (
      $id_observacion,
      '$evidencia_nombre',
      '$evidencia_ruta',
      '$extension',
      $peso_bytes,
      1,
      GETDATE()
    )
  ";

  mssql_query($sqlEvidencia, $conn);
}

responder(array(
  "success" => true,
  "mensaje" => "Observación guardada correctamente",
  "id_observacion" => $id_observacion,
  "evidencia" => $evidencia_ruta
));
?>
