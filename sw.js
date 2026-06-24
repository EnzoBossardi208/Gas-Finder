// GasFinder RS — Service Worker
// Versão: 1.0.0
// Atualize este número sempre que modificar este arquivo

const CACHE_NAME = 'gasfinder-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/data.js',
  '/Logo-Gas-Finder-2.0.png',
  '/manifest.json'
];

// ==================== INSTALAÇÃO ====================
// Acontece quando o SW é registrado pela primeira vez
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[GasFinder SW] Cache criado');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Ativa imediatamente sem esperar o usuário fechar o app
  self.skipWaiting();
});

// ==================== ATIVAÇÃO ====================
// Remove caches antigos quando uma nova versão do SW é instalada
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[GasFinder SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Assume controle de todas as abas abertas imediatamente
  self.clients.claim();
});

// ==================== FETCH (ESTRATÉGIA DE CACHE) ====================
// Network first para o Supabase (dados sempre frescos)
// Cache first para assets estáticos (CSS, JS, imagens)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Requisições ao Supabase sempre vão para a rede (dados em tempo real)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para assets estáticos: tenta cache primeiro, depois rede
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Salva no cache apenas respostas válidas
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      // Se falhar tudo (sem internet), retorna a página principal do cache
      if (event.request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});

// ==================== NOTIFICAÇÕES PUSH ====================
// Recebe notificação do servidor (quando posto atualiza preço)
self.addEventListener('push', (event) => {
  let data = {
    title: 'GasFinder RS',
    body: 'Um posto atualizou os preços!',
    icon: '/Logo-Gas-Finder-2.0.png',
    badge: '/Logo-Gas-Finder-2.0.png',
    tag: 'price-update'
  };

  // Se o servidor mandou dados junto com a notificação
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || 'GasFinder RS',
        body: payload.body || 'Preço atualizado!',
        icon: '/Logo-Gas-Finder-2.0.png',
        badge: '/Logo-Gas-Finder-2.0.png',
        tag: payload.tag || 'price-update',
        data: payload.data || {}
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
      data: data.data
    })
  );
});

// ==================== CLIQUE NA NOTIFICAÇÃO ====================
// Abre o app quando o usuário toca na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se o app já está aberto, foca nele
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não está aberto, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
