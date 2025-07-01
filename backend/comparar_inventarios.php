<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Parámetros esperados
$almacen  = isset($_GET['almacen']) ? $_GET['almacen'] : null;
$fecha    = isset($_GET['fecha']) ? $_GET['fecha'] : null;
$usuario  = isset($_GET['usuario']) ? $_GET['usuario'] : null;

if (!$almacen || !$fecha || !$usuario) {
  echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
  exit;
}

// Conexión SQL Server
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

// Log para depuración
//file_put_contents("debug_log.txt", "Comparación - Almacen: $almacen | Fecha: $fecha | Usuario: $usuario\n", FILE_APPEND);

// Ejecutar SP de SAP
$sp = mssql_query("EXEC [USP_INVEN_SAP] '$almacen', '$fecha'", $conn);
if (!$sp) {
  $error = mssql_get_last_message();
  //file_put_contents("debug_log.txt", "Error SP: $error\n", FILE_APPEND);
  echo json_encode(["success" => false, "error" => "Error en SP: $error"]);
  exit;
}

// Leer datos de SAP
$inventarioSAP = [];
while ($row = mssql_fetch_assoc($sp)) {
  $codigo = trim($row['Codigo sap']);
  $inventarioSAP[$codigo] = [
    'codigo' => $codigo,
    'nombre' => $row['Nombre'],
    'inventario_sap' => floatval($row['Inventario_sap']),
    'cant_invfis' => 0,
  ];
}

// Consultar CAP_INVENTARIO
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
    // Caso raro: no está en SAP pero sí en físico
    $inventarioSAP[$codigo] = [
      'codigo' => $codigo,
      'nombre' => '',
      'inventario_sap' => 0,
      'cant_invfis' => $cant,
    ];
  }
}

// Obtener estatus del usuario para esa captura
$resEstatus = mssql_query("
  SELECT TOP 1 estatus
  FROM CAP_INVENTARIO
  WHERE almacen = '$almacen' AND fecha_inv = '$fecha' AND usuario = '$usuario'
", $conn);

$estatus = 0; // por default
if ($resEstatus && $rowEst = mssql_fetch_assoc($resEstatus)) {
  $estatus = intval($rowEst['estatus']);
}

// Calcular diferencias
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
