let configuracionCache = null;

const normalizarUrl = (url) => {
  if (!url) return "";
  return url.replace(/\/+$/, "");
};

const obtenerAmbienteFallback = () => {
  const path = window.location.pathname.toLowerCase();

  if (path.includes("inventarios_pruebas")) {
    return "desarrollo";
  }

  return "produccion";
};

const obtenerBaseSistema = () => {
  const origin = window.location.origin;
  const pathname = window.location.pathname;

  const rutaLimpia = pathname.endsWith("/")
    ? pathname.replace(/\/+$/, "")
    : pathname.substring(0, pathname.lastIndexOf("/"));

  return `${origin}${rutaLimpia}`;
};

export const cargarConfiguracion = async () => {
  if (configuracionCache) return configuracionCache;

  try {
    const baseSistema = obtenerBaseSistema();

    const response = await fetch(
      `${baseSistema}/configuracion.json?v=${Date.now()}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error("No se pudo cargar configuracion.json");
    }

    const config = await response.json();
    const ambienteLeido = String(config.ambiente || "").toLowerCase();

    const ambiente =
      ambienteLeido === "produccion" || ambienteLeido === "desarrollo"
        ? ambienteLeido
        : obtenerAmbienteFallback();

    const apiDesarrollo = normalizarUrl(process.env.REACT_APP_API_DESARROLLO);
    const apiProduccion = normalizarUrl(process.env.REACT_APP_API_PRODUCCION);

    const apiBaseUrl = ambiente === "produccion" ? apiProduccion : apiDesarrollo;

    configuracionCache = {
      ambiente,
      apiBaseUrl,
      esProduccion: ambiente === "produccion",
      esDesarrollo: ambiente === "desarrollo",
    };

    return configuracionCache;
  } catch (error) {
    const ambiente = obtenerAmbienteFallback();

    const apiDesarrollo = normalizarUrl(process.env.REACT_APP_API_DESARROLLO);
    const apiProduccion = normalizarUrl(process.env.REACT_APP_API_PRODUCCION);

    const apiBaseUrl = ambiente === "produccion" ? apiProduccion : apiDesarrollo;

    configuracionCache = {
      ambiente,
      apiBaseUrl,
      esProduccion: ambiente === "produccion",
      esDesarrollo: ambiente === "desarrollo",
    };

    return configuracionCache;
  }
};

export const endpoint = async (archivo) => {
  const config = await cargarConfiguracion();
  return `${config.apiBaseUrl}/${archivo.replace(/^\/+/, "")}`;
};
