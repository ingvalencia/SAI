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

// ==============================
// 1. Parámetros
// ==============================

// recibir cia, fecha, usuario
$cia             = isset($_POST['cia']) ? trim($_POST['cia']) : null;
$fecha_gestion   = isset($_POST['fecha_gestion']) ? trim($_POST['fecha_gestion']) : null;
$actualizado_por = isset($_POST['actualizado_por']) ? trim($_POST['actualizado_por']) : null;
$nivel_conteo    = isset($_POST['nivel_conteo']) ? trim($_POST['nivel_conteo']) : null;

// recibir almacenes[]
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

// validación (ojo: aquí usamos === null para permitir 0 en nivel_conteo)
if ($cia === null || $fecha_gestion === null || $actualizado_por === null || $nivel_conteo === null || count($almacenes) === 0) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros obligatorios']);
  exit;
}

// ==============================
// 2. Conexión MSSQL
// ==============================
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

// ==============================
// 3. Verificar si ya existe configuración para la CIA
// ==============================
$sqlExiste = "SELECT TOP 1 id FROM configuracion_inventario WHERE cia = '$cia'";
$resExiste = mssql_query($sqlExiste, $conn);

if (!$resExiste) {
  echo json_encode(['success' => false, 'error' => 'Error al verificar configuración existente']);
  exit;
}

if (mssql_num_rows($resExiste)) {
  // ==============================
  // 4. Actualizar fecha_gestion y actualizado_por
  // ==============================
  $row = mssql_fetch_assoc($resExiste);
  $configId = $row['id'];

  $sqlUpdate = "
    UPDATE configuracion_inventario
    SET fecha_gestion = '$fecha_gestion',
        actualizado_por = $actualizado_por,
        actualizado_en = GETDATE()
    WHERE id = $configId
  ";
  mssql_query($sqlUpdate, $conn);

  // Eliminar almacenes previos
  mssql_query("DELETE FROM configuracion_inventario_almacenes WHERE configuracion_id = $configId", $conn);
} else {
  // ==============================
  // 5. Insertar nueva configuración
  // ==============================
  $sqlInsert = "
    INSERT INTO configuracion_inventario (cia, fecha_gestion, actualizado_por, actualizado_en)
    VALUES ('$cia', '$fecha_gestion', $actualizado_por, GETDATE())
  ";
  $insertado = mssql_query($sqlInsert, $conn);
  if (!$insertado) {
    echo json_encode(['success' => false, 'error' => 'Error al insertar configuración']);
    exit;
  }

  // Obtener ID recién insertado
  $resId = mssql_query("SELECT @@IDENTITY AS id", $conn);
  $rowId = mssql_fetch_assoc($resId);
  $configId = $rowId['id'];
}

// ==============================
// 6. Insertar almacenes seleccionados
// ==============================
foreach ($almacenes as $alm) {
  $almacen = trim($alm);
  if ($almacen !== "") {
    $sqlAlmacen = "
      INSERT INTO configuracion_inventario_almacenes (configuracion_id, almacen, conteo)
      VALUES ($configId, '$almacen', '$nivel_conteo')
    ";
    mssql_query($sqlAlmacen, $conn);
  }
}

// ==============================
// 7. Respuesta final
// ==============================
echo json_encode([
  'success' => true,
  'mensaje' => 'Configuración guardada',
  'configuracion_id' => $configId
]);
exit;
?>
