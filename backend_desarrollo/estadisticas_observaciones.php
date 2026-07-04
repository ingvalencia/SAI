<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

function limpiar($valor)
{
  return str_replace("'", "''", trim((string)$valor));
}

function responder($data)
{
  echo json_encode($data);
  exit;
}

function obtenerFilas($sql)
{
  $result = mssql_query($sql);

  if (!$result) {
    responder(array(
      "success" => false,
      "error" => "Error SQL",
      "detalle" => mssql_get_last_message()
    ));
  }

  $rows = array();

  while ($row = mssql_fetch_assoc($result)) {
    $rows[] = $row;
  }

  return $rows;
}

function obtenerFila($sql)
{
  $result = mssql_query($sql);

  if (!$result) {
    responder(array(
      "success" => false,
      "error" => "Error SQL",
      "detalle" => mssql_get_last_message()
    ));
  }

  $row = mssql_fetch_assoc($result);

  if (!$row) {
    return array();
  }

  return $row;
}

function normalizarTexto($texto)
{
  $texto = strtolower(trim((string)$texto));
  $texto = str_replace(
    array('á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', 'Á', 'É', 'Í', 'Ó', 'Ú', 'Ñ', 'Ü'),
    array('a', 'e', 'i', 'o', 'u', 'n', 'u', 'a', 'e', 'i', 'o', 'u', 'n', 'u'),
    $texto
  );
  $texto = preg_replace('/\s+/', ' ', $texto);
  return $texto;
}

function limitarTexto($texto, $limite)
{
  $texto = trim((string)$texto);

  if (strlen($texto) <= $limite) {
    return $texto;
  }

  return substr($texto, 0, $limite) . "...";
}

function sumarConteo(&$array, $key)
{
  $key = trim((string)$key);

  if ($key == '') {
    $key = 'Sin dato';
  }

  if (!isset($array[$key])) {
    $array[$key] = 0;
  }

  $array[$key]++;
}

function topArrayConteos($array, $limite)
{
  arsort($array);

  $resultado = array();
  $contador = 0;

  foreach ($array as $key => $total) {
    $resultado[] = array(
      "nombre" => $key,
      "total" => intval($total)
    );

    $contador++;

    if ($contador >= $limite) {
      break;
    }
  }

  return $resultado;
}

function clasificarDescripcion($descripcion, $tipo, $accion)
{
  $texto = normalizarTexto($descripcion . ' ' . $tipo . ' ' . $accion);

  $categorias = array(
    "Diferencias SAP vs físico" => array(
      "sap", "diferencia", "diferencias", "no cuadra", "no coincide", "descuadre", "sobrante", "faltante", "stock", "existencia", "existencias", "fisico", "físico"
    ),
    "Problema de captura" => array(
      "captura", "capturar", "capturado", "cantidad", "cantidades", "mal capturado", "registro incorrecto", "dato incorrecto", "tecleo", "equivoco", "equivocado"
    ),
    "Problema de producto o código" => array(
      "producto", "productos", "articulo", "articulos", "artículo", "artículos", "codigo", "código", "codigo de barras", "código de barras", "barra", "sku", "itemcode", "no aparece", "no existe", "no encontrado"
    ),
    "Problema de almacén o CEF" => array(
      "almacen", "almacén", "almacenes", "cef", "local", "ubicacion", "ubicación", "zona", "area", "área", "anaquel", "pasillo", "bodega"
    ),
    "Problema de usuario o capacitación" => array(
      "usuario", "usuarios", "capturista", "responsable", "personal", "capacitacion", "capacitación", "no sabe", "no entiende", "empleado", "brigada", "supervisor"
    ),
    "Problema técnico del sistema" => array(
      "sistema", "pantalla", "error", "carga", "cargar", "lento", "bloqueo", "bloqueado", "no abre", "no guarda", "guardar", "sesion", "sesión", "servidor", "conexion", "conexión", "internet", "fallo", "bug"
    ),
    "Falta de evidencia" => array(
      "evidencia", "foto", "archivo", "documento", "imagen", "pdf", "comprobante", "sin evidencia", "no adjunto", "adjunto", "captura de pantalla"
    ),
    "Proceso de inventario" => array(
      "proceso", "inventario", "conteo", "primer conteo", "segundo conteo", "tercer conteo", "validacion", "validación", "revision", "revisión", "conciliacion", "conciliación", "cierre", "confirmacion", "confirmación", "finalizado"
    )
  );

  $puntajes = array();

  foreach ($categorias as $categoria => $palabras) {
    $puntajes[$categoria] = 0;

    foreach ($palabras as $palabra) {
      if (strpos($texto, normalizarTexto($palabra)) !== false) {
        $puntajes[$categoria]++;
      }
    }
  }

  arsort($puntajes);

  foreach ($puntajes as $categoria => $puntaje) {
    if ($puntaje > 0) {
      return $categoria;
    }
  }

  return "Sin clasificación clara";
}

