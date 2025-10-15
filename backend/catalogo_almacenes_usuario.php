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

$cia = isset($_GET['cia']) ? trim($_GET['cia']) : null;
$empleado = isset($_GET['empleado']) ? trim($_GET['empleado']) : null;

if (!$cia || !$empleado) {
  echo json_encode(['success' => false, 'error' => 'Faltan parámetros']);
  exit;
}

// Conexión
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

// ==========================
// Obtener ID de usuario
// ==========================
$sqlUsuario = "SELECT id FROM usuarios WHERE empleado = '$empleado'";
$resUsuario = @mssql_query($sqlUsuario, $conn);
if (!$resUsuario || !mssql_num_rows($resUsuario)) {
  echo json_encode(['success' => false, 'error' => 'Empleado no encontrado']);
  exit;
}
$rowUsuario = mssql_fetch_assoc($resUsuario);
$usuarioId = $rowUsuario['id'];

// ==========================
// Obtener almacenes permitidos
// ==========================
$sql = "SELECT local_codigo FROM usuario_local WHERE usuario_id = $usuarioId AND cia = '$cia' AND activo = 1";
$res = @mssql_query($sql, $conn);
if (!$res) {
  echo json_encode(['success' => false, 'error' => 'Error al consultar almacenes asignados']);
  exit;
}

$almacenesPermitidos = [];
while ($row = mssql_fetch_assoc($res)) {
  $almacenesPermitidos[] = trim($row['local_codigo']);
}

// ==========================
// Ejecutar SP para catálogo
// ==========================
$sqlSP = "EXEC [dbo].[USP_ALMACENES_SAP_CIAS] '$cia'";
$resSP = @mssql_query($sqlSP, $conn);
if (!$resSP) {
  echo json_encode(['success' => false, 'error' => 'Error al ejecutar SP: ' . mssql_get_last_message()]);
  exit;
}

$data = [];
// ==============================
// Por cada almacén permitido
// ==============================

while ($row = mssql_fetch_assoc($resSP)) {
  $codigo = trim($row['Codigo Almacen']);

  if (in_array($codigo, $almacenesPermitidos)) {

    // Buscar fecha_gestion desde configuracion_inventario
    $sqlFecha = "
      SELECT ci.fecha_gestion
      FROM configuracion_inventario ci
      JOIN configuracion_inventario_almacenes ciaa
        ON ciaa.configuracion_id = ci.id
      WHERE ci.cia = '$cia'
        AND ciaa.almacen = '$codigo'
    ";

    $resFecha = mssql_query($sqlFecha, $conn);
    $fecha = null;

    if ($resFecha && mssql_num_rows($resFecha) > 0) {
      $rowFecha = mssql_fetch_assoc($resFecha);
      $fechaRaw = trim($rowFecha['fecha_gestion']);

      if ($fechaRaw) {
        $dt = DateTime::createFromFormat('M d Y h:i:s:A', $fechaRaw);
        if ($dt) {
          $fecha = $dt->format('d/m/Y');  // ← ahora sí: dd/mm/yyyy
        } else {
          $fecha = null;
        }
      }
    }

    // Resultado final por almacén
    $data[] = [
      'codigo' => utf8_encode($codigo),
      'nombre' => utf8_encode($row['Nombre']),
      'fecha_gestion' => $fecha
    ];
  }
}



echo json_encode(['success' => true, 'data' => $data]);
exit;
