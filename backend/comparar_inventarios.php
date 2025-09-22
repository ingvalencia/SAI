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
  echo json_encode(["success" => false, "error" => "No se pudo conectar a SQL Server"]);
  exit;
}

mssql_select_db($db, $conn);

/* Inventario SAP desde SP */
$sp = mssql_query("EXEC [USP_INVEN_SAP] '$almacen', '$fecha', '$usuario', '$cia'", $conn);
if (!$sp) {
  $error = mssql_get_last_message();
  echo json_encode(["success" => false, "error" => "Error en SP: $error"]);
  exit;
}

$inventarioSAP = [];
while ($row = mssql_fetch_assoc($sp)) {
  $codigo = trim($row['Codigo sap']);
  $inventarioSAP[$codigo] = [
    'id_inventario'   => null,
    'codfam'          => $row['Codfam'],
    'familia'         => $row['Familia'],
    'codsubfam'       => $row['Codsubfam'],
    'subfamilia'      => $row['Subfamilia'],
    'codigo'          => $codigo,
    'nombre'          => $row['Nombre'],
    'almacen'         => $row['Almacen'],
    'inventario_sap'  => floatval($row['Inventario_sap']),
    'fecha_carga'     => $row['fecha_carga'],
    'fec_intrt'       => $row['FEC_INTRT'],
    'codebars'        => $row['CodeBars'],
    'cias'            => $row['CIA'],
    'usuario'         => $row['Usuario'],
    'conteo1'         => 0,
    'conteo2'         => 0,
    'conteo3'         => 0
  ];
}

/* Traer conteos históricos */
$q = mssql_query("
  SELECT c.id, c.ItemCode, c.almacen, c.cias, c.estatus,
         ct.nro_conteo, ct.cantidad
  FROM CAP_INVENTARIO c
  LEFT JOIN CAP_INVENTARIO_CONTEOS ct
    ON c.id = ct.id_inventario
  WHERE c.almacen = '$almacen' AND c.fecha_inv = '$fecha' AND c.usuario = '$usuario'
", $conn);

while ($row = mssql_fetch_assoc($q)) {
  $codigo = trim($row['ItemCode']);
  $nro = intval($row['nro_conteo']);
  $cant = floatval($row['cantidad']);

  if (!isset($inventarioSAP[$codigo])) {
    $inventarioSAP[$codigo] = [
      'id_inventario'   => $row['id'],
      'codfam'          => '',
      'familia'         => '',
      'codsubfam'       => '',
      'subfamilia'      => '',
      'codigo'          => $codigo,
      'nombre'          => '',
      'almacen'         => $row['almacen'],
      'inventario_sap'  => 0,
      'fecha_carga'     => '',
      'fec_intrt'       => '',
      'codebars'        => '',
      'cias'            => $row['cias'],
      'usuario'         => $usuario,
      'conteo1'         => 0,
      'conteo2'         => 0,
      'conteo3'         => 0
    ];
  }

  $inventarioSAP[$codigo]['id_inventario'] = $row['id'];

  if ($nro === 0) $inventarioSAP[$codigo]['conteo1'] = $cant;
  if ($nro === 1) $inventarioSAP[$codigo]['conteo2'] = $cant;
  if ($nro === 2) $inventarioSAP[$codigo]['conteo3'] = $cant;
}

/* Traer estatus */
$resEstatus = mssql_query("
  SELECT TOP 1 estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = '$usuario'
", $conn);

$estatus = 0;
if ($resEstatus && $rowEst = mssql_fetch_assoc($resEstatus)) {
  $estatus = intval($rowEst['estatus']);
}

/* Asegurar que mínimo sea 1 */
if ($estatus < 1) {
  $estatus = 1;
}

/* Construir respuesta */
$resultado = [];
foreach ($inventarioSAP as $item) {
  $conteoBase = 0;
  if ($estatus === 0) $conteoBase = $item['conteo1'];
  if ($estatus === 1) $conteoBase = $item['conteo2'];
  if ($estatus === 2) $conteoBase = $item['conteo3'];

  $item['diferencia'] = $item['inventario_sap'] - $conteoBase;
  $resultado[] = $item;
}

echo json_encode([
  "success" => true,
  "data" => $resultado,
  "estatus" => $estatus
]);
exit;
