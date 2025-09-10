<?php
// ====== CORS para permitir cookies desde React local ======
$origenPermitido = 'http://localhost:3000';
header("Access-Control-Allow-Origin: $origenPermitido");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");


// Opcional: responder rápido a preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

session_name('SAI_SES');
session_start();

// ====== INPUT ======
$raw   = file_get_contents("php://input");
$input = $raw ? json_decode($raw, true) : $_POST;

$empleado = isset($input['empleado']) ? trim($input['empleado']) : null;
$password = isset($input['password']) ? (string)$input['password'] : null;

if (!$empleado || $password === null) {
  echo json_encode(['success'=>false,'error'=>'Faltan credenciales']); exit;
}

// ====== CONEXIÓN ======
$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) { echo json_encode(['success'=>false,'error'=>'No se pudo conectar a la BD']); exit; }
mssql_select_db($db, $conn);

$esc = function($s){ return str_replace("'", "''", $s); };
$empleadoEsc = $esc($empleado);

// ====== CONSULTA USUARIO ======
$sql = "
  SELECT TOP 1
    u.id, u.empleado, u.nombre, u.activo, u.password_hash, u.salt, u.pass_sha256
  FROM dbo.usuarios u
  WHERE u.empleado = '{$empleadoEsc}'
";
$res = mssql_query($sql, $conn);
if (!$res || mssql_num_rows($res) === 0) {
  echo json_encode(['success'=>false,'error'=>'Usuario o contraseña inválidos']); exit;
}
$u = mssql_fetch_assoc($res);
if (!$u['activo']) { echo json_encode(['success'=>false,'error'=>'Usuario inactivo']); exit; }

// ====== VALIDACIÓN PASSWORD ======
$ok = false;
$salt = isset($u['salt']) ? $u['salt'] : '';

if ($salt !== '' && strlen($salt) > 0) {
  $calc = md5($salt . $password);
  $ok = (strtolower($calc) === strtolower($u['password_hash']));
} else if (!empty($u['password_hash']) && strlen($u['password_hash']) === 32) {
  $calc = md5($password);
  $ok = (strtolower($calc) === strtolower($u['password_hash']));
} else if (!empty($u['pass_sha256']) && strlen($u['pass_sha256']) === 64) {
  $calcSha = ($salt !== '' ? hash('sha256', $salt.$password) : hash('sha256', $password));
  $ok = (strtolower($calcSha) === strtolower($u['pass_sha256']));
}

if (!$ok) {
  echo json_encode(['success'=>false,'error'=>'Usuario o contraseña inválidos']); exit;
}

// ====== ROLES ======
$roles = array();
$qr = @mssql_query("
  SELECT r.nombre
  FROM dbo.usuario_rol ur
  JOIN dbo.roles r ON r.id = ur.rol_id
  WHERE ur.usuario_id = ".intval($u['id'])."
", $conn);
if ($qr) {
  while ($r = mssql_fetch_assoc($qr)) $roles[] = $r['nombre'];
}

// ====== SESIÓN ======
session_name('SAI_SES');
session_start();
$_SESSION['empleado'] = $u['empleado'];
$_SESSION['nombre']   = $u['nombre'];
$_SESSION['roles']    = $roles;

// ====== RESPUESTA ======
echo json_encode(array(
  'success'  => true,
  'empleado' => $u['empleado'],
  'nombre'   => $u['nombre'],
  'roles'    => $roles
));
exit;
