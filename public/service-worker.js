/* eslint-disable no-restricted-globals */

const CACHE_VERSION = "sicaf-v2";

const getBasePath = () => {
  const path = self.location.pathname.toLowerCase();

  if (path.includes("/inventarios_pruebas/")) {
    return "/diniz/inventarios_pruebas/";
  }

  return "/diniz/inventarios/";
};

const BASE_PATH = getBasePath();

const AMBIENTE = BASE_PATH.includes("inventarios_pruebas")
  ? "pruebas"
  : "produccion";

const CACHE_PREFIX = `sicaf-${AMBIENTE}-`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        BASE_PATH,
        `${BASE_PATH}index.html`,
        `${BASE_PATH}manifest.json`,
      ])
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName.startsWith(CACHE_PREFIX) &&
              cacheName !== CACHE_NAME
            ) {
              return caches.delete(cacheName);
            }

            return Promise.resolve();
          })
        )
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (
    url.pathname.includes(
      "/servicios/services/admin_inventarios_sap/"
    )
  ) {
    return;
  }

  if (!url.pathname.startsWith(BASE_PATH)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(`${BASE_PATH}index.html`, copy);
            });
          }

          return response;
        })
        .catch(() => caches.match(`${BASE_PATH}index.html`))
    );

    return;
  }

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
      .catch(() => caches.match(request))
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
