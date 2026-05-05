<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$cia     = isset($_GET['cia'])     ? trim($_GET['cia'])     : null;
$almacen = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;
$fecha   = isset($_GET['fecha'])   ? trim($_GET['fecha'])   : null;
$usuario = isset($_GET['usuario']) ? trim($_GET['usuario']) : null;

$proyecto = isset($_GET['proyecto']) ? trim($_GET['proyecto']) : null;
$cuenta_em = isset($_GET['cuenta_em']) ? trim($_GET['cuenta_em']) : null;
$cuenta_sm = isset($_GET['cuenta_sm']) ? trim($_GET['cuenta_sm']) : null;
$comentario_front = isset($_GET['comentario']) ? trim($_GET['comentario']) : '';

if (!$cia || !$almacen || !$fecha || !$usuario || !$proyecto || !$cuenta_em || !$cuenta_sm) {
    echo json_encode(array("success" => false, "error" => "Faltan parámetros"));
    exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
    echo json_encode(array("success" => false, "error" => "No se pudo conectar a SQL Server"));
    exit;
}

if (!mssql_select_db($db, $conn)) {
    echo json_encode(array("success" => false, "error" => "No se pudo seleccionar la base de datos"));
    exit;
}

$cia = str_replace("'", "''", $cia);
$almacen = str_replace("'", "''", $almacen);
$fecha = str_replace("'", "''", $fecha);
$usuario = str_replace("'", "''", $usuario);
$proyecto = str_replace("'", "''", $proyecto);
$cuenta_em = str_replace("'", "''", $cuenta_em);
$cuenta_sm = str_replace("'", "''", $cuenta_sm);
$comentario_front = str_replace("'", "''", substr($comentario_front, 0, 50));

