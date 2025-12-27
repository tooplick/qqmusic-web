/**
 * Service Worker - 前端资源缓存
 */

const CACHE_NAME = 'qqmusic-v1';
const STATIC_ASSETS = [
    '/',
    '/static/css/style.css',
    '/static/js/script.js',
    '/static/images/favicon.png'
];

// 安装：预缓存核心资源
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] 预缓存核心资源');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// 激活：清理旧版本缓存
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] 删除旧缓存:', key);
                        return caches.delete(key);
                    })
            );
        })
    );
    self.clients.claim();
});

// 请求拦截：缓存优先策略（静态资源），网络优先策略（API）
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API 请求：始终走网络
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // 静态资源：缓存优先
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) {
                // 后台更新缓存
                fetch(event.request).then(response => {
                    if (response.ok) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, response);
                        });
                    }
                }).catch(() => { });
                return cached;
            }

            // 无缓存：网络请求并缓存
            return fetch(event.request).then(response => {
                if (response.ok && url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff2?)$/)) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            });
        })
    );
});
