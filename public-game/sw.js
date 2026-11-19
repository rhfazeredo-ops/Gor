// service worker mínimo: torna o jogo instalável (o navegador busca tudo na rede normalmente)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
