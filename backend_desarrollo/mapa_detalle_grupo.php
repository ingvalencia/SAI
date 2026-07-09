<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

function normalizarCodigo($c) {
  $c = trim((string)$c);

  if (ctype_digit($c)) {
    return str_pad(ltrim($c, '0'), 8, '0', STR_PAD_LEFT);
  }

  return $c;
}

function limpiar($v) {
  return str_replace("'", "''", trim((string)$v));
}

function valorCampo($row, $campos, $default = '') {
  foreach ($campos as $campo) {
    if (isset($row[$campo])) {
      return $row[$campo];
    }
  }

  foreach ($row as $k => $v) {
    foreach ($campos as $campo) {
      if (strtolower($k) == strtolower($campo)) {
        return $v;
      }
    }
  }

  return $default;
}

$grupo   = isset($_GET['grupo']) ? limpiar($_GET['grupo']) : null;
$fecha   = isset($_GET['fecha']) ? limpiar($_GET['fecha']) : null;
$cia     = isset($_GET['cia']) ? limpiar($_GET['cia']) : null;
$usuario = isset($_GET['usuario']) ? limpiar($_GET['usuario']) : null;

if (!$grupo || !$fecha || !$cia) {
  echo json_encode([
    "success" => false,
    "error" => "Faltan parámetros"
  ]);
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS_DESARROLLO";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  echo json_encode([
    "success" => false,
    "error" => "No se pudo conectar a SQL Server"
  ]);
  exit;
}

mssql_select_db($db, $conn);

$resAlm = mssql_query("
  SELECT DISTINCT almacen
  FROM CAP_INVENTARIO
  WHERE almacen LIKE '{$grupo}-%'
    AND fecha_inv = '$fecha'
    AND cias = '$cia'
", $conn);

$almacenes = [];

if ($resAlm) {
  while ($r = mssql_fetch_assoc($resAlm)) {
    $almacenes[] = $r['almacen'];
  }

  mssql_free_result($resAlm);
}

if (empty($almacenes)) {
  echo json_encode([
    "success" => true,
    "estatus" => 0,
    "data" => []
  ]);
  exit;
}

$listaAlmacenes = "'" . implode("','", $almacenes) . "'";

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

  if ($ru) {
    mssql_free_result($ru);
  }
}

$out = [];

