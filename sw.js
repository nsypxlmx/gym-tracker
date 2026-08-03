const CACHE="gymtracker-mono-v6";
// las 18 pantallas de arranque de ios no se precachean: cada equipo pide solo la suya,
// y el fetch handler (cache-first para estáticos) la guarda en el primer arranque online
const ASSETS=["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png","./icon-512-maskable.png","./icon-180.png","./icon-32.png","./pdfjs/pdf.min.mjs","./pdfjs/pdf.worker.min.mjs"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{ if(e.request.method!=="GET")return;
  const req=e.request;
  const isHTML = req.mode==="navigate" || (req.headers.get("accept")||"").includes("text/html");
  if(isHTML){
    // network-first: always try fresh HTML, fall back to cache when offline
    e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c)).catch(()=>{});return r;}).catch(()=>caches.match(req).then(h=>h||caches.match("./index.html"))));
  } else {
    // cache-first for static assets (icons, manifest)
    e.respondWith(caches.match(req).then(h=>h||fetch(req).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c)).catch(()=>{});return r;})));
  }
});