function responder_error($conn, $mensaje) {
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

function obtener_ultimo_conteo($sap, $c1, $c2, $c3, $c4) {
    $sap = floatval($sap);
    $c1 = floatval($c1);
    $c2 = floatval($c2);
    $c3 = floatval($c3);
    $c4 = floatval($c4);

    $debeIrAC3 =
        ($c1 != $c2) ||
        ($c1 == $sap && $c2 != $sap) ||
        ($c2 == $sap && $c1 != $sap) ||
        ($c1 == $c2 && $c1 != $sap);

    if (!$debeIrAC3) {
        return $c2;
    }

    $casoEspecialSapCeroConExistencia = ($sap == 0 && $c1 > 0 && $c2 > 0 && $c3 > 0);
    $c3EsIgualAC1YC2PeroDistintoASap = ($c3 == $c1 && $c3 == $c2 && $c3 != $sap);
    $c3EsIgualASap = ($c3 == $sap);
    $c3EsCeroIgualASap = ($c3 == 0 && $sap == 0);

    $debeIrAC4 =
        $casoEspecialSapCeroConExistencia ||
        $c3EsIgualAC1YC2PeroDistintoASap ||
        (!$c3EsIgualASap && !$c3EsCeroIgualASap);

    if (!$debeIrAC4) {
        return $c3;
    }

    $c4EsCeroIgualASap = ($c4 == 0 && $sap == 0);

    if ($c4EsCeroIgualASap) {
        return $c4;
    }

    return $c4;
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

$qUser = mssql_query("
    SELECT TOP 1 usuario
    FROM CAP_INVENTARIO
    WHERE almacen = '$almacen'
      AND fecha_inv = '$fecha'
      AND cias = '$cia'
    ORDER BY id DESC
", $conn);

if (!$qUser) {
    responder_error($conn, mssql_get_last_message());
}

$rowUser = mssql_fetch_assoc($qUser);
$usuarioInventario = $rowUser ? str_replace("'", "''", $rowUser['usuario']) : null;

if (!$usuarioInventario) {
    responder_error($conn, "No se encontró usuario propietario del inventario");
}

$sp = mssql_query("EXEC USP_INVEN_SAP '$almacen', '$fecha', '$usuarioInventario', '$cia'", $conn);

if (!$sp) {
    responder_error($conn, "Error al consultar SAP (USP_INVEN_SAP): " . mssql_get_last_message());
}

$sap = array();

while ($r = mssql_fetch_assoc($sp)) {
    $codigo = trim($r['Codigo sap']);
    $sap[$codigo] = floatval($r['Inventario_sap']);
}

$q = mssql_query("
    SELECT
        c.ItemCode,
        MAX(c.Itemname) AS Itemname,
        MAX(c.codebars) AS codebars,
        MAX(CASE WHEN ct.nro_conteo = 1 THEN ct.cantidad ELSE NULL END) AS conteo1,
        MAX(CASE WHEN ct.nro_conteo = 2 THEN ct.cantidad ELSE NULL END) AS conteo2,
        MAX(CASE WHEN ct.nro_conteo = 3 THEN ct.cantidad ELSE NULL END) AS conteo3,
        MAX(CASE WHEN ct.nro_conteo = 4 THEN ct.cantidad ELSE NULL END) AS conteo4
    FROM CAP_INVENTARIO c
    LEFT JOIN CAP_INVENTARIO_CONTEOS ct
        ON c.id = ct.id_inventario
    WHERE c.almacen = '$almacen'
      AND c.fecha_inv = '$fecha'
      AND c.cias = '$cia'
    GROUP BY c.ItemCode
", $conn);

if (!$q) {
    responder_error($conn, mssql_get_last_message());
}

$items = array();

while ($r = mssql_fetch_assoc($q)) {
    $codigo = trim($r['ItemCode']);

    $sap_final = isset($sap[$codigo]) ? floatval($sap[$codigo]) : 0;
    $conteo1 = isset($r['conteo1']) ? floatval($r['conteo1']) : 0;
    $conteo2 = isset($r['conteo2']) ? floatval($r['conteo2']) : 0;
    $conteo3 = isset($r['conteo3']) ? floatval($r['conteo3']) : 0;
    $conteo4 = isset($r['conteo4']) ? floatval($r['conteo4']) : 0;
    $conteo_final = obtener_ultimo_conteo($sap_final, $conteo1, $conteo2, $conteo3, $conteo4);
    $dif = $conteo_final - $sap_final;

    $items[$codigo] = array(
        "Itemname" => $r["Itemname"],
        "codebars" => $r["codebars"],
        "conteo1" => $conteo1,
        "conteo2" => $conteo2,
        "conteo3" => $conteo3,
        "conteo4" => $conteo4,
        "final" => $conteo_final,
        "sap" => $sap_final,
        "dif" => $dif
    );
}

if (count($items) === 0) {
    responder_error($conn, "No se encontraron artículos para generar cierre");
}

$tot_items = count($items);
$tot_dif = 0;
$tot_ajuste = 0;

foreach ($items as $tmp) {
    if (floatval($tmp["dif"]) != 0) {
        $tot_dif++;
    }

    $tot_ajuste += abs(floatval($tmp["dif"]));
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
        $tot_ajuste,
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
    $itemNameSafe = str_replace("'", "''", $it["Itemname"]);
    $codebarsSafe = str_replace("'", "''", $it["codebars"]);

    $dif = floatval($it["dif"]);
    $tipo = ($dif > 0) ? "E" : (($dif < 0) ? "S" : null);
    $req = ($dif != 0) ? 1 : 0;
    $conteoFinal = floatval($it["final"]);
    $sapFinal = floatval($it["sap"]);

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
            $dif,
            $req,
            $tipoSql,
            '$usuario',
            GETDATE(),
            'CONTEOS'
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
    if (floatval($it["dif"]) == 0) {
        continue;
    }

    $codigoSafe = str_replace("'", "''", $codigo);
    $codebarsSafe = str_replace("'", "''", $it["codebars"]);
    $dif = floatval($it["dif"]);
    $tipo = ($dif > 0) ? "E" : "S";
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
            $dif,
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
