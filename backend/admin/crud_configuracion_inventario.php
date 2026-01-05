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
  SET ANSI_NULLS ON;
  SET QUOTED_IDENTIFIER ON;
  SET CONCAT_NULL_YIELDS_NULL ON;
  SET ANSI_WARNINGS ON;
  SET ANSI_PADDING ON;
  SET ARITHABORT ON;
  SET NUMERIC_ROUNDABORT OFF;

  ;WITH base AS (
    SELECT
        cc.cia,
        cc.almacen,
        cc.tipo_conteo,
        cc.fecha_asignacion,
        cc.nro_conteo,
        LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(cc.usuarios_asignados,'[',''),']',''),'\"',''))) AS ids_txt
    FROM SAP_PROCESOS.dbo.CAP_CONTEO_CONFIG cc
  ),
  split AS (
    SELECT
        b.cia, b.almacen, b.tipo_conteo, b.fecha_asignacion, b.nro_conteo,
        CAST('<i>' + REPLACE(b.ids_txt, ',', '</i><i>') + '</i>' AS XML) AS x
    FROM base b
  ),
  u AS (
    SELECT
        s.cia, s.almacen, s.tipo_conteo, s.fecha_asignacion, s.nro_conteo,
        CAST(t.c.value('.', 'varchar(20)') AS int) AS usuario_id
    FROM split s
    CROSS APPLY s.x.nodes('/i') t(c)
  )
  SELECT
      u.cia,
      u.almacen,
      u.tipo_conteo,
      u.fecha_asignacion,

      conteos = STUFF((
          SELECT DISTINCT ',' + CAST(u2.nro_conteo AS varchar(10))
          FROM u u2
          WHERE u2.cia = u.cia
            AND u2.almacen = u.almacen
            AND u2.tipo_conteo = u.tipo_conteo
            AND u2.fecha_asignacion = u.fecha_asignacion
          FOR XML PATH(''), TYPE
      ).value('.', 'nvarchar(max)'), 1, 1, ''),

      equipo = STUFF((
          SELECT DISTINCT ' | ' + us.empleado + '-' + us.nombre
          FROM u u2
          JOIN SAP_PROCESOS.dbo.usuarios us ON us.id = u2.usuario_id
          WHERE u2.cia = u.cia
            AND u2.almacen = u.almacen
            AND u2.tipo_conteo = u.tipo_conteo
            AND u2.fecha_asignacion = u.fecha_asignacion
          FOR XML PATH(''), TYPE
      ).value('.', 'nvarchar(max)'), 1, 3, '')

  FROM u
  GROUP BY u.cia, u.almacen, u.tipo_conteo, u.fecha_asignacion
  ORDER BY u.fecha_asignacion DESC, u.almacen
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

    // Eliminar cabecera, por ON DELETE CASCADE se eliminan almacenes asociados
    $query = "DELETE FROM configuracion_inventario WHERE id = $id";
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
    $id      = isset($_POST['id']) ? intval($_POST['id']) : 0; // este es el ID del detalle (almacén)
    $cia     = isset($_POST['cia']) ? $_POST['cia'] : null;
    $fecha   = isset($_POST['fecha_gestion']) ? $_POST['fecha_gestion'] : null;
    $almacen = isset($_POST['almacen']) ? $_POST['almacen'] : null;
    $conteo  = isset($_POST['conteo']) ? intval($_POST['conteo']) : 0;
    $usuario = isset($_POST['usuario']) ? $_POST['usuario'] : null;

    if ($id <= 0 || !$cia || !$fecha || !$almacen) {
      echo json_encode(["success" => false, "error" => "Datos incompletos"]);
      exit;
    }

    // Obtener configuracion_id desde el detalle
    $resCfg = mssql_query("SELECT configuracion_id FROM configuracion_inventario_almacenes WHERE id = $id", $conn);
    if (!$resCfg || mssql_num_rows($resCfg) === 0) {
      echo json_encode(["success" => false, "error" => "No se encontró configuración asociada"]);
      exit;
    }
    $rowCfg = mssql_fetch_assoc($resCfg);
    $configId = $rowCfg['configuracion_id'];

    // Actualizar cabecera
    $queryCab = "
      UPDATE configuracion_inventario
      SET cia = '$cia',
          fecha_gestion = '$fecha',
          actualizado_por = '$usuario',
          actualizado_en = GETDATE()
      WHERE id = $configId
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
