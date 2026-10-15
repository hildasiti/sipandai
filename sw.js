/* SIPANDAI PWA v4.9 — SIMPAN HANYA BERKAS STATIS, BUKAN DATA PENGGUNA. */
'use strict';
const CACHE='sipandai-static-v4.9-logo6';
const SHELL=['./','./index.html','./styles.css','./app.js','./config.js','./manifest.webmanifest','./icons/sipandai-logo6-192.png','./icons/sipandai-logo6-512.png','./icons/sipandai-logo6-256.png','./icons/favicon-logo6-32.png','./icons/apple-touch-logo6.png'];
const allow=new Set(SHELL.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sipandai-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const r=event.request;
  const url=new URL(r.url);
  if(r.method!=='GET'||url.origin!==self.location.origin||!allow.has(url.origin+url.pathname))return;
  // Frontend selalu mencoba sumber terbaru. Cache hanya cadangan saat offline.
  event.respondWith(fetch(r).then(response=>{
    if(response.ok&&response.type==='basic'){
      const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(r,copy)));
    }
    return response;
  }).catch(()=>caches.match(r,{ignoreSearch:true})));
});
