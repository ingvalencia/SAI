<?php
// === CORS / JSON ===
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// === Parámetros ===
$almacen = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;
$fecha   = isset($_GET['fecha'])   ? trim($_GET['fecha'])   : null;
$cia     = isset($_GET['cia'])     ? trim($_GET['cia'])     : null;
$usuario = isset($_GET['usuario']) ? trim($_GET['usuario']) : null;

if (!$almacen || !$fecha || !$cia) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}

// === Conexión SQL Server ===
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

// === Fallback de usuario si no llegó desde el cliente ===
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

// === Inventario SAP desde SP (base del merge) ===
$sp = mssql_query("EXEC [USP_INVEN_SAP] '$almacen', '$fecha', '$usuario', '$cia'", $conn);
if (!$sp) {
  $error = mssql_get_last_message();
  echo json_encode(["success" => false, "error" => "Error en SP: $error"]);
  exit;
}

$items = []; // clave: codigo
while ($row = mssql_fetch_assoc($sp)) {
  $codigo = trim($row['Codigo sap']);
  $items[$codigo] = [
    'id_inventario'  => null,
    'codfam'         => $row['Codfam'],
    'familia'        => $row['Familia'],
    'codsubfam'      => $row['Codsubfam'],
    'subfamilia'     => $row['Subfamilia'],
    'codigo'         => $codigo,
    'nombre'         => $row['Nombre'],
    'almacen'        => $row['Almacen'],
    'inventario_sap' => (float)$row['Inventario_sap'],
    'fecha_carga'    => $row['fecha_carga'],
    'fec_intrt'      => $row['FEC_INTRT'],
    'codebars'       => $row['CodeBars'],
    'cias'           => $row['CIA'],
    'usuario'        => $row['Usuario'],
    'conteo1'        => 0,
    'conteo2'        => 0,
    'conteo3'        => 0,
  ];
}

// === Traer conteos desde CAP_INVENTARIO_CONTEOS (mapeo directo) ===
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
    // Código no vino del SP: crear base vacía
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
    ];
  }

  $items[$codigo]['id_inventario'] = $row['id'];

  // Mapear nro_conteo→conteo1/2/3 (0→1, 1→1, 2→2, >=3→3)
  if ($row['nro_conteo'] !== null) {
    $n = (int)$row['nro_conteo'];
    $val = (float)$row['cantidad'];
    if ($n <= 1)        $items[$codigo]['conteo1'] = $val;
    else if ($n == 2)   $items[$codigo]['conteo2'] = $val;
    else                $items[$codigo]['conteo3'] = $val;
  }
}

// === Estatus general del proceso ===
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

// === Calcular diferencia con el conteo según estatus (1→c1, 2→c2, >=3→c3) ===
$out = [];
foreach ($items as $it) {
  $base = 0.0;

  if ($estatus === 1) {
    $base = $it['conteo1'];
  } elseif ($estatus === 2) {
    $base = $it['conteo2'];
  } elseif ($estatus >= 3) {
    $base = $it['conteo3'];
  }

  $it['diferencia'] = (float)$it['inventario_sap'] - (float)$base;

  $out[] = $it;
}

// === Respuesta ===
echo json_encode([
  'success' => true,
  'estatus' => $estatus,
  'data'    => $out,
]);
exit;
