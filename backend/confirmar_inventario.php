<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

$almacen = isset($_POST['almacen']) ? $_POST['almacen'] : null;
$fecha   = isset($_POST['fecha']) ? $_POST['fecha'] : null;
$empleado= isset($_POST['empleado']) ? $_POST['empleado'] : null;
$cia     = isset($_POST['cia']) ? $_POST['cia'] : null;
$estatus = isset($_POST['estatus']) ? intval($_POST['estatus']) : 1;
$datos   = isset($_POST['datos']) ? json_decode($_POST['datos'], true) : [];

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

  if ($id_inv>0) {
    $chk = mssql_query("SELECT COUNT(*) AS n FROM CAP_INVENTARIO_CONTEOS WHERE id_inventario=$id_inv AND nro_conteo=$estatus",$conn);
    $row = mssql_fetch_assoc($chk);
    if (intval($row['n'])>0) {
      mssql_query("UPDATE CAP_INVENTARIO_CONTEOS SET cantidad=$cant, fecha=GETDATE(), usuario='$empleado' WHERE id_inventario=$id_inv AND nro_conteo=$estatus",$conn);
    } else {
      mssql_query("INSERT INTO CAP_INVENTARIO_CONTEOS(id_inventario,nro_conteo,cantidad,usuario,fecha,estatus) VALUES($id_inv,$estatus,$cant,'$empleado',GETDATE(),1)",$conn);
    }
  }
}

mssql_query("UPDATE CAP_INVENTARIO SET estatus=$estatus WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario='$empleado'",$conn);

$url="https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/comparar_inventarios.php?almacen=$almacen&fecha=$fecha&usuario=$empleado&cia=$cia";
$resp=@file_get_contents($url);
$res=json_decode($resp,true);

$hay_diferencias=false;
if($res && isset($res['hay_diferencias'])) $hay_diferencias=boolval($res['hay_diferencias']);

$next_status=$estatus;
$mensaje_final="";
if($hay_diferencias){
  if($estatus<3){
    $next_status=$estatus+1;
    mssql_query("UPDATE CAP_INVENTARIO SET estatus=$next_status WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario='$empleado'",$conn);
    $q=mssql_query("SELECT id FROM CAP_INVENTARIO WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario='$empleado'",$conn);
    while($r=mssql_fetch_assoc($q)){
      $id_inv=intval($r['id']);
      mssql_query("INSERT INTO CAP_INVENTARIO_CONTEOS(id_inventario,nro_conteo,cantidad,usuario,fecha,estatus) VALUES($id_inv,$next_status,0,'$empleado',GETDATE(),1)",$conn);
    }
    $mensaje_final="Se detectaron diferencias. Se ha preparado el Conteo ".$next_status.".";
  }else{
    mssql_query("UPDATE CAP_INVENTARIO SET estatus=4 WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario='$empleado'",$conn);
    $next_status=4;
    $mensaje_final="Conteo 3 finalizado con diferencias. Proceso cerrado.";
  }
}else{
  mssql_query("UPDATE CAP_INVENTARIO SET estatus=4 WHERE almacen='$almacen' AND fecha_inv='$fecha' AND usuario='$empleado'",$conn);
  $next_status=4;
  $mensaje_final="No se encontraron diferencias. Proceso completado.";
}

echo json_encode([
  "success"=>true,
  "mensaje"=>$mensaje_final,
  "next_status"=>$next_status,
  "hay_diferencias"=>$hay_diferencias
]);
exit;
?>