$server = "192.168.0.174";
$user   = "sa";
$pass   = "P@ssw0rd";
$db     = "SAP_PROCESOS_DESARROLLO";

$conn = mssql_connect($server, $user, $pass);

if (!$conn) {
  responder(array(
    "success" => false,
    "error" => "No se pudo conectar al servidor SQL"
  ));
}

if (!mssql_select_db($db, $conn)) {
  responder(array(
    "success" => false,
    "error" => "No se pudo seleccionar la base de datos"
  ));
}

$cia = isset($_GET['cia']) ? limpiar($_GET['cia']) : '';
$cef = isset($_GET['cef']) ? limpiar($_GET['cef']) : '';
$fecha_inicio = isset($_GET['fecha_inicio']) ? limpiar($_GET['fecha_inicio']) : '';
$fecha_fin = isset($_GET['fecha_fin']) ? limpiar($_GET['fecha_fin']) : '';

$where = "WHERE activo = 1";

if ($cia != '') {
  $where .= " AND cia = '$cia'";
}

if ($cef != '') {
  $where .= " AND cef = '$cef'";
}

if ($fecha_inicio != '') {
  $where .= " AND CONVERT(VARCHAR(10), fecha_observacion, 120) >= '$fecha_inicio'";
}

if ($fecha_fin != '') {
  $where .= " AND CONVERT(VARCHAR(10), fecha_observacion, 120) <= '$fecha_fin'";
}

$sqlResumen = "
  SELECT
    COUNT(*) AS total_observaciones,
    SUM(CASE WHEN estatus = 'ABIERTA' THEN 1 ELSE 0 END) AS abiertas,
    SUM(CASE WHEN estatus IN ('CERRADA', 'CERRADO', 'FINALIZADA', 'FINALIZADO') THEN 1 ELSE 0 END) AS cerradas,
    SUM(CASE WHEN evidencia_ruta IS NOT NULL AND LTRIM(RTRIM(evidencia_ruta)) <> '' THEN 1 ELSE 0 END) AS con_evidencia,
    COUNT(DISTINCT cef) AS total_cef,
    COUNT(DISTINCT responsable) AS total_responsables,
    COUNT(DISTINCT tipo_observacion) AS total_tipos
  FROM CAP_OBSERVACIONES_PROYECTO
  $where
";

$resumen = obtenerFila($sqlResumen);

$totalObservaciones = isset($resumen['total_observaciones']) ? intval($resumen['total_observaciones']) : 0;
$abiertas = isset($resumen['abiertas']) ? intval($resumen['abiertas']) : 0;
$cerradas = isset($resumen['cerradas']) ? intval($resumen['cerradas']) : 0;
$conEvidencia = isset($resumen['con_evidencia']) ? intval($resumen['con_evidencia']) : 0;

$porcentajeAbiertas = $totalObservaciones > 0 ? round(($abiertas * 100) / $totalObservaciones, 2) : 0;
$porcentajeCerradas = $totalObservaciones > 0 ? round(($cerradas * 100) / $totalObservaciones, 2) : 0;
$porcentajeEvidencia = $totalObservaciones > 0 ? round(($conEvidencia * 100) / $totalObservaciones, 2) : 0;

