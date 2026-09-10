const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
    window.location.hostname === "[::1]" ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

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
      ? `${basePath}/service-worker.js`
      : "/service-worker.js";

    if (isLocalhost) {
      checkValidServiceWorker(swUrl, config);

      navigator.serviceWorker.ready.then(() => {
        console.log("SICAF Service Worker listo en local");
      });

      return;
    }

    registerValidSW(swUrl, config);
  });
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log(
        "SICAF Service Worker registrado:",
        registration.scope
      );

      if (registration.waiting) {
        registration.waiting.postMessage({
          type: "SKIP_WAITING",
        });
      }

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

            if (registration.waiting) {
              registration.waiting.postMessage({
                type: "SKIP_WAITING",
              });
            }
          } else {
            console.log("SICAF disponible como PWA.");

            if (config && config.onSuccess) {
              config.onSuccess(registration);
            }
          }
        };
      };
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
