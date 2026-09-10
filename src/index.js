import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/*
|--------------------------------------------------------------------------
| SERVICE WORKER / PWA
|--------------------------------------------------------------------------
|
| Se registra el Service Worker respetando la ruta donde está publicado
| SICAF:
|
| DESARROLLO:
| /diniz/inventarios_pruebas/
|
| PRODUCCIÓN:
| /diniz/inventarios/
|
| No se eliminan cachés ni Service Workers manualmente en cada inicio.
|
*/

serviceWorkerRegistration.register({
  onSuccess: (registration) => {
    console.log("SICAF PWA instalada correctamente.", registration);
  },

  onUpdate: (registration) => {
    console.log("Nueva versión de SICAF disponible.");

    const waitingWorker = registration.waiting;

    if (waitingWorker) {
      waitingWorker.postMessage({
        type: "SKIP_WAITING",
      });
    }
  },
});

/*
|--------------------------------------------------------------------------
| ACTUALIZACIÓN AUTOMÁTICA
|--------------------------------------------------------------------------
|
| Si entra una nueva versión del Service Worker, recargamos una sola vez
| para que SICAF utilice los archivos actuales.
|
*/

let refreshing = false;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) {
      return;
    }

    refreshing = true;

    window.location.reload();
  });
}