$sqlObservaciones = "
  SELECT
    cia,
    cef,
    CONVERT(VARCHAR(10), fecha_observacion, 120) AS fecha_observacion,
    responsable,
    tipo_observacion,
    descripcion,
    accion_sugerida,
    evidencia_nombre,
    evidencia_ruta,
    estatus,
    usuario_creacion,
    CONVERT(VARCHAR(19), fecha_creacion, 120) AS fecha_creacion
  FROM CAP_OBSERVACIONES_PROYECTO
  $where
  ORDER BY fecha_observacion DESC, fecha_creacion DESC
";

$observaciones = obtenerFilas($sqlObservaciones);

$clasificaciones = array();
$detalleClasificaciones = array();
$cefPorCategoria = array();
$responsablesPorCategoria = array();
$estatusPorCategoria = array();
$comentariosRelevantes = array();
$comentariosAbiertos = array();
$comentariosSinEvidencia = array();
$palabrasDetectadas = array();

foreach ($observaciones as $obs) {
  $descripcion = isset($obs['descripcion']) ? $obs['descripcion'] : '';
  $tipo = isset($obs['tipo_observacion']) ? $obs['tipo_observacion'] : '';
  $accion = isset($obs['accion_sugerida']) ? $obs['accion_sugerida'] : '';
  $categoria = clasificarDescripcion($descripcion, $tipo, $accion);

  if (!isset($clasificaciones[$categoria])) {
    $clasificaciones[$categoria] = 0;
    $detalleClasificaciones[$categoria] = array();
    $cefPorCategoria[$categoria] = array();
    $responsablesPorCategoria[$categoria] = array();
    $estatusPorCategoria[$categoria] = array();
  }

  $clasificaciones[$categoria]++;

  $cefObs = isset($obs['cef']) && trim($obs['cef']) != '' ? trim($obs['cef']) : 'Sin CEF';
  $responsableObs = isset($obs['responsable']) && trim($obs['responsable']) != '' ? trim($obs['responsable']) : 'Sin responsable';
  $estatusObs = isset($obs['estatus']) && trim($obs['estatus']) != '' ? trim($obs['estatus']) : 'Sin estatus';
  $tieneEvidencia = isset($obs['evidencia_ruta']) && trim($obs['evidencia_ruta']) != '' ? 1 : 0;

  sumarConteo($cefPorCategoria[$categoria], $cefObs);
  sumarConteo($responsablesPorCategoria[$categoria], $responsableObs);
  sumarConteo($estatusPorCategoria[$categoria], $estatusObs);

  $textoNormalizado = normalizarTexto($descripcion . ' ' . $tipo . ' ' . $accion);

  $diccionario = array(
    "SAP" => array("sap", "inventario sap", "stock"),
    "Diferencia" => array("diferencia", "diferencias", "descuadre", "no cuadra", "no coincide"),
    "Captura" => array("captura", "capturar", "capturado", "cantidad", "cantidades"),
    "Producto" => array("producto", "articulo", "artículo", "codigo", "código", "codigo de barras", "código de barras", "sku", "itemcode"),
    "Sistema" => array("sistema", "pantalla", "error", "no guarda", "sesion", "sesión", "servidor", "conexion", "conexión"),
    "Usuario" => array("usuario", "capturista", "responsable", "empleado", "capacitacion", "capacitación"),
    "CEF/Almacén" => array("cef", "almacen", "almacén", "local", "ubicacion", "ubicación", "zona"),
    "Evidencia" => array("evidencia", "foto", "archivo", "documento", "imagen")
  );

  foreach ($diccionario as $etiqueta => $lista) {
    foreach ($lista as $palabra) {
      if (strpos($textoNormalizado, normalizarTexto($palabra)) !== false) {
        sumarConteo($palabrasDetectadas, $etiqueta);
        break;
      }
    }
  }

  $itemDetalle = array(
    "fecha_observacion" => isset($obs['fecha_observacion']) ? $obs['fecha_observacion'] : '',
    "fecha_creacion" => isset($obs['fecha_creacion']) ? $obs['fecha_creacion'] : '',
    "cia" => isset($obs['cia']) ? $obs['cia'] : '',
    "cef" => $cefObs,
    "responsable" => $responsableObs,
    "tipo_observacion" => $tipo,
    "descripcion" => limitarTexto($descripcion, 500),
    "accion_sugerida" => limitarTexto($accion, 350),
    "estatus" => $estatusObs,
    "categoria" => $categoria,
    "evidencia_nombre" => isset($obs['evidencia_nombre']) ? $obs['evidencia_nombre'] : '',
    "evidencia_ruta" => isset($obs['evidencia_ruta']) ? $obs['evidencia_ruta'] : '',
    "tiene_evidencia" => $tieneEvidencia,
    "usuario_creacion" => isset($obs['usuario_creacion']) ? $obs['usuario_creacion'] : ''
  );

  if (count($detalleClasificaciones[$categoria]) < 10) {
    $detalleClasificaciones[$categoria][] = $itemDetalle;
  }

  if (count($comentariosRelevantes) < 15) {
    $comentariosRelevantes[] = $itemDetalle;
  }

  if ($estatusObs == 'ABIERTA' && count($comentariosAbiertos) < 15) {
    $comentariosAbiertos[] = $itemDetalle;
  }

  if ($tieneEvidencia == 0 && count($comentariosSinEvidencia) < 15) {
    $comentariosSinEvidencia[] = $itemDetalle;
  }
}

