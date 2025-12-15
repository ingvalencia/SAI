<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/* ===============================
   PARAMETROS
================================= */

$cia     = isset($_GET['cia'])     ? trim($_GET['cia'])     : null;
$almacen = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;
$fecha   = isset($_GET['fecha'])   ? trim($_GET['fecha'])   : null;
$usuario = isset($_GET['usuario']) ? trim($_GET['usuario']) : null;

if (!$cia || !$almacen || !$fecha || !$usuario) {
    echo json_encode(array("success" => false, "error" => "Faltan parámetros"));
    exit;
}

/* ===============================
   CONEXIÓN SQL SERVER
================================= */

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
    echo json_encode(array("success" => false, "error" => "No se pudo conectar a SQL Server"));
    exit;
}
mssql_select_db($db, $conn);

/* ===============================
   1. VALIDAR ESTATUS = 4
================================= */

$qr = mssql_query("
    SELECT TOP 1 estatus
    FROM CAP_INVENTARIO
    WHERE almacen = '$almacen'
      AND fecha_inv = '$fecha'
      AND cias = '$cia'
", $conn);

$row = mssql_fetch_assoc($qr);

if (!$row || intval($row['estatus']) !== 4) {
    echo json_encode(array("success" => false, "error" => "El inventario no está finalizado (estatus != 4)."));
    exit;
}

/* ===============================
   2. USUARIO REAL DEL INVENTARIO
================================= */

$qUser = mssql_query("
    SELECT TOP 1 usuario
    FROM CAP_INVENTARIO
    WHERE almacen = '$almacen'
      AND fecha_inv = '$fecha'
      AND cias = '$cia'
", $conn);

$rowUser = mssql_fetch_assoc($qUser);
$usuarioInventario = $rowUser ? $rowUser['usuario'] : null;

if (!$usuarioInventario) {
    echo json_encode(array("success" => false, "error" => "No se encontró usuario propietario del inventario"));
    exit;
}

/* ===============================
   3. CARGAR SAP VIA SP
================================= */

$sp = mssql_query("EXEC USP_INVEN_SAP '$almacen', '$fecha', '$usuarioInventario', '$cia'", $conn);

if (!$sp) {
    echo json_encode(array("success" => false, "error" => "Error al consultar SAP (USP_INVEN_SAP)"));
    exit;
}

$sap = array();
while ($r = mssql_fetch_assoc($sp)) {
    $codigo = trim($r['Codigo sap']);
    $sap[$codigo] = floatval($r['Inventario_sap']);
}

/* ===============================
   4. LEER CONTEO FINAL
================================= */

$q = mssql_query("
  SELECT
      c.id,
      c.ItemCode,
      c.almacen,
      c.cias,
      c.Itemname,
      c.codebars,
      ct.nro_conteo,
      ct.cantidad
  FROM CAP_INVENTARIO c
  LEFT JOIN CAP_INVENTARIO_CONTEOS ct ON c.id = ct.id_inventario
  WHERE c.almacen = '$almacen'
    AND c.fecha_inv = '$fecha'
    AND c.cias = '$cia'
", $conn);

$items = array();

while ($r = mssql_fetch_assoc($q)) {

    $codigo = trim($r['ItemCode']);

    if (!isset($items[$codigo])) {
        $items[$codigo] = array(
            "id_inventario" => $r["id"],
            "Itemname"      => $r["Itemname"],
            "codebars"      => $r["codebars"],
            "final"         => 0
        );
    }

    if ($r['nro_conteo'] !== null) {
        $items[$codigo]["final"] = floatval($r['cantidad']);
    }
}

/* ===============================
   5. CALCULAR DIFERENCIA
================================= */

foreach ($items as $codigo => &$it) {

    $it["sap"] = isset($sap[$codigo]) ? $sap[$codigo] : 0;

    $it["dif"] = $it["final"] - $it["sap"];
}
unset($it);

/* ===============================
   6. INSERTAR ENCABEZADO CIERRE
================================= */

$tot_items = count($items);

$tot_dif = 0;
foreach ($items as $tmp) {
    if ($tmp["dif"] != 0) $tot_dif++;
}

$tot_ajuste = 0;
foreach ($items as $tmp) {
    $tot_ajuste += abs($tmp["dif"]);
}

mssql_query("
  INSERT INTO CAP_INVENTARIO_CIERRE
  (cia, almacen, fecha_inventario, estatus_cierre, total_items, total_diferencias,
   total_ajustes_unidades, usuario_cierre, fecha_cierre)
  VALUES
  ('$cia', '$almacen', '$fecha', 2, $tot_items, $tot_dif, $tot_ajuste, '$usuario', GETDATE())
", $conn);

$qr  = mssql_query("SELECT @@IDENTITY AS id", $conn);
$row = mssql_fetch_assoc($qr);
$id_cierre = intval($row["id"]);

/* ===============================
   7. INSERTAR DETALLE + OBTENER id_cierre_det
================================= */

foreach ($items as $codigo => &$it) {

    $dif  = $it["dif"];
    $tipo = ($dif > 0) ? "E" : (($dif < 0) ? "S" : null);
    $req  = ($dif != 0) ? 1 : 0;

    mssql_query("
      INSERT INTO CAP_INVENTARIO_CIERRE_DET
      (id_cierre, cia, almacen, ItemCode, ItemName, codebars,
       conteo_final, sap_final, diferencia_unidades,
       requiere_ajuste_sap, tipo_ajuste,
       usuario_captura_final, fecha_captura_final, origen_datos)
      VALUES
      (
         $id_cierre,
         '$cia',
         '$almacen',
         '$codigo',
         '".str_replace("'", "''", $it["Itemname"])."',
         '".str_replace("'", "''", $it["codebars"])."',
         {$it["final"]},
         {$it["sap"]},
         $dif,
         $req,
         ".($tipo ? "'$tipo'" : "NULL").",
         '$usuario',
         GETDATE(),
         'CONTEOS'
      )
    ", $conn);

    // CAPTURAR EL ID DEL DETALLE
    $qDet = mssql_query("SELECT @@IDENTITY AS id", $conn);
    $rowDet = mssql_fetch_assoc($qDet);
    $it["id_cierre_det"] = intval($rowDet["id"]);
}

unset($it);

/* ===============================
   8. INSERTAR AJUSTES SAP (solo dif != 0)
================================= */

foreach ($items as $codigo => $it) {

    if ($it["dif"] == 0) continue;

    $tipo = ($it["dif"] > 0) ? "E" : "S";

    mssql_query("
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
        {$it["id_cierre_det"]},
        '$cia',
        '$almacen',
        '$codigo',
        '".str_replace("'", "''", $it["codebars"])."',
        {$it["dif"]},
        '$tipo',
        'Diferencia inventario físico vs SAP',
        'Generado automáticamente por cierre de inventario',
        0,
        GETDATE(),
        '$usuario'
      )
    ", $conn);
}

/* ===============================
   9. BLOQUEAR INVENTARIO
================================= */

mssql_query("
  UPDATE CAP_INVENTARIO
  SET estatus = 5
  WHERE almacen = '$almacen'
    AND fecha_inv = '$fecha'
    AND cias = '$cia'
", $conn);

/* ===============================
   10. RESPUESTA FINAL
================================= */

echo json_encode(array(
    "success"   => true,
    "id_cierre" => $id_cierre,
    "mensaje"   => "Cierre generado correctamente"
));

exit;
?>
