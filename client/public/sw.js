
const CACHE_NAME = "field-tracker-v2";

// Install and cache the application shell and its assets.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Download the application's HTML.
      const response = await fetch("/index.html");
      const html = await response.clone().text();

      // Save the HTML page.
      await cache.put("/index.html", response);

      // Find CSS and JavaScript files referenced by index.html.
      const assetPaths = [
        ...html.matchAll(/(?:src|href)="([^"]+)"/g),
      ]
        .map((match) => match[1])
        .filter((path) => path.startsWith("/assets/"));

      // Cache all generated CSS and JavaScript files.
      await cache.addAll(assetPaths);

      console.log("Application shell and assets cached.");
    })()
  );

  self.skipWaiting();
});

// Activate the new Service Worker.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith("field-tracker-") &&
            name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

// Handle application requests.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept API requests or non-GET requests.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Handle page navigation.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          return (
            (await caches.match("/index.html")) ||
            Response.error()
          );
        })
    );

    return;
  }

  // Serve cached assets first.
  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        console.error("Offline request failed:", error);
        return Response.error();
      }
    })
  );
});
