<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$input = $_SERVER['REQUEST_METHOD'] === 'POST' ? $_POST : $_GET;

$cia = isset($input['cia']) ? trim($input['cia']) : null;
$almacen = isset($input['almacen']) ? trim($input['almacen']) : null;
$fecha = isset($input['fecha']) ? trim($input['fecha']) : null;
$usuario = isset($input['usuario']) ? trim($input['usuario']) : null;
$proyecto = isset($input['proyecto']) ? trim($input['proyecto']) : null;
$cuenta_em = isset($input['cuenta_em']) ? trim($input['cuenta_em']) : null;
$cuenta_sm = isset($input['cuenta_sm']) ? trim($input['cuenta_sm']) : null;
$comentario_front = isset($input['comentario']) ? trim($input['comentario']) : '';
$items_ajuste_raw = isset($input['items_ajuste']) ? $input['items_ajuste'] : '';

$faltantes = array();

if (!$cia) $faltantes[] = "cia";
if (!$almacen) $faltantes[] = "almacen";
if (!$fecha) $faltantes[] = "fecha";
if (!$usuario) $faltantes[] = "usuario";
if (!$proyecto) $faltantes[] = "proyecto";
if (!$cuenta_em) $faltantes[] = "cuenta_em";
if (!$cuenta_sm) $faltantes[] = "cuenta_sm";

if (count($faltantes) > 0) {
  echo json_encode(array(
    "success" => false,
    "error" => "Faltan parámetros: " . implode(", ", $faltantes),
    "debug" => array(
      "method" => $_SERVER['REQUEST_METHOD'],
      "post" => $_POST,
      "get" => $_GET
    )
  ));
  exit;
}

$items_ajuste = json_decode($items_ajuste_raw, true);

if (!$items_ajuste || !is_array($items_ajuste) || count($items_ajuste) === 0) {
  echo json_encode(array("success" => false, "error" => "No hay artículos con diferencia para cerrar SAP"));
  exit;
}

$server = "192.168.0.174";
$user = "sa";
$pass = "P@ssw0rd";
$db = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  echo json_encode(array("success" => false, "error" => "No se pudo conectar a SQL Server"));
  exit;
}

if (!mssql_select_db($db, $conn)) {
  echo json_encode(array("success" => false, "error" => "No se pudo seleccionar la base de datos"));
  exit;
}

function responder_error($conn, $mensaje)
{
  if ($conn) {
    @mssql_query("ROLLBACK TRANSACTION", $conn);
    @mssql_close($conn);
  }

  echo json_encode(array(
    "success" => false,
    "error" => $mensaje
  ));
  exit;
}

function normalizarCodigo($c)
{
  return str_pad(ltrim(trim($c), '0'), 8, '0', STR_PAD_LEFT);
}

function numero_sql($n)
{
  return str_replace(",", ".", strval(floatval($n)));
}

$cia = str_replace("'", "''", $cia);
$almacen = str_replace("'", "''", $almacen);
$fecha = str_replace("'", "''", $fecha);
$usuario = str_replace("'", "''", $usuario);
$proyecto = str_replace("'", "''", $proyecto);
$cuenta_em = str_replace("'", "''", $cuenta_em);
$cuenta_sm = str_replace("'", "''", $cuenta_sm);
$comentario_front = str_replace("'", "''", substr($comentario_front, 0, 50));

$items = array();

foreach ($items_ajuste as $itFront) {
  $codigoFront = "";

  if (isset($itFront["codigo"])) {
    $codigoFront = trim($itFront["codigo"]);
  } elseif (isset($itFront["ItemCode"])) {
    $codigoFront = trim($itFront["ItemCode"]);
  }

  if ($codigoFront === "") {
    continue;
  }

  $codigo = normalizarCodigo($codigoFront);
  $almacenItem = isset($itFront["almacen"]) ? trim($itFront["almacen"]) : $almacen;

  if ($almacenItem !== $almacen) {
    continue;
  }

  $sap_final = isset($itFront["sap_final"]) ? floatval($itFront["sap_final"]) : 0;
  $conteo_final = isset($itFront["conteo_final"]) ? floatval($itFront["conteo_final"]) : 0;
  $dif = isset($itFront["diferencia"]) ? round(floatval($itFront["diferencia"]), 4) : round($conteo_final - $sap_final, 4);

  if ($dif == 0) {
    continue;
  }

  $items[$codigo] = array(
    "Itemname" => isset($itFront["nombre"]) ? $itFront["nombre"] : "",
    "codebars" => isset($itFront["codebars"]) ? $itFront["codebars"] : "",
    "final" => $conteo_final,
    "sap" => $sap_final,
    "dif" => $dif
  );
}

if (count($items) === 0) {
  responder_error($conn, "No hay artículos con diferencia para cerrar SAP");
}

