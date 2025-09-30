<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// === Conexión SQL Server ===
$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(["success" => false, "error" => "No se pudo conectar a la base de datos"]);
  exit;
}
mssql_select_db($db, $conn);

// === Acción ===
$action = isset($_REQUEST['action']) ? $_REQUEST['action'] : null;

if (!$action) {
  echo json_encode(["success" => false, "error" => "Falta parámetro action"]);
  exit;
}

switch ($action) {
  // ====================
  // LISTAR
  // ====================
  case 'listar':
    $query = "
      SELECT a.id,
             c.cia,
             c.fecha_gestion,
             a.almacen,
             a.conteo,
             c.actualizado_por,
             c.actualizado_en
      FROM configuracion_inventario c
      JOIN configuracion_inventario_almacenes a ON c.id = a.configuracion_id
      ORDER BY c.fecha_gestion DESC, c.cia, a.almacen
    ";
    $result = mssql_query($query, $conn);

    if (!$result) {
      echo json_encode(["success" => false, "error" => "Error en consulta: " . mssql_get_last_message()]);
      exit;
    }

    $rows = [];
    while ($row = mssql_fetch_assoc($result)) {
      $rows[] = $row;
    }

    echo json_encode(["success" => true, "data" => $rows]);
    exit;

  // ====================
  // ELIMINAR
  // ====================
  case 'eliminar':
    $id = isset($_POST['id']) ? intval($_POST['id']) : 0;
    if ($id <= 0) {
      echo json_encode(["success" => false, "error" => "ID inválido"]);
      exit;
    }

    $query = "DELETE FROM configuracion_inventario_almacenes WHERE id = $id";
    $res = mssql_query($query, $conn);

    if (!$res) {
      echo json_encode(["success" => false, "error" => "Error al eliminar: " . mssql_get_last_message()]);
      exit;
    }

    echo json_encode(["success" => true, "mensaje" => "Configuración eliminada"]);
    exit;

  // ====================
  // EDITAR
  // ====================
  case 'editar':
    $id      = isset($_POST['id']) ? intval($_POST['id']) : 0;
    $cia     = isset($_POST['cia']) ? $_POST['cia'] : null;
    $fecha   = isset($_POST['fecha_gestion']) ? $_POST['fecha_gestion'] : null;
    $almacen = isset($_POST['almacen']) ? $_POST['almacen'] : null;
    $conteo  = isset($_POST['conteo']) ? intval($_POST['conteo']) : 0;
    $usuario = isset($_POST['usuario']) ? $_POST['usuario'] : null;

    if ($id <= 0 || !$cia || !$fecha || !$almacen) {
      echo json_encode(["success" => false, "error" => "Datos incompletos"]);
      exit;
    }

    // Actualizar cabecera
    $queryCab = "
      UPDATE configuracion_inventario
      SET cia = '$cia',
          fecha_gestion = '$fecha',
          actualizado_por = '$usuario',
          actualizado_en = GETDATE()
      WHERE id = (
        SELECT configuracion_id FROM configuracion_inventario_almacenes WHERE id = $id
      )
    ";
    $resCab = mssql_query($queryCab, $conn);
    if (!$resCab) {
      echo json_encode(["success" => false, "error" => "Error al actualizar cabecera: " . mssql_get_last_message()]);
      exit;
    }

    // Actualizar detalle (almacén + conteo)
    $queryDet = "
      UPDATE configuracion_inventario_almacenes
      SET almacen = '$almacen',
          conteo = $conteo
      WHERE id = $id
    ";
    $resDet = mssql_query($queryDet, $conn);
    if (!$resDet) {
      echo json_encode(["success" => false, "error" => "Error al actualizar detalle: " . mssql_get_last_message()]);
      exit;
    }

    echo json_encode(["success" => true, "mensaje" => "Configuración actualizada"]);
    exit;

  default:
    echo json_encode(["success" => false, "error" => "Acción no válida"]);
    exit;
}
?>
