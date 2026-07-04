<?php
header('Content-Type: application/json');
session_name('SAI_SES');
session_start();


$_SESSION = array();
if (ini_get('session.use_cookies')) {
  $p = session_get_cookie_params();
  setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();

echo json_encode(['success' => true]);
exit;