arsort($clasificaciones);

$problemasDetectados = array();

foreach ($clasificaciones as $categoria => $total) {
  $problemasDetectados[] = array(
    "categoria" => $categoria,
    "total" => intval($total),
    "top_cef" => isset($cefPorCategoria[$categoria]) ? topArrayConteos($cefPorCategoria[$categoria], 3) : array(),
    "top_responsables" => isset($responsablesPorCategoria[$categoria]) ? topArrayConteos($responsablesPorCategoria[$categoria], 3) : array(),
    "top_estatus" => isset($estatusPorCategoria[$categoria]) ? topArrayConteos($estatusPorCategoria[$categoria], 3) : array(),
    "ejemplos" => isset($detalleClasificaciones[$categoria]) ? $detalleClasificaciones[$categoria] : array()
  );
}

$sqlTopTipos = "
  SELECT TOP 10
    tipo_observacion,
    COUNT(*) AS total
  FROM CAP_OBSERVACIONES_PROYECTO
  $where
  GROUP BY tipo_observacion
  ORDER BY COUNT(*) DESC
";

$topTipos = obtenerFilas($sqlTopTipos);

$sqlTopCef = "
  SELECT TOP 10
    cef,
    COUNT(*) AS total
  FROM CAP_OBSERVACIONES_PROYECTO
  $where
  GROUP BY cef
  ORDER BY COUNT(*) DESC
";

$topCef = obtenerFilas($sqlTopCef);

$sqlTopResponsables = "
  SELECT TOP 10
    responsable,
    COUNT(*) AS total
  FROM CAP_OBSERVACIONES_PROYECTO
  $where
  GROUP BY responsable
  ORDER BY COUNT(*) DESC
";

$topResponsables = obtenerFilas($sqlTopResponsables);

$sqlPorEstatus = "
  SELECT
    estatus,
    COUNT(*) AS total
  FROM CAP_OBSERVACIONES_PROYECTO
  $where
  GROUP BY estatus
  ORDER BY COUNT(*) DESC
";

$porEstatus = obtenerFilas($sqlPorEstatus);

$sqlTendencia = "
  SELECT
    CONVERT(VARCHAR(10), fecha_observacion, 120) AS fecha,
    COUNT(*) AS total
  FROM CAP_OBSERVACIONES_PROYECTO
  $where
  GROUP BY CONVERT(VARCHAR(10), fecha_observacion, 120)
  ORDER BY fecha ASC
