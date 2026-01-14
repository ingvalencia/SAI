<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/* ============================================================
   FUNCIÓN PARA NORMALIZAR FECHA
============================================================ */
function normalizarFecha($f) {
    if (!$f) return false;

    $f = str_replace("+", " ", $f);
    $f = str_replace(":AM", " AM", $f);
    $f = str_replace(":PM", " PM", $f);

    $ts = strtotime($f);
    if ($ts === false) return false;

    return date("Y-m-d", $ts);
}

/* ============================================================
   PARÁMETROS
============================================================ */
$almacen = isset($_GET['almacen']) ? trim($_GET['almacen']) : null;
$fecha   = isset($_GET['fecha'])   ? trim($_GET['fecha'])   : null;
$usuario = isset($_GET['usuario']) ? trim($_GET['usuario']) : null; // Nº empleado
$cia     = isset($_GET['cia'])     ? trim($_GET['cia'])     : null;

$fecha = normalizarFecha($fecha);

if (!$almacen || !$fecha || !$usuario || !$cia) {
    echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
    exit;
}

if ($fecha === false) {
    echo json_encode(["success" => false, "error" => "Fecha no válida"]);
    exit;
}

/* ============================================================
   CONEXIÓN BD
============================================================ */
$server  = "192.168.0.174";
$userSQL = "sa";
$passSQL = "P@ssw0rd";
$db      = "SAP_PROCESOS";

$conn = mssql_connect($server, $userSQL, $passSQL);
if (!$conn) {
    echo json_encode(["success" => false, "error" => "Error de conexión"]);
    exit;
}
mssql_select_db($db, $conn);

/* Sanitizar básicos */
$almacen_safe = addslashes($almacen);
$cia_safe     = addslashes($cia);

/* ============================================================
   IDENTIFICAR ID DEL USUARIO (tabla usuarios)
============================================================ */
$sqlUID = "SELECT TOP 1 id FROM usuarios WHERE empleado = '$usuario'";
$resUID = mssql_query($sqlUID, $conn);

if (!$resUID || mssql_num_rows($resUID) === 0) {
    echo json_encode([
        "success" => false,
        "error"   => "Empleado no encontrado en tabla de usuarios."
    ]);
    exit;
}

$rowUID     = mssql_fetch_assoc($resUID);
$id_usuario = intval($rowUID['id']);

/* ============================================================
   DETECTAR BRIGADA, OBTENER COMPAÑERO Y NROS DE CONTEO
   CAP_CONTEO_CONFIG (estatus = 0 => activo)
============================================================ */
$sqlBrig = "
  SELECT id, nro_conteo, usuarios_asignados
  FROM CAP_CONTEO_CONFIG
  WHERE almacen = '$almacen_safe'
    AND cia = '$cia_safe'
   AND estatus IN (0,1)

";
$resBrig = mssql_query($sqlBrig, $conn);

$nro_conteo_mio        = null;   // 1 ó 2
$id_companero          = null;
$empleado_companero    = null;
$nro_conteo_companero  = null;

$asignaciones = []; // [nro_conteo => string usuarios_asignados]

if ($resBrig) {
    while ($r = mssql_fetch_assoc($resBrig)) {
        $lista = $r['usuarios_asignados']; // Ej: "[20]" o "[20,21]"
        $nro_c = intval($r['nro_conteo']);

        // Guardar la lista cruda por conteo
        $asignaciones[$nro_c] = $lista;

        // Ver si YO (id_usuario) estoy en esta lista
        if (strpos($lista, "[$id_usuario]") !== false) {
            $nro_conteo_mio = $nro_c; // 1 ó 2
        }
    }
}

/* Determinar compañero solo si yo tengo 1 o 2 y hay al menos otra asignación */
if ($nro_conteo_mio && count($asignaciones) >= 2) {
    $otroConteo = ($nro_conteo_mio == 1 ? 2 : 1);

    if (isset($asignaciones[$otroConteo])) {
        $listaOtro = $asignaciones[$otroConteo]; // ej "[21]" o "[21,22]"
        $listaOtro = str_replace(["[", "]"], "", $listaOtro);
        // Tomamos el primer id de la lista
        $partes = array_filter(array_map('trim', explode(",", $listaOtro)));
        if (count($partes) > 0) {
            $id_companero         = intval($partes[0]);
            $nro_conteo_companero = $otroConteo;

            // Buscar empleado del compañero
            $sqlEC = "SELECT TOP 1 empleado FROM usuarios WHERE id = $id_companero";
            $resEC = mssql_query($sqlEC, $conn);
            if ($resEC && $rowE = mssql_fetch_assoc($resEC)) {
                $empleado_companero = $rowE['empleado'];
            }
        }
    }
}

