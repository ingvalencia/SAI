<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

/* ============================
   PARÁMETROS (GET)
============================ */
$tipo_conteo = isset($_GET['tipo_conteo']) ? trim($_GET['tipo_conteo']) : null;
$usuariosRaw = isset($_GET['usuarios']) ? trim($_GET['usuarios']) : null;
$almacenesRaw = isset($_GET['almacenes']) ? trim($_GET['almacenes']) : null;
$cia = isset($_GET['cia']) ? trim($_GET['cia']) : null;
$fecha = isset($_GET['fecha']) ? trim($_GET['fecha']) : null;
$creado_por = isset($_GET['creado_por']) ? trim($_GET['creado_por']) : null;

/* ============================
   VALIDACIONES
============================ */
if (
  !$tipo_conteo ||
  !$usuariosRaw ||
  !$almacenesRaw ||
  !$cia ||
  !$fecha
) {
  echo json_encode(['success' => false, 'error' => 'Faltan datos obligatorios']);
  exit;
}

$usuarios = array_filter(array_map('intval', explode(',', $usuariosRaw)));
$almacenes = array_filter(array_map('trim', explode(',', $almacenesRaw)));

if ($tipo_conteo === 'Individual' && count($usuarios) !== 1) {
  echo json_encode(['success' => false, 'error' => 'Individual requiere 1 usuario']);
  exit;
}

if ($tipo_conteo === 'Brigada' && count($usuarios) !== 2) {
  echo json_encode(['success' => false, 'error' => 'Brigada requiere 2 usuarios']);
  exit;
}

/* ============================
   CONEXIÓN SQL SERVER
============================ */
$conn = mssql_connect("192.168.0.174", "sa", "P@ssw0rd");
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'No se pudo conectar a SQL Server']);
  exit;
}
mssql_select_db("SAP_PROCESOS", $conn);

/* ============================
   TRANSACCIÓN
============================ */
mssql_query("BEGIN TRAN", $conn);

try {

  /* ============================
     ASIGNAR ROLES Y LOCALES
  ============================ */
  foreach ($usuarios as $usuario_id) {

    // ❌ No permitir roles 1 o 2
    $qr = mssql_query("
      SELECT 1
      FROM usuario_rol
      WHERE usuario_id = $usuario_id
        AND rol_id IN (1,2)
    ", $conn);

    if ($qr && mssql_num_rows($qr) > 0) {
      throw new Exception("El usuario $usuario_id no puede ser Operador de Inventario");
    }

    // ✅ Asegurar rol 4
    mssql_query("
      IF NOT EXISTS (
        SELECT 1 FROM usuario_rol
        WHERE usuario_id = $usuario_id AND rol_id = 4
      )
      INSERT INTO usuario_rol (usuario_id, rol_id)
      VALUES ($usuario_id, 4)
    ", $conn);

    // ✅ Asignar locales
    foreach ($almacenes as $alm) {
      $almEsc = str_replace("'", "''", $alm);
      $ciaEsc = str_replace("'", "''", $cia);

      mssql_query("
        IF NOT EXISTS (
          SELECT 1 FROM usuario_local
          WHERE usuario_id = $usuario_id
            AND local_codigo = '$almEsc'
            AND cia = '$ciaEsc'
        )
        INSERT INTO usuario_local (usuario_id, local_codigo, cia, activo)
        VALUES ($usuario_id, '$almEsc', '$ciaEsc', 1)
      ", $conn);
    }
  }

  /* ============================
     CAP_CONTEO_CONFIG (CLAVE)
     👉 1 usuario = 1 conteo
  ============================ */
  $nroConteo = 1;

  foreach ($usuarios as $usuario_id) {

    foreach ($almacenes as $alm) {
      $almEsc = str_replace("'", "''", $alm);
      $ciaEsc = str_replace("'", "''", $cia);

      $usuariosJson = '[' . $usuario_id . ']';

      mssql_query("
        INSERT INTO CAP_CONTEO_CONFIG
          (tipo_conteo, nro_conteo, usuarios_asignados, cia, almacen, fecha_asignacion, estatus)
        VALUES
          (
            '$tipo_conteo',
            $nroConteo,
            '$usuariosJson',
            '$ciaEsc',
            '$almEsc',
            '$fecha',
            0
          )
      ", $conn);
    }

    // 👉 siguiente usuario = siguiente conteo
    $nroConteo++;
  }

  mssql_query("COMMIT", $conn);

  echo json_encode(['success' => true]);

} catch (Exception $e) {
  mssql_query("ROLLBACK", $conn);
  echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

mssql_close($conn);
