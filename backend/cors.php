<?php
// Lista blanca de orígenes permitidos
$allowed_origins = [
    "http://localhost:3000",
    "https://capturainvgiovanny.loca.lt",
    // agrega otros orígenes si los necesitas
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true"); // si usas cookies/sesiones
} else {
    // Si quieres permitir cualquier origen (solo para pruebas), usa:
    // header("Access-Control-Allow-Origin: *");
}

header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Responder rápido a preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
