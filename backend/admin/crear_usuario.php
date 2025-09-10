<?php
// ====== CORS para permitir cookies desde React local ======
$origenPermitido = 'http://localhost:3000';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

// ====== INPUT ======
$raw   = file_get_contents("php://input");
$input = $raw ? json_decode($raw, true) : $_POST;

$empleado = isset($input["empleado"]) ? trim($input["empleado"]) : null;
$nombre   = isset($input["nombre"]) ? trim($input["nombre"]) : null;
$password = isset($input["password"]) ? (string) $input["password"] : null;
$cia      = isset($input["cia"]) ? trim($input["cia"]) : null;
$locales  = isset($input["locales"]) && is_array($input["locales"]) ? $input["locales"] : [];

if (!$empleado || !$nombre || !$password || !$cia) {
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

// ====== VALIDAR SI YA EXISTE ======
$check = mssql_query("SELECT id FROM usuarios WHERE empleado = '{$empleadoEsc}'", $conn);
if ($check && mssql_num_rows($check) > 0) {
  echo json_encode(["success" => false, "error" => "El empleado ya existe"]);
  exit;
}

// ====== CREAR USUARIO ======
$salt = substr(md5(uniqid()), 0, 8);
$hash = md5($salt . $password);
$sqlInsert = "
  INSERT INTO usuarios (empleado, nombre, password_hash, salt, activo)
  VALUES ('{$empleadoEsc}', '{$nombreEsc}', '{$hash}', '{$salt}', 1)
";
$ok = mssql_query($sqlInsert, $conn);
if (!$ok) {
  echo json_encode(["success" => false, "error" => "Error al crear el usuario"]);
  exit;
}

// ====== OBTENER ID DEL USUARIO NUEVO ======
$getUser = mssql_query("SELECT id FROM usuarios WHERE empleado = '{$empleadoEsc}'", $conn);
$u = mssql_fetch_assoc($getUser);
$usuario_id = intval($u["id"]);

// ====== ASIGNAR ROL CAPTURISTA (rol_id = 3) ======
mssql_query("INSERT INTO usuario_rol (usuario_id, rol_id) VALUES ($usuario_id, 3)", $conn);

// ====== ASIGNAR LOCALES ======
foreach ($locales as $local_codigo) {
  $localEsc = str_replace("'", "''", $local_codigo);
  $ciaEsc   = str_replace("'", "''", $cia);
  mssql_query("
    INSERT INTO usuario_local (usuario_id, local_codigo, cia, activo)
    VALUES ($usuario_id, '{$localEsc}', '{$ciaEsc}', 1)
  ", $conn);
}

// ====== RESPUESTA OK ======
echo json_encode([
  "success" => true,
  "usuario" => [
    "empleado" => $empleado,
    "nombre"   => $nombre,
    "locales"  => $locales
  ]
]);
exit;
