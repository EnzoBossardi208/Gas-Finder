// GasFinder RS — Service Worker
// Versão: 1.1.0

const CACHE_NAME = "gasfinder-v2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./Logo-Gas-Finder-2.0.png",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[GasFinder SW] Cache criado:", CACHE_NAME);
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log("[GasFinder SW] Removendo cache antigo:", name);
            return caches.delete(name);
          }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.hostname.includes("supabase.co")) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches
      .match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
      .catch(() => {
        if (event.request.destination === "document") {
          return caches.match("./index.html");
        }
      }),
  );
});

self.addEventListener("push", (event) => {
  let data = {
    title: "GasFinder RS",
    body: "Um posto atualizou os preços!",
    icon: "./Logo-Gas-Finder-2.0.png",
    badge: "./Logo-Gas-Finder-2.0.png",
    tag: "price-update",
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || "GasFinder RS",
        body: payload.body || "Preço atualizado!",
        icon: "./Logo-Gas-Finder-2.0.png",
        badge: "./Logo-Gas-Finder-2.0.png",
        tag: payload.tag || "price-update",
        data: payload.data || {},
      };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      vibrate: [200, 100, 200],
      data: data.data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow("./");
      }),
  );
});
