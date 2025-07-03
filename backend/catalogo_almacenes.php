<?php
header('Content-Type: application/json');

$cia = isset($_GET['cia']) ? trim($_GET['cia']) : null;

if (!$cia) {
  echo json_encode(['success' => false, 'error' => 'Falta parámetro cia']);
  exit;
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS";

$conn = mssql_connect($server, $user, $pass);
if (!$conn) {
  echo json_encode(['success' => false, 'error' => 'No se pudo conectar a la base de datos']);
  exit;
}

mssql_select_db($db, $conn);

$sql = "EXEC [dbo].[USP_ALMACENES_SAP_CIAS] '$cia'";
$res = mssql_query($sql, $conn);

if (!$res) {
  echo json_encode(['success' => false, 'error' => 'Error en la consulta: ' . mssql_get_last_message()]);
  exit;
}

$data = [];
while ($row = mssql_fetch_assoc($res)) {
  $data[] = [
    'codigo' => utf8_encode($row['Codigo Almacen']),
    'nombre' => utf8_encode($row['Nombre'])
  ];
}

echo json_encode(['success' => true, 'data' => $data]);
exit;
