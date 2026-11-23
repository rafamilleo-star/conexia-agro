// Service worker do CONÉXIA (PWA).
// Estratégia conservadora: guarda somente o "casco" do app (HTML, ícones, manifesto).
// NUNCA intercepta chamadas ao Supabase, APIs, Gemini ou OpenAI, para não
// servir dados antigos nem interferir em login e sessões.

const VERSION = "conexia-pwa-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("conexia-pwa-") && k !== SHELL_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Só o próprio domínio. Qualquer outra origem (Supabase, APIs) passa direto.
  if (url.origin !== self.location.origin) return;

  // Navegação (abrir o app): rede primeiro, cache como reserva offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Ícones e manifesto: cache primeiro.
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
  // Demais arquivos (JS/CSS com hash do Vite) seguem direto para a rede.
});

// Lembretes (Web Push): mostra a notificação com o texto enviado pelo servidor.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "CONÉXIA";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "agenda-diaria",
      data: { url: data.url || "/" },
    })
  );
});

// Ao tocar na notificação, abre ou foca o app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
