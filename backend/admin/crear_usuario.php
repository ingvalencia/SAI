<?php
// ====== CORS para permitir cookies desde React local ======
$origenPermitido = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origenPermitido, [
  'http://localhost:3000',
  'https://diniz.com.mx'
])) {
  header("Access-Control-Allow-Origin: $origenPermitido");
  header("Access-Control-Allow-Credentials: true");
  header("Access-Control-Allow-Headers: Content-Type");
  header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
}


if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}



// ====== INPUT ======
$raw   = file_get_contents("php://input");
$input = $raw ? json_decode($raw, true) : $_POST;

8'0'
$empleado     = isset($input["empleado"]) ? trim($input["empleado"]) : null;
$nombre       = isset($input["nombre"]) ? trim($input["nombre"]) : null;
$password     = isset($input["password"]) ? (string) $input["password"] : null;
$email        = isset($input["email"]) ? trim($input["email"]) : null;
$rol_id       = isset($input["rol_id"]) ? trim($input["rol_id"]) : null;;
$cia          = isset($input["cia"]) ? trim($input["cia"]) : null;
$locales      = isset($input["locales"]) && is_array($input["locales"]) ? $input["locales"] : [];
$rol_creador  = isset($input["rol_creador"]) ? intval($input["rol_creador"]) : 4;
$creado_por = isset($input["creado_por"]) ? trim($input["creado_por"]) : null;


if (!$empleado || !$nombre || !$password || !$rol_id) {
  echo json_encode(["success" => false, "error" => "Faltan datos obligatorios"]);
  exit;
}

// ====== CONEXIÓN MSSQL ======
$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'No se pudo conectar']);
  exit;
}
mssql_select_db($db, $conn);

$empleadoEsc = str_replace("'", "''", $empleado);
$nombreEsc   = str_replace("'", "''", $nombre);
$emailEsc    = $email ? str_replace("'", "''", $email) : null;

// ====== VALIDAR SI YA EXISTE ======
$check = mssql_query("SELECT id FROM usuarios WHERE empleado = '{$empleadoEsc}'", $conn);
if ($check && mssql_num_rows($check) > 0) {
  echo json_encode(["success" => false, "error" => "El empleado ya existe"]);
  exit;
}

// ====== CREAR USUARIO ======


$campos  = "empleado, nombre, password_hash, salt, activo, creado_por";
$valores = "'{$empleadoEsc}', '{$nombreEsc}', '{$password}', '', 1,'{$creado_por}'";

if ($emailEsc) {
  $campos  .= ", email";
  $valores .= ", '{$emailEsc}'";
}

$sqlInsert = "INSERT INTO usuarios ($campos) VALUES ($valores)";
$ok = mssql_query($sqlInsert, $conn);
if (!$ok) {
  echo json_encode(["success" => false, "error" => "Error al registrar usuario"]);
  exit;
}

// ====== OBTENER ID DEL USUARIO NUEVO ======
$getUser = mssql_query("SELECT id FROM usuarios WHERE empleado = '{$empleadoEsc}'", $conn);
$u = mssql_fetch_assoc($getUser);
$usuario_id = intval($u["id"]);

// ====== ASIGNAR ROL SELECCIONADO ======
mssql_query("INSERT INTO usuario_rol (usuario_id, rol_id) VALUES ($usuario_id, $rol_id)", $conn);

// ====== SOLO ROL 3 asigna locales ======
if ($rol_creador === 3 && $cia && count($locales) > 0) {
  foreach ($locales as $local_codigo) {
    $localEsc = str_replace("'", "''", $local_codigo);
    $ciaEsc   = str_replace("'", "''", $cia);
    mssql_query("INSERT INTO usuario_local (usuario_id, local_codigo, cia, activo)
                 VALUES ($usuario_id, '{$localEsc}', '{$ciaEsc}', 1)", $conn);
  }
}

// ====== RESPUESTA OK ======
echo json_encode([
  "success" => true,
  "usuario" => [
    "empleado" => $empleado,
    "nombre"   => $nombre,
    "email"    => $email,
    "locales"  => $locales
  ]
]);
exit;