$qr = mssql_query("
    SELECT MAX(estatus) AS estatus
    FROM CAP_INVENTARIO
    WHERE almacen = '$almacen'
      AND fecha_inv = '$fecha'
      AND cias = '$cia'
", $conn);

if (!$qr) {
  responder_error($conn, mssql_get_last_message());
}

$row = mssql_fetch_assoc($qr);

if (!$row) {
  responder_error($conn, "No se encontró inventario para cerrar");
}

$estatusActual = intval($row['estatus']);

if ($estatusActual < 4) {
  responder_error($conn, "El inventario no está listo para cierre SAP");
}

$qExiste = mssql_query("
    SELECT TOP 1 id_cierre
    FROM CAP_INVENTARIO_CIERRE
    WHERE cia = '$cia'
      AND almacen = '$almacen'
      AND fecha_inventario = '$fecha'
", $conn);

if (!$qExiste) {
  responder_error($conn, mssql_get_last_message());
}

if ($rowExiste = mssql_fetch_assoc($qExiste)) {
  $id_cierre_existente = intval($rowExiste["id_cierre"]);

  $qSync = mssql_query("
        UPDATE CAP_INVENTARIO
        SET estatus = 5
        WHERE almacen = '$almacen'
          AND fecha_inv = '$fecha'
          AND cias = '$cia'
          AND estatus < 5
    ", $conn);

  if (!$qSync) {
    responder_error($conn, mssql_get_last_message());
  }

  echo json_encode(array(
    "success" => true,
    "id_cierre" => $id_cierre_existente,
    "mensaje" => "Este inventario ya tenía cierre generado. Estatus sincronizado a 5."
  ));

  mssql_close($conn);
  exit;
}

$tot_items = count($items);
$tot_dif = 0;
$tot_ajuste = 0;

foreach ($items as $tmp) {
  $difTmp = round(floatval($tmp["dif"]), 4);

  if ($difTmp != 0) {
    $tot_dif++;
    $tot_ajuste += abs($difTmp);
  }
}

$qTran = mssql_query("BEGIN TRANSACTION", $conn);

if (!$qTran) {
  responder_error($conn, mssql_get_last_message());
}

$qInsertCierre = mssql_query("
    INSERT INTO CAP_INVENTARIO_CIERRE
    (
        cia,
        almacen,
        fecha_inventario,
        estatus_cierre,
        total_items,
        total_diferencias,
        total_ajustes_unidades,
        usuario_cierre,
        fecha_cierre
    )
    VALUES
    (
        '$cia',
        '$almacen',
        '$fecha',
        3,
        $tot_items,
        $tot_dif,
        " . numero_sql($tot_ajuste) . ",
        '$usuario',
        GETDATE()
    )
", $conn);

if (!$qInsertCierre) {
  responder_error($conn, mssql_get_last_message());
}

$qrId = mssql_query("SELECT @@IDENTITY AS id_cierre", $conn);

if (!$qrId) {
  responder_error($conn, mssql_get_last_message());
}

$rowId = mssql_fetch_assoc($qrId);
$id_cierre = intval($rowId["id_cierre"]);

if ($id_cierre <= 0) {
  responder_error($conn, "No se pudo obtener el ID del cierre");
}

$qConfig = mssql_query("
    IF EXISTS (
        SELECT 1
        FROM CAP_INVENTARIO_CIERRE_CONFIG
        WHERE cia = '$cia'
          AND almacen = '$almacen'
          AND fecha_inventario = '$fecha'
    )
    BEGIN
        UPDATE CAP_INVENTARIO_CIERRE_CONFIG
        SET id_cierre = $id_cierre,
            proyecto = '$proyecto',
            cuenta_em = '$cuenta_em',
            cuenta_sm = '$cuenta_sm',
            usuario_creacion = '$usuario',
            fecha_creacion = GETDATE()
        WHERE cia = '$cia'
          AND almacen = '$almacen'
          AND fecha_inventario = '$fecha'
    END
    ELSE
    BEGIN
        INSERT INTO CAP_INVENTARIO_CIERRE_CONFIG
        (
            id_cierre,
            cia,
            almacen,
            fecha_inventario,
            proyecto,
            cuenta_em,
            cuenta_sm,
            usuario_creacion,
            fecha_creacion
        )
        VALUES
        (
            $id_cierre,
            '$cia',
            '$almacen',
            '$fecha',
            '$proyecto',
            '$cuenta_em',
            '$cuenta_sm',
            '$usuario',
            GETDATE()
        )
    END
", $conn);

if (!$qConfig) {
  responder_error($conn, mssql_get_last_message());
}

foreach ($items as $codigo => &$it) {
  $codigoSafe = str_replace("'", "''", $codigo);
  $itemNameSafe = str_replace("'", "''", isset($it["Itemname"]) ? $it["Itemname"] : "");
  $codebarsSafe = str_replace("'", "''", isset($it["codebars"]) ? $it["codebars"] : "");

  $dif = round(floatval($it["dif"]), 4);
  $tipo = ($dif > 0) ? "S" : (($dif < 0) ? "F" : null);
  $req = ($dif != 0) ? 1 : 0;
  $conteoFinal = numero_sql($it["final"]);
  $sapFinal = numero_sql($it["sap"]);
  $difSql = numero_sql($dif);

  $tipoSql = $tipo ? "'$tipo'" : "NULL";

  $qDetInsert = mssql_query("
        INSERT INTO CAP_INVENTARIO_CIERRE_DET
        (
            id_cierre,
            cia,
            almacen,
            ItemCode,
            ItemName,
            codebars,
            conteo_final,
            sap_final,
            diferencia_unidades,
            requiere_ajuste_sap,
            tipo_ajuste,
            usuario_captura_final,
            fecha_captura_final,
            origen_datos
        )
        VALUES
        (
            $id_cierre,
            '$cia',
            '$almacen',
            '$codigoSafe',
            '$itemNameSafe',
            '$codebarsSafe',
            $conteoFinal,
            $sapFinal,
            $difSql,
            $req,
            $tipoSql,
            '$usuario',
            GETDATE(),
            'ARTICULOS_CON_DIFERENCIA'
        )
    ", $conn);

  if (!$qDetInsert) {
    responder_error($conn, mssql_get_last_message());
  }

  $qDetId = mssql_query("SELECT @@IDENTITY AS id_cierre_det", $conn);

  if (!$qDetId) {
    responder_error($conn, mssql_get_last_message());
  }

  $rowDet = mssql_fetch_assoc($qDetId);
  $it["id_cierre_det"] = intval($rowDet["id_cierre_det"]);
}

unset($it);

$meses = array(
  1 => 'ENERO',
  2 => 'FEBRERO',
  3 => 'MARZO',
  4 => 'ABRIL',
  5 => 'MAYO',
  6 => 'JUNIO',
  7 => 'JULIO',
  8 => 'AGOSTO',
  9 => 'SEPTIEMBRE',
  10 => 'OCTUBRE',
  11 => 'NOVIEMBRE',
  12 => 'DICIEMBRE'
);

$timeFecha = strtotime($fecha);
$mes = $timeFecha ? $meses[intval(date('n', $timeFecha))] : '';
$anio = $timeFecha ? date('Y', $timeFecha) : '';

foreach ($items as $codigo => $it) {
  $dif = round(floatval($it["dif"]), 4);

  if ($dif == 0) {
    continue;
  }

  $codigoSafe = str_replace("'", "''", $codigo);
  $codebarsSafe = str_replace("'", "''", isset($it["codebars"]) ? $it["codebars"] : "");
  $cantidadAjuste = numero_sql(abs($dif));
  $tipo = ($dif > 0) ? "S" : "F";
  $id_cierre_det = intval($it["id_cierre_det"]);
  $comentario = str_replace("'", "''", $comentario_front . " - " . $mes . " " . $anio . "  EMP: " . $usuario);

  $qAjuste = mssql_query("
        INSERT INTO CAP_INVENTARIO_AJUSTES_SAP
        (
            id_cierre,
            id_cierre_det,
            cia,
            almacen,
            ItemCode,
            codebars,
            cantidad_ajuste,
            tipo_ajuste,
            motivo_ajuste,
            comentarios,
            estado_proceso,
            fecha_creacion,
            usuario_creacion
        )
        VALUES
        (
            $id_cierre,
            $id_cierre_det,
            '$cia',
            '$almacen',
            '$codigoSafe',
            '$codebarsSafe',
            $cantidadAjuste,
            '$tipo',
            'Diferencia inventario físico vs SAP',
            '$comentario',
            1,
            GETDATE(),
            '$usuario'
        )
    ", $conn);

  if (!$qAjuste) {
    responder_error($conn, mssql_get_last_message());
  }
}

$qUpdateInventario = mssql_query("
    UPDATE CAP_INVENTARIO
    SET estatus = 5
    WHERE almacen = '$almacen'
      AND fecha_inv = '$fecha'
      AND cias = '$cia'
", $conn);

if (!$qUpdateInventario) {
  responder_error($conn, mssql_get_last_message());
}

$qSignal = mssql_query("
    INSERT INTO dbo.CAP_SAP_SIGNAL (id_cierre)
    VALUES ($id_cierre)
", $conn);

if (!$qSignal) {
  responder_error($conn, mssql_get_last_message());
}

$qCommit = mssql_query("COMMIT TRANSACTION", $conn);

if (!$qCommit) {
  responder_error($conn, mssql_get_last_message());
}

echo json_encode(array(
  "success" => true,
  "id_cierre" => $id_cierre,
  "mensaje" => "Cierre generado correctamente"
));

mssql_close($conn);
exit;
?>
