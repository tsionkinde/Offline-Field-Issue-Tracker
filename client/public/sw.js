
const CACHE_NAME = "field-tracker-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Cache the application page.
      await cache.add("/index.html");

      // Cache all CSS and JavaScript assets.
      const response = await fetch("/index.html");
      const html = await response.text();

      const assets = [
        ...html.matchAll(/(?:src|href)="([^"]+)"/g),
      ]
        .map((match) => match[1])
        .filter((path) => path.startsWith("/assets/"));

      await cache.addAll(assets);
    })()
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("field-tracker-") &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok && request.destination !== "document") {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        if (request.mode === "navigate") {
          return (
            await caches.match("/index.html")
          ) || Response.error();
        }

        return Response.error();
      }
    })()
  );
});
