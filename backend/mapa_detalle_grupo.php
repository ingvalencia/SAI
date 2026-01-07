<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

$grupo   = isset($_GET['grupo']) ? trim($_GET['grupo']) : null;
$fecha   = isset($_GET['fecha']) ? trim($_GET['fecha']) : null;
$cia     = isset($_GET['cia']) ? trim($_GET['cia']) : null;
$usuario = isset($_GET['usuario']) ? trim($_GET['usuario']) : null;

if (!$grupo || !$fecha || !$cia) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}

/* ============================
   CONEXIÓN SQL SERVER
============================ */
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

/* ============================
   1. OBTENER ALMACENES DEL GRUPO
============================ */
$resAlm = mssql_query("
  SELECT DISTINCT almacen
  FROM CAP_INVENTARIO
  WHERE almacen LIKE '{$grupo}-%'
    AND fecha_inv = '$fecha'
    AND cias = '$cia'
", $conn);

$almacenes = [];
while ($r = mssql_fetch_assoc($resAlm)) {
  $almacenes[] = $r['almacen'];
}

if (empty($almacenes)) {
  echo json_encode(["success" => false, "error" => "No hay almacenes para el grupo"]);
  exit;
}

$listaAlmacenes = "'" . implode("','", $almacenes) . "'";

/* ============================
   2. USUARIO FALLBACK
============================ */
if (!$usuario) {
  $ru = mssql_query("
    SELECT MAX(usuario) AS usuario
    FROM CAP_INVENTARIO
    WHERE almacen IN ($listaAlmacenes)
      AND fecha_inv = '$fecha'
      AND cias = '$cia'
  ", $conn);

  if ($ru && $u = mssql_fetch_assoc($ru)) {
    $usuario = $u['usuario'];
  }
}

/* ============================
   3. INVENTARIO SAP (POR ALMACÉN)
============================ */
$items = []; // clave: almacen|codigo

foreach ($almacenes as $alm) {
  $sp = mssql_query("EXEC [USP_INVEN_SAP] '$alm', '$fecha', '$usuario', '$cia'", $conn);

  while ($row = mssql_fetch_assoc($sp)) {
    $cod = trim($row['Codigo sap']);
    $key = $alm . '|' . $cod;

    if (!isset($items[$key])) {
      $items[$key] = [
        'almacen'        => $alm,
        'codigo'         => $cod,
        'nombre'         => $row['Nombre'],
        'familia'        => $row['Familia'],
        'subfamilia'     => $row['Subfamilia'],
        'inventario_sap' => 0,
        'conteo1'        => 0,
        'conteo2'        => 0,
        'conteo3'        => 0,
      ];
    }

    $items[$key]['inventario_sap'] += (float)$row['Inventario_sap'];
  }
}

/* ============================
   4. CONSOLIDAR CONTEOS (POR ALMACÉN)
============================ */
$q = mssql_query("
  SELECT c.almacen, c.ItemCode, ct.nro_conteo, ct.cantidad
  FROM CAP_INVENTARIO c
  JOIN CAP_INVENTARIO_CONTEOS ct ON c.id = ct.id_inventario
  WHERE c.almacen IN ($listaAlmacenes)
    AND c.fecha_inv = '$fecha'
    AND c.cias = '$cia'
", $conn);

while ($r = mssql_fetch_assoc($q)) {
  $alm = $r['almacen'];
  $cod = trim($r['ItemCode']);
  $key = $alm . '|' . $cod;

  if (!isset($items[$key])) continue;

  $n = (int)$r['nro_conteo'];
  $v = (float)$r['cantidad'];

  if ($n <= 1)      $items[$key]['conteo1'] += $v;
  else if ($n == 2) $items[$key]['conteo2'] += $v;
  else              $items[$key]['conteo3'] += $v;
}

/* ============================
   5. ESTATUS DEL GRUPO (MIN)
============================ */
$re = mssql_query("
  SELECT MIN(estatus) AS estatus
  FROM CAP_INVENTARIO
  WHERE almacen IN ($listaAlmacenes)
    AND fecha_inv = '$fecha'
    AND cias = '$cia'
", $conn);

$estatus = 0;
if ($re && $e = mssql_fetch_assoc($re)) {
  $estatus = (int)$e['estatus'];
}

/* ============================
   6. CALCULAR DIFERENCIAS
============================ */

$out = [];

foreach ($items as $it) {

  if ($it['conteo3'] > 0) {
    $conteo_final = $it['conteo3'];
  } elseif ($it['conteo2'] > 0) {
    $conteo_final = $it['conteo2'];
  } else {
    $conteo_final = $it['conteo1'];
  }

  $it['conteo_final'] = $conteo_final;
  $it['diferencia']   = $conteo_final - $it['inventario_sap'];

  $out[] = $it;
}


/* ============================
   7. RESPONSE
============================ */
echo json_encode([
  "success" => true,
  "estatus" => $estatus,
  "data"    => $out
]);
exit;
