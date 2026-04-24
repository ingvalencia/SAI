<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');


$almacen = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;
$fecha   = isset($_GET['fecha'])   ? trim($_GET['fecha'])   : null;
$cia     = isset($_GET['cia'])     ? trim($_GET['cia'])     : null;
$usuario = isset($_GET['usuario']) ? trim($_GET['usuario']) : null;

if (!$almacen || !$fecha || !$cia) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}


$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(["success" => false, "error" => "No se pudo conectar a SQL Server"]);
  exit;
}
mssql_select_db($db, $conn);

if (!$usuario) {
  $resUsr = mssql_query("
    SELECT MAX(usuario) AS usuario
    FROM CAP_INVENTARIO
    WHERE almacen = '$almacen'
      AND fecha_inv = '$fecha'
      AND cias = '$cia'
  ", $conn);
  if ($resUsr && $rowUsr = mssql_fetch_assoc($resUsr)) $usuario = $rowUsr['usuario'];
  if (!$usuario) {
    echo json_encode(["success" => false, "error" => "No se pudo determinar usuario"]);
    exit;
  }
}


$sqlFoto = "
  SELECT
    cod_fam,
    familia,
    cod_subfam,
    subfamilia,
    precio_foto,
    ItemCode,
    ItemName,
    almacen,
    inventario_sap_foto,
    fecha_hora_foto,
    codebars,
    cia,
    usuario_genero
  FROM CAP_INVENTARIO_SAP_FOTO
  WHERE almacen = '$almacen'
    AND fecha_inv = '$fecha'
    AND cia = '$cia'
    AND es_activa = 1
";

$resFoto = mssql_query($sqlFoto, $conn);
if (!$resFoto) {
  $error = mssql_get_last_message();
  echo json_encode(["success" => false, "error" => "Error consultando fotografía: $error"]);
  exit;
}

$items = [];
while ($row = mssql_fetch_assoc($resFoto)) {
  $codigo = trim($row['ItemCode']);
  $items[$codigo] = [
    'id_inventario'  => null,
    'codfam'         => $row['cod_fam'],
    'familia'        => $row['familia'],
    'codsubfam'      => $row['cod_subfam'],
    'subfamilia'     => $row['subfamilia'],
    'precio'         => $row['precio_foto'],
    'codigo'         => $codigo,
    'nombre'         => $row['ItemName'],
    'almacen'        => $row['almacen'],
    'inventario_sap' => (float)$row['inventario_sap_foto'],
    'fecha_carga'    => $row['fecha_hora_foto'],
    'fec_intrt'      => $fecha,
    'codebars'       => $row['codebars'],
    'cias'           => $row['cia'],
    'usuario'        => $row['usuario_genero'],
    'conteo1'        => 0,
    'conteo2'        => 0,
    'conteo3'        => 0,
    'conteo4'        => 0,
  ];
}


$q = mssql_query("
  SELECT c.id, c.ItemCode, c.almacen, c.cias, c.estatus,
         ct.nro_conteo, ct.cantidad
  FROM CAP_INVENTARIO c
  LEFT JOIN CAP_INVENTARIO_CONTEOS ct
    ON c.id = ct.id_inventario
  WHERE c.almacen = '$almacen'
    AND c.fecha_inv = '$fecha'
    AND c.cias = '$cia'
", $conn);

while ($row = mssql_fetch_assoc($q)) {
  $codigo = trim($row['ItemCode']);

  if (!isset($items[$codigo])) {

    $items[$codigo] = [
      'id_inventario'  => $row['id'],
      'codfam'         => '',
      'familia'        => '',
      'codsubfam'      => '',
      'subfamilia'     => '',
      'codigo'         => $codigo,
      'nombre'         => '',
      'almacen'        => $row['almacen'],
      'inventario_sap' => 0.0,
      'fecha_carga'    => '',
      'fec_intrt'      => '',
      'codebars'       => '',
      'cias'           => $row['cias'],
      'usuario'        => $usuario,
      'conteo1'        => 0,
      'conteo2'        => 0,
      'conteo3'        => 0,
      'conteo4'        => 0,
    ];
  }

  $items[$codigo]['id_inventario'] = $row['id'];


  if ($row['nro_conteo'] !== null) {
  $n = (int)$row['nro_conteo'];
  $val = (float)$row['cantidad'];

  if ($n <= 1)        $items[$codigo]['conteo1'] = $val;
  else if ($n == 2)   $items[$codigo]['conteo2'] = $val;
  else if ($n == 3)   $items[$codigo]['conteo3'] = $val;
  else if ($n == 7)   $items[$codigo]['conteo4'] = $val;
}
}


$resEstatus = mssql_query("
  SELECT TOP 1 estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen'
    AND fecha_inv = '$fecha'
    AND cias = '$cia'
  ORDER BY estatus DESC
", $conn);

$estatus = 0;
if ($resEstatus && $rowEst = mssql_fetch_assoc($resEstatus)) {
  $estatus = (int)$rowEst['estatus'];
}


$out = [];
foreach ($items as $it) {
  $base = 0.0;

  if ($estatus === 1) {
    $base = $it['conteo1'];
  } elseif ($estatus === 2) {
    $base = $it['conteo2'];
  } elseif ($estatus === 3) {
    $base = $it['conteo3'];
  } elseif ($estatus === 7) {
    $base = $it['conteo4'];
  }

  $it['diferencia'] = (float)$it['inventario_sap'] - (float)$base;

  $out[] = $it;
}


echo json_encode([
  'success' => true,
  'estatus' => $estatus,
  'data'    => $out,
]);
exit;
