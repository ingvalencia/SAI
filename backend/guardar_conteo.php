<?php
// --- Encabezados para CORS y JSON ---
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// --- Parámetros recibidos ---
$id_inventario = isset($_POST['id_inventario']) ? intval($_POST['id_inventario']) : null;
$nro_conteo    = isset($_POST['nro_conteo'])    ? intval($_POST['nro_conteo'])    : null;
$cantidad      = isset($_POST['cantidad'])      ? floatval($_POST['cantidad'])    : null;
$usuario       = isset($_POST['usuario'])       ? trim($_POST['usuario'])         : null;



// --- Validar parámetros obligatorios ---
if ($id_inventario === null || $nro_conteo === null || $cantidad === null || $usuario === null) {
    echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
    exit;
}

// --- Validar rango de conteo ---
if (!in_array($nro_conteo, [1, 2, 3, 7])) {

    echo json_encode(["success" => false, "error" => "Número de conteo inválido"]);
    exit;
}

// --- Conexión a SQL Server ---
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

/* ===========================================================
   1. Obtener id interno del usuario (tabla usuarios)
=========================================================== */
$sqlUID = "
    SELECT TOP 1 id
    FROM usuarios
    WHERE empleado = '$usuario'
";
$resUID = mssql_query($sqlUID, $conn);

if (!$resUID || mssql_num_rows($resUID) === 0) {
    echo json_encode(["success" => false, "error" => "Usuario no encontrado"]);
    exit;
}

$rowUID = mssql_fetch_assoc($resUID);
$usuario_id = intval($rowUID['id']);

/* ===========================================================
   2. Validar si el usuario está BLOQUEADO (estatus = 1)
=========================================================== */
if ($nro_conteo == 3) {

    $sqlBlock = "
        SELECT TOP 1 estatus
        FROM CAP_CONTEO_CONFIG
        WHERE usuarios_asignados LIKE '%$usuario_id%'
          AND estatus = 1
          AND cia = (SELECT cias FROM CAP_INVENTARIO WHERE id = $id_inventario)
          AND almacen = (SELECT almacen FROM CAP_INVENTARIO WHERE id = $id_inventario)
          AND fecha_asignacion = (
              SELECT CONVERT(date, fecha_inv)
              FROM CAP_INVENTARIO
              WHERE id = $id_inventario
          )
    ";

    $resBlock = mssql_query($sqlBlock, $conn);

    if ($resBlock && mssql_num_rows($resBlock) > 0) {
        echo json_encode([
            "success" => false,
            "error"   => "Usuario bloqueado: otro usuario realizará el tercer conteo."
        ]);
        exit;
    }
}

$sqlAsign = "
    SELECT TOP 1 nro_conteo
    FROM CAP_CONTEO_CONFIG
    WHERE usuarios_asignados LIKE '%$usuario_id%'
      AND estatus = 0
      AND cia = (SELECT cias FROM CAP_INVENTARIO WHERE id = $id_inventario)
      AND almacen = (SELECT almacen FROM CAP_INVENTARIO WHERE id = $id_inventario)
      AND fecha_asignacion = (
          SELECT CONVERT(date, fecha_inv)
          FROM CAP_INVENTARIO
          WHERE id = $id_inventario
      )
    ORDER BY id DESC
";

$resAsign = mssql_query($sqlAsign, $conn);

if (!$resAsign || mssql_num_rows($resAsign) === 0) {
    echo json_encode([
        "success" => false,
        "error"   => "No tiene asignado ningún conteo activo."
    ]);
    exit;
}

$rowAsign = mssql_fetch_assoc($resAsign);
$nro_conteo_asignado = intval($rowAsign['nro_conteo']);

if ($nro_conteo_asignado !== $nro_conteo) {
    echo json_encode([
        "success" => false,
        "error"   => "Intento inválido: debe capturar el conteo $nro_conteo_asignado."
    ]);
    exit;
}

/* ===========================================================
   4. Verificar si ya existe registro en CAP_INVENTARIO_CONTEOS
=========================================================== */
$existe = mssql_query("
  SELECT COUNT(*) AS total
  FROM CAP_INVENTARIO_CONTEOS
  WHERE id_inventario = $id_inventario AND nro_conteo = $nro_conteo
", $conn);

$row = mssql_fetch_assoc($existe);


if ($row && intval($row['total']) > 0) {

    // --- UPDATE ---
    $sql = "
        UPDATE CAP_INVENTARIO_CONTEOS
        SET cantidad = $cantidad,
            usuario = '$usuario',
            fecha   = GETDATE()
        WHERE id_inventario = $id_inventario AND nro_conteo = $nro_conteo
    ";

} else {

    // --- INSERT ---
    $sql = "
        INSERT INTO CAP_INVENTARIO_CONTEOS (id_inventario, nro_conteo, cantidad, usuario, fecha)
        VALUES ($id_inventario, $nro_conteo, $cantidad, '$usuario', GETDATE())
    ";

}

// Ejecutar
$res = mssql_query($sql, $conn);

if (!$res) {
    echo json_encode(["success" => false, "error" => "Error SQL: " . mssql_get_last_message()]);
    exit;
}

/* ===========================================================
   5. Actualizar CAP_INVENTARIO.cant_invfis
=========================================================== */
$updInv = "
    UPDATE CAP_INVENTARIO
    SET cant_invfis = $cantidad
    WHERE id = $id_inventario
";
$resInv = mssql_query($updInv, $conn);

if (!$resInv) {
    echo json_encode(["success" => false, "error" => "Error actualizando inventario"]);
    exit;
}

/* ===========================================================
   RESPUESTA OK
=========================================================== */
echo json_encode([
    "success" => true,
    "mensaje" => "Conteo $nro_conteo guardado correctamente"
]);
exit;
?>
