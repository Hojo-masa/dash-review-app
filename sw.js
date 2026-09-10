// Dash — minimal service worker (ホーム画面インストールを有効にするため)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
// ネットワークをそのまま通す（オフラインキャッシュはしない＝常に最新を取得）
self.addEventListener('fetch', () => {});
