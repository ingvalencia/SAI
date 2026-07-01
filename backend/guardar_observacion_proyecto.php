<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

function limpiar($valor)
{
  if ($valor === null) {
    return '';
  }

  $valor = trim((string)$valor);

  if ($valor === '') {
    return '';
  }

  if (function_exists('get_magic_quotes_gpc') && get_magic_quotes_gpc()) {
    $valor = stripslashes($valor);
  }

  $valor = str_replace("\xEF\xBB\xBF", '', $valor);
  $valor = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', ' ', $valor);

  if (!preg_match('//u', $valor)) {
    $valorConvertido = @utf8_encode($valor);
    if ($valorConvertido !== false && $valorConvertido !== '') {
      $valor = $valorConvertido;
    }
  }

  $buscar = array(
    'Á', 'À', 'Â', 'Ä', 'Ã', 'Å', 'á', 'à', 'â', 'ä', 'ã', 'å',
    'É', 'È', 'Ê', 'Ë', 'é', 'è', 'ê', 'ë',
    'Í', 'Ì', 'Î', 'Ï', 'í', 'ì', 'î', 'ï',
    'Ó', 'Ò', 'Ô', 'Ö', 'Õ', 'ó', 'ò', 'ô', 'ö', 'õ',
    'Ú', 'Ù', 'Û', 'Ü', 'ú', 'ù', 'û', 'ü',
    'Ñ', 'ñ', 'Ç', 'ç',
    '“', '”', '‘', '’', '´', '`',
    '–', '—', '…', '•',
    '¡', '¿',
    '°', 'ª', 'º',
    'Ã¡', 'Ã©', 'Ã­', 'Ã³', 'Ãº', 'Ã±', 'Ã‘',
    'ÃÁ', 'Ã‰', 'ÃÍ', 'Ã“', 'Ãš',
    'Â', '�'
  );

  $reemplazar = array(
    'A', 'A', 'A', 'A', 'A', 'A', 'a', 'a', 'a', 'a', 'a', 'a',
    'E', 'E', 'E', 'E', 'e', 'e', 'e', 'e',
    'I', 'I', 'I', 'I', 'i', 'i', 'i', 'i',
    'O', 'O', 'O', 'O', 'O', 'o', 'o', 'o', 'o', 'o',
    'U', 'U', 'U', 'U', 'u', 'u', 'u', 'u',
    'N', 'n', 'C', 'c',
    '"', '"', '', '', '', '',
    '-', '-', '...', '-',
    '', '',
    '', '', '',
    'a', 'e', 'i', 'o', 'u', 'n', 'N',
    'A', 'E', 'I', 'O', 'U',
    '', ''
  );

  $valor = str_replace($buscar, $reemplazar, $valor);

  if (function_exists('iconv')) {
    $valorIconv = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $valor);
    if ($valorIconv !== false && $valorIconv !== '') {
      $valor = $valorIconv;
    }
  }

  $valor = preg_replace('/[^A-Za-z0-9\s\.\,\-\_\:\;\(\)\[\]\/]/', ' ', $valor);
  $valor = preg_replace('/[ ]+/', ' ', $valor);
  $valor = preg_replace('/[\r\n]+/', ' ', $valor);
  $valor = trim($valor);

  return str_replace("'", "''", $valor);
}

function responder($data)
{
  echo json_encode($data);
  exit;
}

function mimePorExtension($extension)
{
  $mimes = array(
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'pdf' => 'application/pdf',
    'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls' => 'application/vnd.ms-excel',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc' => 'application/msword'
  );

  return isset($mimes[$extension]) ? $mimes[$extension] : 'application/octet-stream';
}

