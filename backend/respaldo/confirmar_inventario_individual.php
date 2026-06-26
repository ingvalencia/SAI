<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$almacen  = isset($_POST['almacen']) ? $_POST['almacen'] : null;
$fecha    = isset($_POST['fecha']) ? $_POST['fecha'] : null;
$empleado = isset($_POST['empleado']) ? $_POST['empleado'] : null;
$estatus  = isset($_POST['estatus']) ? intval($_POST['estatus']) : 0;
$cia      = isset($_POST['cia']) ? $_POST['cia'] : null;
$datosRaw = isset($_POST['datos']) ? $_POST['datos'] : '[]';

if (!$almacen || !$fecha || !$empleado || !$estatus || !$cia) {
    echo json_encode([
        "success" => false,
        "error" => "Faltan parámetros"
    ]);
    exit;
}

$datos = json_decode($datosRaw, true);
if (!is_array($datos)) {
    echo json_encode([
        "success" => false,
        "error" => "Datos inválidos"
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
        "success" => false,
        "error" => "No se pudo conectar a la base de datos"
    ]);
    exit;
}
mssql_select_db($db, $conn);

$almacen = addslashes($almacen);
$fecha   = addslashes($fecha);
$cia     = addslashes($cia);
$empleado = intval($empleado);
$estatus  = intval($estatus);

$sqlBrig = "
    SELECT TOP 1 tipo_conteo
    FROM CAP_CONTEO_CONFIG
    WHERE almacen='$almacen'
      AND cia='$cia'
      AND estatus IN (0,1)
      AND usuarios_asignados LIKE '%$empleado%'
";
$resBrig = mssql_query($sqlBrig, $conn);

$esBrigada = false;
if ($resBrig && $r = mssql_fetch_assoc($resBrig)) {
    if (strtolower($r['tipo_conteo']) === 'brigada') {
        $esBrigada = true;
    }
}

