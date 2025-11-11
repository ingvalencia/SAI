<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

$almacen = isset($_GET['almacen']) ? $_GET['almacen'] : null;
$fecha   = isset($_GET['fecha']) ? $_GET['fecha'] : null;
$usuario = isset($_GET['usuario']) ? $_GET['usuario'] : null;
$cia     = isset($_GET['cia']) ? $_GET['cia'] : null;

if (!$almacen || !$fecha || !$usuario || !$cia) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(["success" => false, "error" => "Error de conexión"]);
  exit;
}

mssql_select_db($db, $conn);

$sp = mssql_query("EXEC [USP_INVEN_SAP] '$almacen', '$fecha', '$usuario', '$cia'", $conn);
if (!$sp) {
  echo json_encode(["success" => false, "error" => "Error ejecutando USP_INVEN_SAP"]);
  exit;
}

$base = [];
while ($r = mssql_fetch_assoc($sp)) {
  $codigo = trim($r['Codigo sap']);
  $base[$codigo] = [
    'id' => null,
    'codfam' => $r['Codfam'],
    'nom_fam' => $r['Familia'],
    'cod_subfam' => $r['Codsubfam'],
    'nom_subfam' => $r['Subfamilia'],
    'ItemCode' => $codigo,
    'Itemname' => $r['Nombre'],
    'almacen' => $r['Almacen'],
    'cant_sap' => floatval($r['Inventario_sap']),
    'fecha_carga' => $r['fecha_carga'],
    'fec_intrt' => $r['FEC_INTRT'],
    'codebars' => $r['CodeBars'],
    'cias' => $r['CIA'],
    'usuario' => $r['Usuario'],
    'conteo1' => 0,
    'conteo2' => 0,
    'conteo3' => 0
  ];
}

$q = mssql_query("
  SELECT c.id, c.ItemCode, c.nom_fam, c.nom_subfam, c.cod_subfam, c.Itemname, c.almacen, c.cias,
         ct.nro_conteo, ct.cantidad
  FROM CAP_INVENTARIO c
  LEFT JOIN CAP_INVENTARIO_CONTEOS ct ON c.id = ct.id_inventario
  WHERE c.almacen = '$almacen' AND c.fecha_inv = '$fecha' AND c.usuario = '$usuario'
", $conn);

while ($r = mssql_fetch_assoc($q)) {
  $codigo = trim($r['ItemCode']);
  $nro = intval($r['nro_conteo']);
  $cant = floatval($r['cantidad']);
  if (!isset($base[$codigo])) {
    $base[$codigo] = [
      'id' => $r['id'],
      'codfam' => $r['cod_subfam'],
      'nom_fam' => $r['nom_fam'],
      'cod_subfam' => $r['cod_subfam'],
      'nom_subfam' => $r['nom_subfam'],
      'ItemCode' => $codigo,
      'Itemname' => $r['Itemname'],
      'almacen' => $r['almacen'],
      'cant_sap' => 0,
      'fecha_carga' => '',
      'fec_intrt' => '',
      'codebars' => '',
      'cias' => $r['cias'],
      'usuario' => $usuario,
      'conteo1' => 0,
      'conteo2' => 0,
      'conteo3' => 0
    ];
  }
  if ($nro === 1) $base[$codigo]['conteo1'] = $cant;
  if ($nro === 2) $base[$codigo]['conteo2'] = $cant;
  if ($nro === 3) $base[$codigo]['conteo3'] = $cant;
}

$estatus = 1;
$res = mssql_query("
  SELECT TOP 1 estatus FROM CAP_INVENTARIO
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = '$usuario'
", $conn);
if ($res && $row = mssql_fetch_assoc($res)) $estatus = intval($row['estatus']);
if ($estatus < 1) $estatus = 1;

$base_comparacion = "SAP";
if ($estatus == 2) $base_comparacion = "CONTEO1";
if ($estatus == 3) $base_comparacion = "CONTEO2";

$hay_diferencias = false;
$resultado = [];

foreach ($base as $item) {
  $b = 0;
  $a = 0;
  if ($estatus == 1) {
    $b = $item['cant_sap'];
    $a = $item['conteo1'];
  } elseif ($estatus == 2) {
    $b = $item['conteo1'];
    $a = $item['conteo2'];
  } elseif ($estatus == 3) {
    $b = $item['conteo2'];
    $a = $item['conteo3'];
  }
  $item['base_valor'] = round($b,2);
  $item['conteo_valor'] = round($a,2);
  $item['diferencia'] = round($b - $a,2);
  if (abs($item['diferencia']) > 0.01) $hay_diferencias = true;
  $resultado[] = $item;
}

echo json_encode([
  "success" => true,
  "data" => $resultado,
  "estatus" => $estatus,
  "base_comparacion" => $base_comparacion,
  "hay_diferencias" => $hay_diferencias
]);
exit;
?>