function optimizarImagen($tmpName, $extension)
{
  if (!function_exists('imagecreatetruecolor')) {
    return file_get_contents($tmpName);
  }

  $extension = strtolower($extension);
  $origen = null;

  if (($extension == 'jpg' || $extension == 'jpeg') && function_exists('imagecreatefromjpeg')) {
    $origen = @imagecreatefromjpeg($tmpName);
  }

  if ($extension == 'png' && function_exists('imagecreatefrompng')) {
    $origen = @imagecreatefrompng($tmpName);
  }

  if (!$origen) {
    return file_get_contents($tmpName);
  }

  $ancho = imagesx($origen);
  $alto = imagesy($origen);
  $maximo = 1280;

  $nuevoAncho = $ancho;
  $nuevoAlto = $alto;

  if ($ancho > $maximo || $alto > $maximo) {
    if ($ancho >= $alto) {
      $nuevoAncho = $maximo;
      $nuevoAlto = intval(($alto / $ancho) * $maximo);
    } else {
      $nuevoAlto = $maximo;
      $nuevoAncho = intval(($ancho / $alto) * $maximo);
    }
  }

  $destino = imagecreatetruecolor($nuevoAncho, $nuevoAlto);
  $blanco = imagecolorallocate($destino, 255, 255, 255);
  imagefill($destino, 0, 0, $blanco);
  imagecopyresampled($destino, $origen, 0, 0, 0, 0, $nuevoAncho, $nuevoAlto, $ancho, $alto);

  ob_start();
  imagejpeg($destino, null, 65);
  $contenido = ob_get_clean();

  imagedestroy($origen);
  imagedestroy($destino);

  return $contenido;
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
$evidencia_binaria_hex = 'NULL';
$evidencia_mime = '';
$evidencia_extension = '';
$evidencia_peso_original = 0;
$evidencia_peso_final = 0;
$evidencia_compresion = '';

if (isset($_FILES['evidencia']) && $_FILES['evidencia']['error'] === UPLOAD_ERR_OK) {
  $nombreOriginal = $_FILES['evidencia']['name'];
  $tmpName = $_FILES['evidencia']['tmp_name'];
  $extension = strtolower(pathinfo($nombreOriginal, PATHINFO_EXTENSION));

  $pesoArchivo = isset($_FILES['evidencia']['size']) ? intval($_FILES['evidencia']['size']) : 0;
  $pesoMaximo = 1024 * 1024;

  if ($pesoArchivo > $pesoMaximo) {
    responder(array(
      "success" => false,
      "error" => "La evidencia supera el peso maximo permitido de 1 MB"
    ));
  }

  $permitidas = array('jpg', 'jpeg', 'png', 'gif', 'pdf', 'xlsx', 'xls', 'doc', 'docx');

  if (!in_array($extension, $permitidas)) {
    responder(array(
      "success" => false,
      "error" => "Tipo de archivo no permitido"
    ));
  }

  if ($extension == 'jpg' || $extension == 'jpeg' || $extension == 'png') {
    $contenido = optimizarImagen($tmpName, $extension);
    $evidencia_mime = 'image/jpeg';
    $evidencia_extension = 'jpg';
  } else {
    $contenido = file_get_contents($tmpName);
    $evidencia_mime = mimePorExtension($extension);
    $evidencia_extension = $extension;
  }

  if ($contenido === false || strlen($contenido) <= 0) {
    responder(array(
      "success" => false,
      "error" => "No se pudo leer la evidencia"
    ));
  }

  $contenidoComprimido = gzcompress($contenido, 9);

  if ($contenidoComprimido !== false && strlen($contenidoComprimido) < strlen($contenido)) {
    $contenidoFinal = $contenidoComprimido;
    $evidencia_compresion = 'GZIP';
  } else {
    $contenidoFinal = $contenido;
    $evidencia_compresion = 'NONE';
  }

  $evidencia_nombre = limpiar($nombreOriginal);
  $evidencia_peso_original = $pesoArchivo;
  $evidencia_peso_final = strlen($contenidoFinal);
  $evidencia_binaria_hex = "0x" . bin2hex($contenidoFinal);
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
    evidencia_binaria,
    evidencia_mime,
    evidencia_extension,
    evidencia_peso_original,
    evidencia_peso_final,
    evidencia_compresion,
    estatus,
    activo,
    usuario_creacion,
    fecha_creacion
  )
  OUTPUT INSERTED.id_observacion AS id_observacion
  VALUES (
    '$cia',
    '$cef',
    '$fecha_observacion',
    '$responsable',
    '$tipo_observacion',
    '$descripcion',
    '$accion_sugerida',
    '$evidencia_nombre',
    '',
    $evidencia_binaria_hex,
    '$evidencia_mime',
    '$evidencia_extension',
    $evidencia_peso_original,
    $evidencia_peso_final,
    '$evidencia_compresion',
    'ABIERTA',
    1,
    '$usuario_creacion',
    GETDATE()
  )
";

$result = mssql_query($sqlInsert, $conn);

if (!$result) {
  responder(array(
    "success" => false,
    "error" => "Error al guardar la observacion",
    "detalle" => mssql_get_last_message()
  ));
}

$row = mssql_fetch_assoc($result);
$id_observacion = isset($row['id_observacion']) ? intval($row['id_observacion']) : 0;

if ($id_observacion > 0 && $evidencia_binaria_hex != 'NULL') {
  $sqlEvidencia = "
    INSERT INTO CAP_OBSERVACIONES_EVIDENCIAS (
      id_observacion,
      nombre_archivo,
      ruta_archivo,
      extension,
      peso_bytes,
      archivo_binario,
      mime_type,
      peso_original,
      peso_final,
      compresion,
      activo,
      fecha_creacion
    )
    VALUES (
      $id_observacion,
      '$evidencia_nombre',
      '',
      '$evidencia_extension',
      $evidencia_peso_final,
      $evidencia_binaria_hex,
      '$evidencia_mime',
      $evidencia_peso_original,
      $evidencia_peso_final,
      '$evidencia_compresion',
      1,
      GETDATE()
    )
  ";

  $resultEvidencia = mssql_query($sqlEvidencia, $conn);

  if (!$resultEvidencia) {
    responder(array(
      "success" => false,
      "error" => "La observacion se guardo, pero fallo la evidencia",
      "detalle" => mssql_get_last_message(),
      "id_observacion" => $id_observacion
    ));
  }
}

responder(array(
  "success" => true,
  "mensaje" => "Observacion guardada correctamente",
  "id_observacion" => $id_observacion,
  "evidencia_nombre" => $evidencia_nombre,
  "evidencia_mime" => $evidencia_mime,
  "evidencia_extension" => $evidencia_extension,
  "evidencia_peso_original" => $evidencia_peso_original,
  "evidencia_peso_final" => $evidencia_peso_final,
  "evidencia_compresion" => $evidencia_compresion
));
?>
