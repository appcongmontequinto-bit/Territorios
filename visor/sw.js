// SERVICE WORKER — Visor Montequinto — /visor/sw.js
const CACHE = 'visor-v1.4';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => 
      Promise.allSettled([
        c.add('./index.html'),
        c.add('./'),
      ])
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Supabase — always network
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', {status:503})));
    return;
  }

  // CDN — cache first
  const cdns = ['unpkg.com','cdn.jsdelivr.net','cdnjs.cloudflare.com','cartocdn.com','arcgisonline.com','openstreetmap.org'];
  if (cdns.some(d => url.hostname.includes(d))) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => new Response('',{status:503})))
    );
    return;
  }

  // Navigation — network first, fall back to cached index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => { if(res.ok) caches.open(CACHE).then(c=>c.put(e.request,res.clone())); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else — network first with cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => { if(res.ok) caches.open(CACHE).then(c=>c.put(e.request,res.clone())); return res; })
      .catch(() => caches.match(e.request))
  );
});
