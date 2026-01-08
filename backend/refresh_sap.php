<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/* ===============================
   PARÁMETROS
================================ */
$almacen = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;
$fecha   = isset($_GET['fecha'])   ? trim($_GET['fecha'])   : null;
$cia     = isset($_GET['cia'])     ? trim($_GET['cia'])     : null;

if (!$almacen || !$fecha || !$cia) {
    echo json_encode(["success"=>false,"error"=>"Faltan parámetros"]);
    exit;
}

/* ===============================
   CONEXIÓN SQL
================================ */
$conn = mssql_connect("192.168.0.174","sa","P@ssw0rd");
if (!$conn) {
    echo json_encode(["success"=>false,"error"=>"Error de conexión"]);
    exit;
}
mssql_select_db("SAP_PROCESOS",$conn);

/* ===============================
   ALMACENES CSV → ARRAY
================================ */
$almacenes = array_filter(array_map('trim', explode(',', $almacen)));
$listaAlmacenes = "'" . implode("','", array_map('addslashes', $almacenes)) . "'";
$almacen_csv = addslashes(implode(',', $almacenes));
$cia_safe = addslashes($cia);

/* ===============================
   VALIDAR FLAGS
================================ */
$q = mssql_query("
    SELECT COUNT(*) total,
           SUM(CASE WHEN sap_refrescado=1 THEN 1 ELSE 0 END) refrescados
    FROM CAP_INVENTARIO
    WHERE almacen IN ($listaAlmacenes)
      AND fecha_inv='$fecha'
      AND cias='$cia_safe'
", $conn);

$row = mssql_fetch_assoc($q);
if (!$row || $row['total']==0) {
    echo json_encode(["success"=>false,"error"=>"Inventarios no encontrados"]);
    exit;
}

if ($row['refrescados']>0) {
    echo json_encode(["success"=>false,"error"=>"SAP ya fue refrescado"]);
    exit;
}

/* ===============================
   EJECUTAR SP (OBLIGATORIO CONSUMIR)
================================ */
$sp = mssql_query("
    EXEC dbo.USP_INVEN_SAP_MULTI
        @almacen = '$almacen_csv',
        @fecint  = '$fecha',
        @cia     = '$cia_safe'
", $conn);

if (!$sp) {
    echo json_encode(["success"=>false,"error"=>"Error al ejecutar SP"]);
    exit;
}

/* 🔥 CLAVE: CONSUMIR RESULTSET */
while (mssql_fetch_assoc($sp)) { /* no hacer nada */ }
mssql_free_result($sp);

/* ===============================
   MARCAR FLAG
================================ */
mssql_query("
    UPDATE CAP_INVENTARIO
    SET sap_refrescado = 1
    WHERE almacen IN ($listaAlmacenes)
      AND fecha_inv='$fecha'
      AND cias='$cia_safe'
", $conn);

/* ===============================
   RESPUESTA
================================ */
echo json_encode([
    "success"=>true,
    "mensaje"=>"Datos SAP refrescados correctamente"
]);
exit;
