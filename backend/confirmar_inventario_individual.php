<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$almacen = isset($_POST['almacen']) ? $_POST['almacen'] : null;
$fecha   = isset($_POST['fecha'])   ? $_POST['fecha']   : null;
$empleado= isset($_POST['empleado'])? $_POST['empleado']: null;
$cia     = isset($_POST['cia'])     ? $_POST['cia']     : null;
$estatus = isset($_POST['estatus']) ? intval($_POST['estatus']) : 1;
$datos   = isset($_POST['datos'])   ? json_decode($_POST['datos'], true) : [];

if (!$almacen || !$fecha || !$empleado || !$cia) {
    echo json_encode(["success"=>false,"error"=>"Faltan parámetros"]);
    exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
    echo json_encode(["success"=>false,"error"=>"Error de conexión"]);
    exit;
}
mssql_select_db($db,$conn);

foreach ($datos as $d) {

    $id_inv = isset($d['id']) ? intval($d['id']) : 0;
    $cant   = isset($d['cant_invfis']) ? floatval($d['cant_invfis']) : 0;

    if ($id_inv <= 0) continue;

    $chk = mssql_query("
        SELECT COUNT(*) AS n
        FROM CAP_INVENTARIO_CONTEOS
        WHERE id_inventario=$id_inv AND nro_conteo=$estatus
    ",$conn);

    $row = mssql_fetch_assoc($chk);

    if (intval($row['n']) > 0) {
        mssql_query("
            UPDATE CAP_INVENTARIO_CONTEOS
            SET cantidad=$cant,
                fecha=GETDATE(),
                usuario='$empleado'
            WHERE id_inventario=$id_inv AND nro_conteo=$estatus
        ",$conn);
    } else {
        mssql_query("
            INSERT INTO CAP_INVENTARIO_CONTEOS(id_inventario,nro_conteo,cantidad,usuario,fecha,estatus)
            VALUES($id_inv,$estatus,$cant,'$empleado',GETDATE(),1)
        ",$conn);
    }
}

mssql_query("
    UPDATE CAP_INVENTARIO
    SET estatus=$estatus
    WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
",$conn);

$hay_diferencias = false;

$sqlComp = "
SELECT
    c.id,
    ISNULL(MAX(CASE WHEN ct.nro_conteo=1 THEN ct.cantidad END),0) AS c1,
    ISNULL(MAX(CASE WHEN ct.nro_conteo=2 THEN ct.cantidad END),0) AS c2,
    ISNULL(MAX(CASE WHEN ct.nro_conteo=3 THEN ct.cantidad END),0) AS c3,
    ISNULL(MAX(CASE WHEN ct.nro_conteo=7 THEN ct.cantidad END),0) AS c4,
    ISNULL(c.cant_sap,0) AS sap
FROM CAP_INVENTARIO c
LEFT JOIN CAP_INVENTARIO_CONTEOS ct ON c.id=ct.id_inventario
WHERE c.almacen='$almacen'
  AND c.fecha_inv='$fecha'
  AND c.usuario=$empleado
GROUP BY c.id,c.cant_sap
";

$resComp = mssql_query($sqlComp,$conn);

while($r = mssql_fetch_assoc($resComp)) {

    $c1 = floatval($r['c1']);
    $c2 = floatval($r['c2']);
    $c3 = floatval($r['c3']);
    $c4 = floatval($r['c4']);
    $sap= floatval($r['sap']);

    if ($estatus == 2 && $c1 != $c2) $hay_diferencias = true;
    if ($estatus == 3 && $c2 != $c3) $hay_diferencias = true;
    if ($estatus == 7 && $c3 != $c4) $hay_diferencias = true;

    if ($estatus >= 1 && $estatus <= 7) {
        $conteoActual = 0;
        if ($estatus == 1) $conteoActual = $c1;
        if ($estatus == 2) $conteoActual = $c2;
        if ($estatus == 3) $conteoActual = $c3;
        if ($estatus == 7) $conteoActual = $c4;
        if ($conteoActual != $sap) $hay_diferencias = true;
    }
}

$next_status = $estatus;
$mensaje_final = "";

if ($hay_diferencias) {

    if ($estatus < 3) {

        $next_status = $estatus + 1;

        mssql_query("
            UPDATE CAP_INVENTARIO
            SET estatus=$next_status
            WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
        ",$conn);

        $q = mssql_query("
            SELECT id
            FROM CAP_INVENTARIO
            WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
        ",$conn);

        while($r = mssql_fetch_assoc($q)) {
            $id_inv = intval($r['id']);
            mssql_query("
                INSERT INTO CAP_INVENTARIO_CONTEOS(id_inventario,nro_conteo,cantidad,usuario,fecha,estatus)
                VALUES($id_inv,$next_status,0,'$empleado',GETDATE(),1)
            ",$conn);
        }

        $mensaje_final = "Se detectaron diferencias. Se ha preparado el Conteo $next_status.";

    } else {

        mssql_query("
            UPDATE CAP_INVENTARIO
            SET estatus=4
            WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
        ",$conn);

        $next_status = 4;
        $mensaje_final = "Conteo finalizado con diferencias. Proceso cerrado.";
    }

} else {

    mssql_query("
        UPDATE CAP_INVENTARIO
        SET estatus=4
        WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario=$empleado
    ",$conn);

    $next_status = 4;
    $mensaje_final = "No se encontraron diferencias. Proceso completado.";
}

echo json_encode([
    "success"=>true,
    "mensaje"=>$mensaje_final,
    "next_status"=>$next_status,
    "hay_diferencias"=>$hay_diferencias
]);
exit;
?>
