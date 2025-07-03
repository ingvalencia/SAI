<?php
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
    'cant_invfis'     => 0
  ];
}

$q = mssql_query("
  SELECT ItemCode, cant_invfis
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = '$usuario'
", $conn);

while ($row = mssql_fetch_assoc($q)) {
  $codigo = trim($row['ItemCode']);
  $cant = floatval($row['cant_invfis']);
  if (isset($inventarioSAP[$codigo])) {
    $inventarioSAP[$codigo]['cant_invfis'] = $cant;
  } else {
    $inventarioSAP[$codigo] = [
      'codfam'          => '',
      'familia'         => '',
      'codsubfam'       => '',
      'subfamilia'      => '',
      'codigo'          => $codigo,
      'nombre'          => '',
      'almacen'         => $almacen,
      'inventario_sap'  => 0,
      'fecha_carga'     => '',
      'fec_intrt'       => '',
      'codebars'        => '',
      'cias'            => $cia,
      'usuario'         => $usuario,
      'cant_invfis'     => $cant
    ];
  }
}

$resEstatus = mssql_query("
  SELECT TOP 1 estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = '$usuario'
", $conn);

$estatus = 0;
if ($resEstatus && $rowEst = mssql_fetch_assoc($resEstatus)) {
  $estatus = intval($rowEst['estatus']);
}

$resultado = [];
foreach ($inventarioSAP as $item) {
  $item['diferencia'] = $item['inventario_sap'] - $item['cant_invfis'];
  $resultado[] = $item;
}

echo json_encode([
  "success" => true,
  "data" => $resultado,
  "estatus" => $estatus
]);
exit;