/* Es brigada si hay compañero identificado */
$esBrigada = ($empleado_companero !== null);

/* ============================================================
   DETECTAR SI YA EXISTE CONFIG PARA TERCER CONTEO (nro_conteo = 3)
============================================================ */
$tercer_conteo_asignado = false;
$empleado_tercer_conteo = null;
$estatus_tercer_conteo  = null;

$cuarto_conteo_asignado = false;
$empleado_cuarto_conteo = null;
$estatus_cuarto_conteo  = null;


$sqlTercero = "
  SELECT TOP 1 usuarios_asignados, estatus
  FROM CAP_CONTEO_CONFIG
  WHERE almacen  = '$almacen_safe'
    AND cia      = '$cia_safe'
    AND nro_conteo = 3
";
$resTercero = mssql_query($sqlTercero, $conn);

if ($resTercero && mssql_num_rows($resTercero) > 0) {
    $rowT   = mssql_fetch_assoc($resTercero);
    $listaT = $rowT['usuarios_asignados']; // ej "[30]"
    $estatus_tercer_conteo = intval($rowT['estatus']);

    $listaT = str_replace(["[", "]"], "", $listaT);
    $partesT = array_filter(array_map('trim', explode(",", $listaT)));

    if (count($partesT) > 0) {
        $idTercero = intval($partesT[0]);

        $sqlET = "SELECT TOP 1 empleado FROM usuarios WHERE id = $idTercero";
        $resET = mssql_query($sqlET, $conn);
        if ($resET && $rowET = mssql_fetch_assoc($resET)) {
            $empleado_tercer_conteo = $rowET['empleado'];
            $tercer_conteo_asignado = true;
        }
    }
}

$sql4 = "
  SELECT TOP 1 usuarios_asignados, estatus
  FROM CAP_CONTEO_CONFIG
  WHERE cia='$cia_safe'
    AND almacen='$almacen_safe'
    AND nro_conteo=7
";
$r4 = mssql_query($sql4, $conn);
if ($r4 && ($row4 = mssql_fetch_assoc($r4))) {
  $cuarto_conteo_asignado = true;
  $estatus_cuarto_conteo  = intval($row4['estatus']);

  // sacar un empleado asignado (igual que tu lógica actual)
  $ua = $row4['usuarios_asignados']; // ejemplo: "[12][15]"
  preg_match_all('/\[(\d+)\]/', $ua, $m);
 if (!empty($m[1])) {
    $idCuarto = intval($m[1][0]); // esto SI es usuarios.id

    $sqlE4 = "SELECT TOP 1 empleado FROM usuarios WHERE id = $idCuarto";
    $resE4 = mssql_query($sqlE4, $conn);
    if ($resE4 && ($rowE4 = mssql_fetch_assoc($resE4))) {
        $empleado_cuarto_conteo = $rowE4['empleado']; // ✅ empleado real
    }
}

}


/* ============================================================
   ESTATUS GLOBAL DEL PROCESO (desde CAP_INVENTARIO)
============================================================ */
$estatus_global = null;
$sqlEst = "
  SELECT MAX(estatus) AS estatus_global
  FROM CAP_INVENTARIO
  WHERE almacen   = '$almacen_safe'
    AND fecha_inv = '$fecha'
    AND cias      = '$cia_safe'
";
$resEst = mssql_query($sqlEst, $conn);
if ($resEst && $rowEst = mssql_fetch_assoc($resEst)) {
    $estatus_global = $rowEst['estatus_global'] !== null
        ? intval($rowEst['estatus_global'])
        : null;
}

$modo = "captura";
if ($estatus_global !== null && $estatus_global >= 4) {
    $modo = "solo lectura";
}

/* ============================================================
   CARGAR BASE SAP
============================================================ */
$sp = mssql_query("EXEC USP_INVEN_SAP '$almacen_safe', '$fecha', $usuario, '$cia_safe'", $conn);