";

$tendencia = obtenerFilas($sqlTendencia);

$problemaPrincipal = "";
$totalProblemaPrincipal = 0;

if (count($problemasDetectados) > 0) {
  $problemaPrincipal = $problemasDetectados[0]["categoria"];
  $totalProblemaPrincipal = intval($problemasDetectados[0]["total"]);
}

$cefMasAfectado = count($topCef) > 0 && isset($topCef[0]["cef"]) ? $topCef[0]["cef"] : "";
$totalCefMasAfectado = count($topCef) > 0 && isset($topCef[0]["total"]) ? intval($topCef[0]["total"]) : 0;

$responsableMasCargado = count($topResponsables) > 0 && isset($topResponsables[0]["responsable"]) ? $topResponsables[0]["responsable"] : "";
$totalResponsableMasCargado = count($topResponsables) > 0 && isset($topResponsables[0]["total"]) ? intval($topResponsables[0]["total"]) : 0;

$temasDetectados = topArrayConteos($palabrasDetectadas, 10);

$resumenComentarios = "";
$lecturaEjecutiva = "";
$hallazgos = array();
$accionesRecomendadas = array();
$focosRiesgo = array();

if ($totalObservaciones > 0) {
  $resumenComentarios = "Se analizaron $totalObservaciones observaciones activas registradas por los usuarios. ";

  if ($problemaPrincipal != "") {
    $resumenComentarios .= "El patrón dominante en las descripciones es '$problemaPrincipal', con $totalProblemaPrincipal casos detectados. ";
  }

  if ($cefMasAfectado != "") {
    $resumenComentarios .= "El CEF con mayor concentración es '$cefMasAfectado', con $totalCefMasAfectado observaciones. ";
  }

  if ($responsableMasCargado != "") {
    $resumenComentarios .= "El responsable con mayor volumen de seguimiento es '$responsableMasCargado', con $totalResponsableMasCargado observaciones asignadas. ";
  }

  if (count($temasDetectados) > 0) {
    $txtTemas = array();

    foreach ($temasDetectados as $tema) {
      $txtTemas[] = $tema["nombre"] . " (" . $tema["total"] . ")";
    }

    $resumenComentarios .= "Los temas más repetidos dentro de los comentarios son: " . implode(", ", $txtTemas) . ". ";
  }

  if ($problemaPrincipal == "Diferencias SAP vs físico") {
    $lecturaEjecutiva = "Los comentarios apuntan a descuadres entre SAP y el conteo físico. Esto puede venir de carga inicial, ejecución de conteo o conciliación incompleta.";
    $hallazgos[] = "Se detectan reportes relacionados con diferencias entre sistema y físico.";
    $hallazgos[] = "El riesgo principal es cerrar inventario con diferencias no explicadas.";
    $accionesRecomendadas[] = "Cruzar observaciones contra artículos con diferencia antes de cerrar.";
    $accionesRecomendadas[] = "Revisar por CEF si las diferencias se concentran en una familia o ubicación.";
    $focosRiesgo[] = "Conciliación SAP vs físico";
  } elseif ($problemaPrincipal == "Problema de captura") {
    $lecturaEjecutiva = "Los comentarios apuntan a problemas de captura, cantidades incorrectas o registros mal ingresados. El riesgo está en contaminar el inventario desde el origen.";
    $hallazgos[] = "Hay señales de errores al capturar cantidades o datos.";
    $hallazgos[] = "El problema puede repetirse si no se refuerza la validación en pantalla.";
    $accionesRecomendadas[] = "Agregar validaciones de cantidad y confirmaciones para valores atípicos.";
    $accionesRecomendadas[] = "Revisar usuarios con mayor número de incidencias y reforzar capacitación.";
    $focosRiesgo[] = "Calidad de captura";
  } elseif ($problemaPrincipal == "Problema de producto o código") {
    $lecturaEjecutiva = "Los comentarios indican problemas con productos, códigos o artículos no encontrados. El riesgo es capturar sobre artículos incorrectos o dejar producto fuera del conteo.";
    $hallazgos[] = "Hay observaciones relacionadas con producto, código o catálogo.";
    $hallazgos[] = "Puede existir inconsistencia entre catálogo, código de barras y artículo físico.";
    $accionesRecomendadas[] = "Depurar catálogo y validar códigos de barras antes del conteo.";
    $accionesRecomendadas[] = "Generar listado de artículos reportados como no encontrados.";
    $focosRiesgo[] = "Catálogo de artículos";
  } elseif ($problemaPrincipal == "Problema de almacén o CEF") {
    $lecturaEjecutiva = "Los comentarios se concentran en CEF, almacén o ubicación física. El problema puede estar en la operación del punto, no necesariamente en el sistema.";
    $hallazgos[] = "La concentración de observaciones apunta a un CEF o almacén específico.";
    $hallazgos[] = "Puede haber problemas de organización física, ubicación o control operativo.";
    $accionesRecomendadas[] = "Revisar físicamente el CEF con más observaciones.";
    $accionesRecomendadas[] = "Separar observaciones por zona, pasillo o ubicación.";
    $focosRiesgo[] = "Operación por CEF";
  } elseif ($problemaPrincipal == "Problema de usuario o capacitación") {
    $lecturaEjecutiva = "Los comentarios sugieren problemas de ejecución, entendimiento del proceso o capacitación. El sistema puede estar bien, pero el uso operativo no.";
    $hallazgos[] = "Hay señales de dudas, errores de usuario o mala ejecución.";
    $hallazgos[] = "El riesgo es repetir el mismo error en siguientes conteos.";
    $accionesRecomendadas[] = "Capacitar con ejemplos reales tomados de estas observaciones.";
    $accionesRecomendadas[] = "Crear guía rápida por rol y etapa del inventario.";
    $focosRiesgo[] = "Capacitación operativa";
  } elseif ($problemaPrincipal == "Problema técnico del sistema") {
    $lecturaEjecutiva = "Los comentarios apuntan a fallas técnicas de pantalla, carga, guardado, sesión o rendimiento. Esto puede afectar continuidad del conteo.";
    $hallazgos[] = "Hay señales de fallas técnicas que pueden bloquear operación.";
    $hallazgos[] = "El riesgo es perder avance o generar capturas incompletas.";
    $accionesRecomendadas[] = "Revisar logs técnicos en fechas y horarios de observación.";
    $accionesRecomendadas[] = "Priorizar errores de guardado, sesión y carga.";
    $focosRiesgo[] = "Estabilidad técnica";
  } elseif ($problemaPrincipal == "Falta de evidencia") {
    $lecturaEjecutiva = "El problema principal es la falta de respaldo documental. Sin evidencia, las observaciones pierden fuerza para análisis y seguimiento.";
    $hallazgos[] = "Varias observaciones no tienen evidencia adjunta.";
    $hallazgos[] = "El riesgo es no poder comprobar causa, responsable o impacto.";
    $accionesRecomendadas[] = "Hacer obligatoria la evidencia en observaciones críticas.";
    $accionesRecomendadas[] = "Definir qué evidencia aplica por tipo de observación.";
    $focosRiesgo[] = "Trazabilidad documental";
  } elseif ($problemaPrincipal == "Proceso de inventario") {
    $lecturaEjecutiva = "Los comentarios se relacionan con el flujo de inventario: conteos, validación, revisión, conciliación o cierre. El problema está en el proceso completo, no solo en un dato.";
    $hallazgos[] = "Los usuarios reportan fricción dentro del proceso de inventario.";
    $hallazgos[] = "El riesgo es repetir incidencias si no se separa por etapa.";
    $accionesRecomendadas[] = "Separar observaciones por etapa: conteo 1, conteo 2, conteo 3, comparación y cierre.";
    $accionesRecomendadas[] = "Revisar el flujo completo del CEF más afectado antes del siguiente conteo.";
    $focosRiesgo[] = "Flujo operativo de inventario";
  } else {
    $lecturaEjecutiva = "Las observaciones existen, pero los comentarios no tienen suficiente detalle para clasificar causa raíz. El problema está en la calidad de captura de la observación.";
    $hallazgos[] = "Hay observaciones con descripción ambigua o poco accionable.";
    $accionesRecomendadas[] = "Estandarizar tipos de observación y exigir descripción mínima.";
    $focosRiesgo[] = "Calidad de información";
  }

  if ($abiertas > 0) {
    $hallazgos[] = "Hay $abiertas observaciones abiertas pendientes de cierre.";
  }

  if ($abiertas > $cerradas) {
    $hallazgos[] = "Hay más observaciones abiertas que cerradas; el seguimiento está atrasado.";
    $accionesRecomendadas[] = "Priorizar cierre de observaciones abiertas antes de levantar nuevas incidencias.";
    $focosRiesgo[] = "Seguimiento pendiente";
  }

  if ($porcentajeEvidencia < 50) {
    $hallazgos[] = "Solo $porcentajeEvidencia% de las observaciones tiene evidencia adjunta.";
    $accionesRecomendadas[] = "Solicitar evidencia obligatoria para mejorar trazabilidad.";
    $focosRiesgo[] = "Baja evidencia";
  }

  if ($cefMasAfectado != "") {
    $accionesRecomendadas[] = "Hacer revisión focalizada en '$cefMasAfectado' porque concentra el mayor número de reportes.";
  }

  if ($responsableMasCargado != "") {
    $accionesRecomendadas[] = "Validar si '$responsableMasCargado' requiere apoyo, reasignación o cierre de pendientes.";
  }
} else {
  $resumenComentarios = "No hay observaciones activas con los filtros seleccionados.";
  $lecturaEjecutiva = "Sin información para analizar.";
}

