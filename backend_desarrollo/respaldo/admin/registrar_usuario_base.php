<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}


$input = json_decode(file_get_contents("php://input"), true);
if (is_array($input)) {
  $_POST = $input;
}


$empleado = isset($_POST['empleado']) ? trim($_POST['empleado']) : null;
$nombre   = isset($_POST['nombre'])   ? trim($_POST['nombre'])   : null;
$email    = isset($_POST['email'])    ? trim($_POST['email'])    : null;
$password = isset($_POST['password']) ? trim($_POST['password']) : null;
$creado_por = isset($_POST['creado_por']) ? trim($_POST['creado_por']) : null;


if (!$empleado || !$nombre || !$password) {
  echo json_encode([
    'success' => false,
    'error' => 'Faltan datos obligatorios'
  ]);
  exit;
}


$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode([
    'success' => false,
    'error' => 'No se pudo conectar a SQL Server'
  ]);
  exit;
}

mssql_select_db($db, $conn);


$empleado_safe = intval($empleado);

$qr = mssql_query("
  SELECT id
  FROM usuarios
  WHERE empleado = $empleado_safe
", $conn);

if ($qr && mssql_num_rows($qr) > 0) {
  echo json_encode([
    'success' => false,
    'error' => 'El usuario ya existe en el sistema'
  ]);
  mssql_close($conn);
  exit;
}


$nombre_safe   = addslashes($nombre);
$email_safe    = $email ? "'" . addslashes($email) . "'" : "NULL";
$password_safe = addslashes($password);
$creado_por_safe = $creado_por ? "'" . addslashes($creado_por) . "'" : "NULL";

$insert = mssql_query("
  INSERT INTO usuarios (
    empleado,
    nombre,
    email,
    password_hash,
    activo,
    creado_en,
    creado_por
  ) VALUES (
    $empleado_safe,
    '$nombre_safe',
    $email_safe,
    '$password_safe',
    1,
    GETDATE(),
    $creado_por_safe
  )
", $conn);

if (!$insert) {
  echo json_encode([
    'success' => false,
    'error' => 'Error al registrar el usuario'
  ]);
  mssql_close($conn);
  exit;
}


echo json_encode([
  'success' => true,
  'mensaje' => 'Usuario registrado correctamente'
]);

mssql_close($conn);