foreach ($datos as $d) {

    $id_inv = 0;
    if (isset($d['id'])) {
        $id_inv = intval($d['id']);
    } elseif (isset($d['id_inventario'])) {
        $id_inv = intval($d['id_inventario']);
    }

    $cant = isset($d['cant_invfis']) ? floatval($d['cant_invfis']) : 0;

    if ($id_inv <= 0) continue;

    $chk = mssql_query("
        SELECT COUNT(*) AS n
        FROM CAP_INVENTARIO_CONTEOS
        WHERE id_inventario=$id_inv AND nro_conteo=$estatus
    ", $conn);

    $row = mssql_fetch_assoc($chk);

    if (intval($row['n']) > 0) {
        mssql_query("
            UPDATE CAP_INVENTARIO_CONTEOS
            SET cantidad=$cant,
                fecha=GETDATE(),
                usuario='$empleado'
            WHERE id_inventario=$id_inv AND nro_conteo=$estatus
        ", $conn);
    } else {
        mssql_query("
            INSERT INTO CAP_INVENTARIO_CONTEOS(id_inventario,nro_conteo,cantidad,usuario,fecha,estatus)
            VALUES($id_inv,$estatus,$cant,'$empleado',GETDATE(),1)
        ", $conn);
    }
}

if ($esBrigada) {
    echo json_encode([
        "success" => true,
        "mensaje" => "Conteo guardado (brigada). El proceso no avanza automáticamente.",
        "next_status" => $estatus,
        "hay_diferencias" => false
    ]);
    exit;
}

mssql_query("
    UPDATE CAP_INVENTARIO
    SET estatus=$estatus
    WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
", $conn);

$hay_diferencias = false;

$sqlComp = "
SELECT
    c.id,
    ISNULL(MAX(CASE WHEN ct.nro_conteo=1 THEN ct.cantidad END),0) AS c1,
    ISNULL(MAX(CASE WHEN ct.nro_conteo=2 THEN ct.cantidad END),0) AS c2,
    ISNULL(MAX(CASE WHEN ct.nro_conteo=3 THEN ct.cantidad END),0) AS c3,
    ISNULL(MAX(CASE WHEN ct.nro_conteo=7 THEN ct.cantidad END),0) AS c4
FROM CAP_INVENTARIO c
LEFT JOIN CAP_INVENTARIO_CONTEOS ct ON c.id=ct.id_inventario
WHERE c.almacen='$almacen'
  AND c.fecha_inv='$fecha'
  AND c.usuario=$empleado
GROUP BY c.id
";

$resComp = mssql_query($sqlComp, $conn);

while ($r = mssql_fetch_assoc($resComp)) {

    $c1 = floatval($r['c1']);
    $c2 = floatval($r['c2']);
    $c3 = floatval($r['c3']);
    $c4 = floatval($r['c4']);

    if ($estatus == 2 && round($c1, 2) != round($c2, 2)) {
        $hay_diferencias = true;
    }

    if ($estatus == 3 && round($c2, 2) != round($c3, 2)) {
        $hay_diferencias = true;
    }

    if ($estatus == 7 && round($c3, 2) != round($c4, 2)) {
        $hay_diferencias = true;
    }
}

$next_status = $estatus;
$mensaje_final = "";

if ($estatus == 1) {

    $next_status = 2;

    mssql_query("
        UPDATE CAP_INVENTARIO
        SET estatus=2
        WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
    ", $conn);

    $q = mssql_query("
        SELECT id
        FROM CAP_INVENTARIO
        WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
    ", $conn);

    while ($r = mssql_fetch_assoc($q)) {
        $id_inv = intval($r['id']);

        $chk2 = mssql_query("
            SELECT COUNT(*) AS n
            FROM CAP_INVENTARIO_CONTEOS
            WHERE id_inventario=$id_inv AND nro_conteo=2
        ", $conn);
        $row2 = mssql_fetch_assoc($chk2);

        if (intval($row2['n']) == 0) {
            mssql_query("
                INSERT INTO CAP_INVENTARIO_CONTEOS(id_inventario,nro_conteo,cantidad,usuario,fecha,estatus)
                VALUES($id_inv,2,0,'$empleado',GETDATE(),1)
            ", $conn);
        }
    }

    $mensaje_final = "Primer conteo confirmado. Se ha preparado el Conteo 2.";

} elseif ($estatus == 2) {

    if ($hay_diferencias) {

        $next_status = 3;

        mssql_query("
            UPDATE CAP_INVENTARIO
            SET estatus=3
            WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
        ", $conn);

        $q = mssql_query("
            SELECT id
            FROM CAP_INVENTARIO
            WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
        ", $conn);

        while ($r = mssql_fetch_assoc($q)) {
            $id_inv = intval($r['id']);

            $chk3 = mssql_query("
                SELECT COUNT(*) AS n
                FROM CAP_INVENTARIO_CONTEOS
                WHERE id_inventario=$id_inv AND nro_conteo=3
            ", $conn);
            $row3 = mssql_fetch_assoc($chk3);

            if (intval($row3['n']) == 0) {
                mssql_query("
                    INSERT INTO CAP_INVENTARIO_CONTEOS(id_inventario,nro_conteo,cantidad,usuario,fecha,estatus)
                    VALUES($id_inv,3,0,'$empleado',GETDATE(),1)
                ", $conn);
            }
        }

        $mensaje_final = "Se detectaron diferencias entre conteo 1 y 2. Se ha preparado el Conteo 3.";

    } else {

        $next_status = 4;

        mssql_query("
            UPDATE CAP_INVENTARIO
            SET estatus=4
            WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
        ", $conn);

        $mensaje_final = "Conteos 1 y 2 coinciden. Proceso completado.";
    }

} elseif ($estatus == 3) {

    $next_status = 4;

    mssql_query("
        UPDATE CAP_INVENTARIO
        SET estatus=4
        WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
    ", $conn);

    $mensaje_final = $hay_diferencias
        ? "Tercer conteo confirmado con diferencias. Proceso cerrado."
        : "Tercer conteo confirmado sin diferencias. Proceso completado.";

} elseif ($estatus == 7) {

    $next_status = 4;

    mssql_query("
        UPDATE CAP_INVENTARIO
        SET estatus=4
        WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
    ", $conn);

    $mensaje_final = $hay_diferencias
        ? "Cuarto conteo confirmado con diferencias. Proceso cerrado."
        : "Cuarto conteo confirmado sin diferencias. Proceso completado.";

} else {

    $next_status = $estatus;
    $mensaje_final = "Estatus no válido para confirmación.";
}

echo json_encode([
    "success" => true,
    "mensaje" => $mensaje_final,
    "next_status" => $next_status,
    "hay_diferencias" => $hay_diferencias
]);
exit;
?>
