const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
    window.location.hostname === "[::1]" ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

const SERVICE_WORKER_VERSION = "2";

const obtenerBasePath = () => {
  const path = window.location.pathname.toLowerCase();

  if (path.includes("/inventarios_pruebas/")) {
    return "/diniz/inventarios_pruebas";
  }

  if (path.includes("/inventarios/")) {
    return "/diniz/inventarios";
  }

  return "";
};

export function register(config) {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    const basePath = obtenerBasePath();

    const swUrl = basePath
      ? `${basePath}/service-worker.js?v=${SERVICE_WORKER_VERSION}`
      : `/service-worker.js?v=${SERVICE_WORKER_VERSION}`;

    if (isLocalhost) {
      checkValidServiceWorker(swUrl, config);
      return;
    }

    registerValidSW(swUrl, config);
  });
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl, {
      updateViaCache: "none",
    })
    .then((registration) => {
      console.log(
        "SICAF Service Worker registrado:",
        registration.scope
      );

      const activarWaiting = () => {
        if (registration.waiting) {
          registration.waiting.postMessage({
            type: "SKIP_WAITING",
          });
        }
      };

      activarWaiting();

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;

        if (!installingWorker) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state !== "installed") {
            return;
          }

          if (navigator.serviceWorker.controller) {
            console.log("Nueva versión de SICAF disponible.");

            if (config && config.onUpdate) {
              config.onUpdate(registration);
            }

            activarWaiting();
          } else {
            console.log("SICAF disponible como PWA.");

            if (config && config.onSuccess) {
              config.onSuccess(registration);
            }
          }
        };
      };

      registration.update().catch((error) => {
        console.warn(
          "No fue posible verificar actualización de SICAF:",
          error
        );
      });

      const intervaloActualizacion = window.setInterval(() => {
        if (!navigator.onLine) {
          return;
        }

        registration.update().catch((error) => {
          console.warn(
            "No fue posible verificar actualización de SICAF:",
            error
          );
        });
      }, 5 * 60 * 1000);

      window.addEventListener(
        "beforeunload",
        () => {
          window.clearInterval(intervaloActualizacion);
        },
        { once: true }
      );
    })
    .catch((error) => {
      console.error(
        "Error al registrar Service Worker de SICAF:",
        error
      );
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, {
    cache: "no-store",
  })
    .then((response) => {
      const contentType = response.headers.get("content-type");

      const noExiste = response.status === 404;

      const noEsJavaScript =
        contentType &&
        contentType.indexOf("javascript") === -1;

      if (noExiste || noEsJavaScript) {
        navigator.serviceWorker.ready
          .then((registration) => {
            return registration.unregister();
          })
          .then(() => {
            window.location.reload();
          });

        return;
      }

      registerValidSW(swUrl, config);
    })
    .catch(() => {
      console.log(
        "No fue posible validar el Service Worker."
      );
    });
}

export function unregister() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    })
    .catch((error) => {
      console.error(
        "Error al eliminar Service Worker:",
        error
      );
    });
}
