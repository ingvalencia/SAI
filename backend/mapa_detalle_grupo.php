<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');



function normalizarCodigo($c) {
  return str_pad(ltrim(trim($c), '0'), 8, '0', STR_PAD_LEFT);
}


$grupo   = isset($_GET['grupo']) ? trim($_GET['grupo']) : null;
$fecha   = isset($_GET['fecha']) ? trim($_GET['fecha']) : null;
$cia     = isset($_GET['cia']) ? trim($_GET['cia']) : null;
$usuario = isset($_GET['usuario']) ? trim($_GET['usuario']) : null;



/*
file_put_contents(
  __DIR__ . '/debug_grupo.log',
  "ENTRO AL SCRIPT\n",
  FILE_APPEND
);
*/



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

//$almacenes = array_slice($almacenes, 0, 1);

$almacenes = [];
while ($r = mssql_fetch_assoc($resAlm)) {
  $almacenes[] = $r['almacen'];
  //print_r($r);
}
//exit();

if (empty($almacenes)) {
  echo json_encode([
    "success" => true,
    "estatus" => 0,
    "data" => []
  ]);
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
   3–6. PROCESAR ALMACÉN POR ALMACÉN (SIN ARRAYS GIGANTES)
============================ */

$out = [];

foreach ($almacenes as $alm) {

  // ===== 3) SAP SOLO PARA ESTE ALMACÉN =====
  $items = [];

  $sp = mssql_query("EXEC [USP_INVEN_SAP] '$alm', '$fecha', '$usuario', '$cia'", $conn);
  if (!$sp) continue;

  while ($row = mssql_fetch_assoc($sp)) {
    $cod = normalizarCodigo($row['Codigo sap']);
    $key = $alm . '|' . $cod;

    if (!isset($items[$key])) {
      $items[$key] = [
        'almacen'        => $alm,
        'codigo'         => $cod,
        'nombre'         => $row['Nombre'],
        'familia'        => $row['Familia'],
        'subfamilia'     => $row['Subfamilia'],
        'precio'         => $row['precio'],
        'inventario_sap' => 0,
        'conteo1'        => 0,
        'conteo2'        => 0,
        'conteo3'        => 0,
        'conteo4'        => 0,
      ];
    }
    $items[$key]['inventario_sap'] += (float)$row['Inventario_sap'];
  }
  while (mssql_next_result($sp)) {;}
  mssql_free_result($sp);

  // ===== 4) CONTEOS SOLO PARA ESTE ALMACÉN =====
  $q = mssql_query("
    SELECT c.ItemCode, ct.nro_conteo, ct.cantidad
    FROM CAP_INVENTARIO c
    JOIN CAP_INVENTARIO_CONTEOS ct ON c.id = ct.id_inventario
    WHERE c.almacen = '$alm'
      AND c.fecha_inv = '$fecha'
      AND c.cias = '$cia'
  ", $conn);
  if (!$q) continue;

  while ($r = mssql_fetch_assoc($q)) {
    $cod = normalizarCodigo($r['ItemCode']);
    $key = $alm . '|' . $cod;
    if (!isset($items[$key])) continue;

    $n = (int)$r['nro_conteo'];
    $v = (float)$r['cantidad'];

    if ($n <= 1)      $items[$key]['conteo1'] += $v;
    elseif ($n == 2)  $items[$key]['conteo2'] += $v;
    elseif ($n == 3)  $items[$key]['conteo3'] += $v;
    elseif ($n == 7)  $items[$key]['conteo4'] += $v;
  }
  mssql_free_result($q);

  // ===== 6) CALCULAR Y AGREGAR AL RESULTADO FINAL =====
  foreach ($items as $it) {
    $conteo_final =
      ($it['conteo4'] > 0) ? $it['conteo4'] :
      (($it['conteo3'] > 0) ? $it['conteo3'] :
      (($it['conteo2'] > 0) ? $it['conteo2'] : $it['conteo1']));

    $it['conteo_final'] = $conteo_final;
    $it['diferencia']   = $conteo_final - $it['inventario_sap'];

    $out[] = $it;
  }

  unset($items); // libera memoria por almacén
}
/* ============================ 5. ESTATUS DEL GRUPO (MIN) ============================ */ $re = mssql_query(" SELECT MAX(estatus) AS estatus FROM CAP_INVENTARIO WHERE almacen IN ($listaAlmacenes) AND fecha_inv = '$fecha' AND cias = '$cia' ", $conn); $estatus = 0; if ($re && $e = mssql_fetch_assoc($re)) { $estatus = (int)$e['estatus']; }

/* ============================
   7. RESPONSE
============================ */
echo json_encode([
  "success" => true,
  "estatus" => $estatus,
  "data"    => $out
]);
exit;
