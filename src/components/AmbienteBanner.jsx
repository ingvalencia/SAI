import { useEffect, useState } from "react";
import { cargarConfiguracion } from "../config/apiConfig";

const AmbienteBanner = () => {
  const [configuracion, setConfiguracion] = useState(null);

  useEffect(() => {
    let activo = true;

    cargarConfiguracion()
      .then((config) => {
        if (activo) {
          setConfiguracion(config);
        }
      })
      .catch(() => {
        if (activo) {
          setConfiguracion(null);
        }
      });

    return () => {
      activo = false;
    };
  }, []);

  if (!configuracion?.esDesarrollo) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 z-[99999] w-full bg-yellow-400 text-yellow-950 text-center font-bold text-xs sm:text-sm tracking-wide py-2 shadow-lg">
      VERSIÓN DE DESARROLLO / PRUEBAS — NO USAR COMO PRODUCCIÓN
    </div>
  );
};

export default AmbienteBanner;