foreach ($almacenes as $alm) {
  $almSQL = limpiar($alm);
  $items = [];

  $qFoto = mssql_query("
    SELECT
      ItemCode,
      ItemName,
      familia,
      subfamilia,
      precio_foto,
      inventario_sap_foto
    FROM CAP_INVENTARIO_SAP_FOTO
    WHERE almacen = '$almSQL'
      AND fecha_inv = '$fecha'
      AND cia = '$cia'
      AND es_activa = 1
    ORDER BY familia ASC, subfamilia ASC, ItemName ASC
  ", $conn);

  if ($qFoto) {
    while ($row = mssql_fetch_assoc($qFoto)) {
      $cod = normalizarCodigo($row['ItemCode']);
      $key = $alm . '|' . $cod;

      if (!isset($items[$key])) {
        $items[$key] = [
          'almacen'        => $alm,
          'codigo'         => $cod,
          'nombre'         => $row['ItemName'],
          'familia'        => $row['familia'],
          'subfamilia'     => $row['subfamilia'],
          'precio'         => (float)$row['precio_foto'],
          'inventario_sap' => 0,
          'conteo1'        => null,
          'conteo2'        => null,
          'conteo3'        => null,
          'conteo4'        => null,
        ];
      }

      $items[$key]['inventario_sap'] += (float)$row['inventario_sap_foto'];
    }

    mssql_free_result($qFoto);
  }

  if (empty($items)) {
    $qBase = mssql_query("
      SELECT *
      FROM CAP_INVENTARIO
      WHERE almacen = '$almSQL'
        AND fecha_inv = '$fecha'
        AND cias = '$cia'
    ", $conn);

    if ($qBase) {
      while ($row = mssql_fetch_assoc($qBase)) {
        $itemCode = valorCampo($row, ['ItemCode', 'itemcode', 'codigo'], '');

        if ($itemCode === '') {
          continue;
        }

        $cod = normalizarCodigo($itemCode);
        $key = $alm . '|' . $cod;

        if (!isset($items[$key])) {
          $items[$key] = [
            'almacen'        => $alm,
            'codigo'         => $cod,
            'nombre'         => valorCampo($row, ['ItemName', 'Itemname', 'itemname', 'nombre'], ''),
            'familia'        => valorCampo($row, ['familia', 'nom_fam', 'nom_familia'], ''),
            'subfamilia'     => valorCampo($row, ['subfamilia', 'nom_subfam', 'nom_subfamilia'], ''),
            'precio'         => (float)valorCampo($row, ['precio', 'precio_foto'], 0),
            'inventario_sap' => 0,
            'conteo1'        => null,
            'conteo2'        => null,
            'conteo3'        => null,
            'conteo4'        => null,
          ];
        }

        $items[$key]['inventario_sap'] += (float)valorCampo($row, ['inventario_sap', 'inventario_sap_foto', 'sap'], 0);
      }

      mssql_free_result($qBase);
    }
  }

  $q = mssql_query("
    SELECT c.ItemCode, ct.nro_conteo, ct.cantidad
    FROM CAP_INVENTARIO c
    JOIN CAP_INVENTARIO_CONTEOS ct ON c.id = ct.id_inventario
    WHERE c.almacen = '$almSQL'
      AND c.fecha_inv = '$fecha'
      AND c.cias = '$cia'
  ", $conn);

  if ($q) {
    while ($r = mssql_fetch_assoc($q)) {
      $cod = normalizarCodigo($r['ItemCode']);
      $key = $alm . '|' . $cod;

      if (!isset($items[$key])) {
        $items[$key] = [
          'almacen'        => $alm,
          'codigo'         => $cod,
          'nombre'         => '',
          'familia'        => '',
          'subfamilia'     => '',
          'precio'         => 0,
          'inventario_sap' => 0,
          'conteo1'        => null,
          'conteo2'        => null,
          'conteo3'        => null,
          'conteo4'        => null,
        ];
      }

      $n = (int)$r['nro_conteo'];
      $v = (float)$r['cantidad'];

      if ($n <= 1) {
        $items[$key]['conteo1'] = is_null($items[$key]['conteo1']) ? $v : $items[$key]['conteo1'] + $v;
      } elseif ($n == 2) {
        $items[$key]['conteo2'] = is_null($items[$key]['conteo2']) ? $v : $items[$key]['conteo2'] + $v;
      } elseif ($n == 3) {
        $items[$key]['conteo3'] = is_null($items[$key]['conteo3']) ? $v : $items[$key]['conteo3'] + $v;
      } elseif ($n == 7) {
        $items[$key]['conteo4'] = is_null($items[$key]['conteo4']) ? $v : $items[$key]['conteo4'] + $v;
      }
    }

    mssql_free_result($q);
  }

  foreach ($items as $it) {
    $conteo_final =
    (!is_null($it['conteo4'])) ? $it['conteo4'] :
    ((!is_null($it['conteo3'])) ? $it['conteo3'] :
    ((!is_null($it['conteo2']) && !is_null($it['conteo1']) && (float)$it['conteo1'] == (float)$it['conteo2']) ? $it['conteo2'] :
    ((!is_null($it['conteo2']) && !is_null($it['conteo1']) && (float)$it['conteo1'] != (float)$it['conteo2']) ? 0 :
    ((!is_null($it['conteo1'])) ? $it['conteo1'] : 0))));

    $it['conteo_final'] = $conteo_final;
    $it['diferencia']   = $conteo_final - $it['inventario_sap'];

    $out[] = $it;
  }

  unset($items);
}

$re = mssql_query("
  SELECT MAX(estatus) AS estatus
  FROM CAP_INVENTARIO
  WHERE almacen IN ($listaAlmacenes)
    AND fecha_inv = '$fecha'
    AND cias = '$cia'
", $conn);

$estatus = 0;

if ($re && $e = mssql_fetch_assoc($re)) {
  $estatus = (int)$e['estatus'];
}

if ($re) {
  mssql_free_result($re);
}

usort($out, function($a, $b) {
  $fa = strtoupper((string)$a['familia']);
  $fb = strtoupper((string)$b['familia']);

  if ($fa != $fb) {
    return strcmp($fa, $fb);
  }

  $sa = strtoupper((string)$a['subfamilia']);
  $sb = strtoupper((string)$b['subfamilia']);

  if ($sa != $sb) {
    return strcmp($sa, $sb);
  }

  $na = strtoupper((string)$a['nombre']);
  $nb = strtoupper((string)$b['nombre']);

  return strcmp($na, $nb);
});

echo json_encode([
  "success" => true,
  "estatus" => $estatus,
  "data"    => $out
]);

exit;
?>