responder(array(
  "success" => true,
  "resumen" => array(
    "total_observaciones" => $totalObservaciones,
    "abiertas" => $abiertas,
    "cerradas" => $cerradas,
    "con_evidencia" => $conEvidencia,
    "total_cef" => isset($resumen['total_cef']) ? intval($resumen['total_cef']) : 0,
    "total_responsables" => isset($resumen['total_responsables']) ? intval($resumen['total_responsables']) : 0,
    "total_tipos" => isset($resumen['total_tipos']) ? intval($resumen['total_tipos']) : 0
  ),
  "top_tipos" => $topTipos,
  "top_cef" => $topCef,
  "top_responsables" => $topResponsables,
  "por_estatus" => $porEstatus,
  "tendencia_diaria" => $tendencia,
  "problemas_detectados" => $problemasDetectados,
  "temas_detectados" => $temasDetectados,
  "analisis_global" => array(
    "problema_principal" => $problemaPrincipal,
    "total_problema_principal" => $totalProblemaPrincipal,
    "cef_mas_afectado" => $cefMasAfectado,
    "total_cef_mas_afectado" => $totalCefMasAfectado,
    "responsable_mas_cargado" => $responsableMasCargado,
    "total_responsable_mas_cargado" => $totalResponsableMasCargado,
    "porcentaje_abiertas" => $porcentajeAbiertas,
    "porcentaje_cerradas" => $porcentajeCerradas,
    "porcentaje_evidencia" => $porcentajeEvidencia,
    "recomendacion" => $lecturaEjecutiva,
    "resumen_comentarios" => $resumenComentarios,
    "lectura_ejecutiva" => $lecturaEjecutiva,
    "hallazgos" => $hallazgos,
    "acciones_recomendadas" => $accionesRecomendadas,
    "focos_riesgo" => $focosRiesgo,
    "comentarios_relevantes" => $comentariosRelevantes,
    "comentarios_abiertos" => $comentariosAbiertos,
    "comentarios_sin_evidencia" => $comentariosSinEvidencia
  )
));
?>