$base = [];
if ($sp) {
    while ($r = mssql_fetch_assoc($sp)) {
        $codigo = trim($r['Codigo sap']);

        $base[$codigo] = [
            'ItemCode'   => $codigo,
            'Itemname' => json_decode(json_encode($r['Nombre'], JSON_UNESCAPED_UNICODE)),

            'almacen'    => $r['Almacen'],
            'cias'       => $r['CIA'],
            'codebars'   => $r['CodeBars'],
            'cant_sap'   => floatval($r['Inventario_sap']),
            'conteo_mio' => 0,

            'conteo1'     => 0,
            'conteo2'     => 0,
            'conteo3'     => 0,
            'conteo4'     => 0,
        ];
    }
}

/* ============================================================
   CARGAR CONTEOS DEL USUARIO
============================================================ */
$sqlC1 = "
    SELECT c.ItemCode, ct.nro_conteo, ct.cantidad
    FROM CAP_INVENTARIO c
    LEFT JOIN CAP_INVENTARIO_CONTEOS ct ON c.id = ct.id_inventario
    WHERE c.almacen   = '$almacen_safe'
      AND c.fecha_inv = '$fecha'
      AND c.usuario   = '$usuario'
      AND c.cias = '$cia_safe'

";
$resC1 = mssql_query($sqlC1, $conn);

if ($resC1) {
    while ($r = mssql_fetch_assoc($resC1)) {
        $codigo = trim($r['ItemCode']);
        $nro    = intval($r['nro_conteo']);
        $cant   = floatval($r['cantidad']);

        if (!isset($base[$codigo])) continue;

        if ($nro === 1) $base[$codigo]['conteo1'] = $cant;
        if ($nro === 2) $base[$codigo]['conteo2'] = $cant;
        if ($nro === 3) $base[$codigo]['conteo3'] = $cant;
        if ($nro === 7) $base[$codigo]['conteo4'] = $cant;


        // Solo el conteo que me corresponde (1 ó 2, según CAP_CONTEO_CONFIG)
        if ($nro_conteo_mio !== null && $nro_conteo_mio === $nro) {
            $base[$codigo]['conteo_mio'] = $cant;
        }
    }
}

/* ============================================================
   CARGAR CONTEOS DEL COMPAÑERO (BRIGADA)
============================================================ */
if ($empleado_companero) {
    $sqlC2 = "
        SELECT c.ItemCode, ct.nro_conteo, ct.cantidad
        FROM CAP_INVENTARIO c
        LEFT JOIN CAP_INVENTARIO_CONTEOS ct ON c.id = ct.id_inventario
        WHERE c.almacen   = '$almacen_safe'
          AND c.fecha_inv = '$fecha'
          AND c.usuario   = '$empleado_companero'
          AND c.cias = '$cia_safe'

    ";
    $resC2 = mssql_query($sqlC2, $conn);

    if ($resC2) {
        while ($r = mssql_fetch_assoc($resC2)) {
            $codigo = trim($r['ItemCode']);
            $nro    = intval($r['nro_conteo']);
            $cant   = floatval($r['cantidad']);

            if (!isset($base[$codigo])) continue;

            // Conteo compañero (normalmente el conteo opuesto: 1 vs 2)
            if ($nro === 1) $base[$codigo]['conteo1'] = $cant;
            if ($nro === 2) $base[$codigo]['conteo2'] = $cant;
            $base[$codigo]['conteo_comp'] = $cant;
        }
    }
}

/* ============================================================
   CARGAR CONTEO 3 DEL EMPLEADO ASIGNADO A TERCER CONTEO
============================================================ */
if ($empleado_tercer_conteo) {
    $sqlC3 = "
        SELECT c.ItemCode, ct.nro_conteo, ct.cantidad
        FROM CAP_INVENTARIO c
        LEFT JOIN CAP_INVENTARIO_CONTEOS ct ON c.id = ct.id_inventario
        WHERE c.almacen   = '$almacen_safe'
          AND c.fecha_inv = '$fecha'
          AND c.usuario   = '$empleado_tercer_conteo'
          AND c.cias = '$cia_safe'

    ";
    $resC3 = mssql_query($sqlC3, $conn);

    if ($resC3) {
        while ($r = mssql_fetch_assoc($resC3)) {
            $codigo = trim($r['ItemCode']);
            $nro    = intval($r['nro_conteo']);
            $cant   = floatval($r['cantidad']);

            if (!isset($base[$codigo])) continue;

            if ($nro === 3) {
                $base[$codigo]['conteo3'] = $cant;
            }
        }
    }
}

