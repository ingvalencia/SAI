let configuracionCache = null;

const normalizarUrl = (url) => {
  if (!url) return "";
  return url.replace(/\/+$/, "");
};

export const cargarConfiguracion = async () => {
  if (configuracionCache) return configuracionCache;

  try {
    const response = await fetch(`${process.env.PUBLIC_URL}/configuracion.json`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar configuracion.json");
    }

    const config = await response.json();
    const ambiente = String(config.ambiente || "").toLowerCase();

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
    const apiBaseUrl = normalizarUrl(process.env.REACT_APP_API_PRODUCCION);

    configuracionCache = {
      ambiente: "produccion",
      apiBaseUrl,
      esProduccion: true,
      esDesarrollo: false,
    };

    

    return configuracionCache;
  }
};

export const endpoint = async (archivo) => {
  const config = await cargarConfiguracion();
  return `${config.apiBaseUrl}/${archivo.replace(/^\/+/, "")}`;
};
