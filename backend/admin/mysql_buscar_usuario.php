<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

/* ============================
   PARÁMETROS
============================ */
$empleado = isset($_GET['empleado']) ? trim($_GET['empleado']) : null;

if (!$empleado) {
  echo json_encode([
    'success' => false,
    'error' => 'Falta el número de empleado'
  ]);
  exit;
}

/* ============================
   CONEXIÓN MYSQL 5
============================ */
$mysql_host = "192.168.0.13";
$mysql_user = "root";
$mysql_pass = "*MDBthor20251104$$";
$mysql_db   = "gd";

$conn = mysqli_connect($mysql_host, $mysql_user, $mysql_pass, $mysql_db);

if (!$conn) {
  echo json_encode([
    'success' => false,
    'error' => 'No se pudo conectar a MySQL: ' . mysqli_connect_error()
  ]);
  exit;
}

mysqli_set_charset($conn, 'utf8');

/* ============================
   CONSULTA
============================ */
$sql = "
  SELECT
    noempl,
    nombre,
    ap_paterno,
    ap_materno,
    email,
    pass
  FROM usuarios
  WHERE noempl = ?
  LIMIT 1
";

$stmt = mysqli_prepare($conn, $sql);
mysqli_stmt_bind_param($stmt, 's', $empleado);
mysqli_stmt_execute($stmt);

/* 🔴 OBLIGATORIO EN PHP 5.4 SIN mysqlnd */
mysqli_stmt_store_result($stmt);

mysqli_stmt_bind_result(
  $stmt,
  $noempl,
  $nombre,
  $ap_paterno,
  $ap_materno,
  $email,
  $pass
);

if (!mysqli_stmt_fetch($stmt)) {
  echo json_encode([
    'success' => false,
    'error' => 'Empleado no encontrado en MySQL'
  ]);
  mysqli_stmt_close($stmt);
  mysqli_close($conn);
  exit;
}

/* ============================
   RESPUESTA NORMALIZADA
============================ */
echo json_encode([
  'success' => true,
  'data' => [
    'empleado' => $noempl,
    'nombre'   => trim($nombre . ' ' . $ap_paterno . ' ' . $ap_materno),
    'email'    => $email,
    'password' => $pass
  ]
]);

mysqli_stmt_close($stmt);
mysqli_close($conn);