/* ============================================================
   CARGAR CONTEO 4 (nro_conteo=7) DEL EMPLEADO ASIGNADO
============================================================ */
if ($empleado_cuarto_conteo) {
    $sqlC4 = "
        SELECT c.ItemCode, ct.nro_conteo, ct.cantidad
        FROM CAP_INVENTARIO c
        LEFT JOIN CAP_INVENTARIO_CONTEOS ct ON c.id = ct.id_inventario
        WHERE c.almacen   = '$almacen_safe'
          AND c.fecha_inv = '$fecha'
          AND c.usuario   = '$empleado_cuarto_conteo'
          AND c.cias = '$cia_safe'

    ";
    $resC4 = mssql_query($sqlC4, $conn);

    if ($resC4) {
        while ($r = mssql_fetch_assoc($resC4)) {
            $codigo = trim($r['ItemCode']);
            $nro    = intval($r['nro_conteo']);
            $cant   = floatval($r['cantidad']);

            if (!isset($base[$codigo])) continue;

            if ($nro === 7) {
                $base[$codigo]['conteo4'] = $cant;
            }
        }
    }
}



/* ============================================================
   CALCULAR DIFERENCIAS
============================================================ */
$resultado             = [];
$hay_dif_brigada       = false;
$hay_dif_mio_vs_sap    = false;
$hay_dif_comp_vs_sap   = false;

foreach ($base as $item) {
    $sap  = $item['cant_sap'];
    $mio  = $item['conteo_mio'];
    $comp = $item['conteo_comp'];

    $dif_mio_vs_sap  = round($mio  - $sap, 2);
    $dif_comp_vs_sap = round($comp - $sap, 2);
    $dif_mio_vs_comp = round($mio  - $comp, 2);

    if ($dif_mio_vs_comp != 0) {
        $hay_dif_brigada = true; // hay diferencia entre A y B
    }
    if ($dif_mio_vs_sap != 0)  $hay_dif_mio_vs_sap  = true;
    if ($dif_comp_vs_sap != 0) $hay_dif_comp_vs_sap = true;

    $resultado[] = [
        'ItemCode'        => $item['ItemCode'],
        'Itemname'        => $item['Itemname'],
        'almacen'         => $item['almacen'],
        'cias'            => $item['cias'],
        'usuario'         => $usuario,
        'codebars'        => $item['codebars'],
        'cant_sap'        => $sap,
        'conteo_mio'      => $mio,
        'conteo_comp'     => $comp,
        'conteo1'     => floatval($item['conteo1']),
        'conteo2'     => floatval($item['conteo2']),
        'conteo3'     => floatval($item['conteo3']),
        'conteo4'     => floatval($item['conteo4']),

        'dif_mio_vs_sap'  => $dif_mio_vs_sap,
        'dif_comp_vs_sap' => $dif_comp_vs_sap,
        'dif_mio_vs_comp' => $dif_mio_vs_comp,
    ];
}

/* ============================================================
   RESPUESTA
============================================================ */
echo json_encode([
    "success"                  => true,
    "brigada"                  => $esBrigada,
    "mi_empleado"              => $usuario,
    "mi_nro_conteo"            => $nro_conteo_mio,
    "empleado_companero"       => $empleado_companero,
    "nro_conteo_companero"     => $nro_conteo_companero,
    "nro_conteo"               => $nro_conteo_mio,          // compatibilidad con front actual
    "hay_diferencias_brigada"  => $hay_dif_brigada,
    "hay_dif_mio_vs_sap"       => $hay_dif_mio_vs_sap,
    "hay_dif_comp_vs_sap"      => $hay_dif_comp_vs_sap,
    "tercer_conteo_asignado"   => $tercer_conteo_asignado,
    "empleado_tercer_conteo"   => $empleado_tercer_conteo,
    "estatus_tercer_conteo"    => $estatus_tercer_conteo,
    "estatus_global"           => $estatus_global,
     "modo"                     => $modo,
    "data"                     => $resultado
]);
exit;
?>
