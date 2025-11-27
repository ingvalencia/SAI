<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

/* ============================================================
   PARÁMETROS
============================================================ */
$almacen = $_POST['almacen'] ?? null;
$fecha   = $_POST['fecha'] ?? null;
$empleado= $_POST['empleado'] ?? null;
$cia     = $_POST['cia'] ?? null;
$estatus = isset($_POST['estatus']) ? intval($_POST['estatus']) : 1;
$datos   = isset($_POST['datos']) ? json_decode($_POST['datos'], true) : [];

if (!$almacen || !$fecha || !$empleado || !$cia) {
  echo json_encode(["success"=>false,"error"=>"Faltan parámetros"]);
  exit;
}

/* ============================================================
   CONEXIÓN SQL
============================================================ */
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


/* ============================================================
   DETECTAR SI ES BRIGADA
============================================================ */
$alm_safe = addslashes($almacen);
$cia_safe = addslashes($cia);

$sqlBrig = "
  SELECT TOP 1 tipo_conteo
  FROM CAP_CONTEO_CONFIG
  WHERE almacen='$alm_safe'
    AND cia='$cia_safe'
    AND estatus=0
";
$resBrig = mssql_query($sqlBrig,$conn);

$esBrigada = false;
if ($resBrig && $r = mssql_fetch_assoc($resBrig)) {
    if (strtolower($r['tipo_conteo']) === 'brigada') {
        $esBrigada = true;
    }
}


/* ============================================================
   GUARDAR CONTEO (UPDATE/INSERT)
============================================================ */
foreach ($datos as $d) {
  $id_inv = isset($d['id']) ? intval($d['id']) : 0;
  $cant   = isset($d['cant_invfis']) ? floatval($d['cant_invfis']) : 0;

  if ($id_inv <= 0) continue;

  // verificar si ya existe conteo
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
  }
  else {
      mssql_query("
        INSERT INTO CAP_INVENTARIO_CONTEOS(id_inventario,nro_conteo,cantidad,usuario,fecha,estatus)
        VALUES($id_inv,$estatus,$cant,'$empleado',GETDATE(),1)
      ",$conn);
  }

  // actualizar tabla base
  mssql_query("
      UPDATE CAP_INVENTARIO
      SET cant_invfis=$cant
      WHERE id=$id_inv
  ",$conn);
}


/* ============================================================
   SI ES BRIGADA → NO AVANZA AUTOMÁTICO
============================================================ */
if ($esBrigada === true) {

    // NO se debe modificar el estatus global
    // NO se debe generar conteo 2
    // NO se debe generar conteo 3
    // NO se debe cerrar proceso
    // eso se hace SOLO desde asignar_tercer_conteo.php y confirmar_inventario

    echo json_encode([
        "success"   => true,
        "mensaje"   => "Conteo guardado (brigada). El proceso no avanza automáticamente.",
        "next_status" => $estatus,
        "hay_diferencias" => false
    ]);
    exit;
}


/* ============================================================
   INDIVIDUAL: verificar diferencias para avanzar
============================================================ */
$url="https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/comparar_inventarios.php?almacen=$almacen&fecha=$fecha&usuario=$empleado&cia=$cia";
$resp=@file_get_contents($url);
$res=json_decode($resp,true);

$hay_diferencias=false;
if($res && isset($res['hay_diferencias_brigada'])){
    // en individual no hay brigada, tomamos dif mio vs sap
    $hay_diferencias = ($res['hay_dif_mio_vs_sap'] === true);
}

/* ============================================================
   FLUJO INDIVIDUAL
============================================================ */

$next_status=$estatus;
$mensaje_final="";

if($hay_diferencias){

  if($estatus < 3){
    $next_status = $estatus + 1;

    mssql_query("
      UPDATE CAP_INVENTARIO
      SET estatus=$next_status
      WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario='$empleado'
    ",$conn);

    // crear registros base para el nuevo conteo
    $q = mssql_query("
        SELECT id
        FROM CAP_INVENTARIO
        WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario='$empleado'
    ",$conn);

    while($r = mssql_fetch_assoc($q)){
      $id_inv = intval($r['id']);
      mssql_query("
        INSERT INTO CAP_INVENTARIO_CONTEOS(id_inventario,nro_conteo,cantidad,usuario,fecha,estatus)
        VALUES($id_inv,$next_status,0,'$empleado',GETDATE(),1)
      ",$conn);
    }

    $mensaje_final = "Diferencias detectadas. Preparado conteo $next_status.";
  }
  else {
    // estatus = 3 con diferencias → cerrar
    mssql_query("
      UPDATE CAP_INVENTARIO
      SET estatus=4
      WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario='$empleado'
    ",$conn);

    $next_status=4;
    $mensaje_final="Conteo 3 terminado. Proceso cerrado (con diferencias).";
  }

} else {

  // Sin diferencias → cerrar proceso
  mssql_query("
    UPDATE CAP_INVENTARIO
    SET estatus=4
    WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario='$empleado'
  ",$conn);

  $next_status=4;
  $mensaje_final="Sin diferencias. Proceso completado.";
}


/* ============================================================
   RESPUESTA FINAL
============================================================ */
echo json_encode([
  "success"=>true,
  "mensaje"=>$mensaje_final,
  "next_status"=>$next_status,
  "hay_diferencias"=>$hay_diferencias
]);
exit;
?>
