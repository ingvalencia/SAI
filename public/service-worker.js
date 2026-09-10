const CACHE_VERSION = "sicaf-v1";

const getBasePath = () => {
  const path = self.location.pathname;

  if (path.includes("/inventarios_pruebas/")) {
    return "/diniz/inventarios_pruebas/";
  }

  return "/diniz/inventarios/";
};

const BASE_PATH = getBasePath();

const CACHE_NAME = `${CACHE_VERSION}-${BASE_PATH.replace(/\//g, "_")}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        BASE_PATH,
        `${BASE_PATH}index.html`,
        `${BASE_PATH}manifest.json`,
      ]);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName.startsWith("sicaf-") &&
            cacheName !== CACHE_NAME
          ) {
            return caches.delete(cacheName);
          }

          return Promise.resolve();
        })
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
   * Nunca cachear llamadas a la API.
   */
  if (
    url.pathname.includes(
      "/servicios/services/admin_inventarios_sap/"
    )
  ) {
    return;
  }

  /*
   * Solo manejar recursos del propio SICAF.
   */
  if (!url.pathname.startsWith(BASE_PATH)) {
    return;
  }

  /*
   * Para navegación:
   * primero red, después caché.
   */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });

          return response;
        })
        .catch(() => {
          return caches.match(`${BASE_PATH}index.html`);
        })
    );

    return;
  }

  /*
   * Para archivos estáticos:
   * primero red para evitar versiones viejas.
   */
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }

        const copy = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, copy);
        });

        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
