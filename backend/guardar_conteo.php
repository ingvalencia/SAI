<?php
// --- Encabezados para CORS y JSON ---
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// --- Parámetros recibidos ---
$id_inventario = isset($_POST['id_inventario']) ? intval($_POST['id_inventario']) : null;
$nro_conteo    = isset($_POST['nro_conteo']) ? intval($_POST['nro_conteo']) : null;
$cantidad      = isset($_POST['cantidad']) ? floatval($_POST['cantidad']) : null;
$usuario       = isset($_POST['usuario']) ? $_POST['usuario'] : null;

// --- Validar parámetros ---
if ($id_inventario === null || $nro_conteo === null || $cantidad === null || $usuario === null) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}

if (!in_array($nro_conteo, [0, 1, 2])) {
  echo json_encode(["success" => false, "error" => "Número de conteo inválido"]);
  exit;
}

// --- Conexión a SQL Server ---
$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(["success" => false, "error" => "No se pudo conectar a SQL Server"]);
  exit;
}
mssql_select_db($db, $conn);

// --- Verificar si ya existe el conteo ---
$existe = mssql_query("
  SELECT COUNT(*) AS total
  FROM CAP_INVENTARIO_CONTEOS
  WHERE id_inventario = $id_inventario AND nro_conteo = $nro_conteo
", $conn);

$row = mssql_fetch_assoc($existe);
if ($row && intval($row['total']) > 0) {
  // --- Update si ya existe ---
  $sql = "
    UPDATE CAP_INVENTARIO_CONTEOS
    SET cantidad = $cantidad,
        usuario = '$usuario',
        fecha = GETDATE()
    WHERE id_inventario = $id_inventario AND nro_conteo = $nro_conteo
  ";
} else {
  // --- Insert si no existe ---
  $sql = "
    INSERT INTO CAP_INVENTARIO_CONTEOS (id_inventario, nro_conteo, cantidad, usuario, fecha)
    VALUES ($id_inventario, $nro_conteo, $cantidad, '$usuario', GETDATE())
  ";
}

// --- Ejecutar SQL ---
$res = mssql_query($sql, $conn);
if (!$res) {
  $error = mssql_get_last_message();
  echo json_encode(["success" => false, "error" => "Error en SQL: $error"]);
  exit;
}

// --- Respuesta OK ---
echo json_encode([
  "success" => true,
  "mensaje" => "Conteo $nro_conteo guardado correctamente"
]);
exit;
