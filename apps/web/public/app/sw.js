// Service worker do app pelo navegador: recebe as notificações da igreja e abre o app ao tocar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const opts = {
    body: d.body || "",
    icon: "/app/icon-192.png",
    badge: "/app/icon-192.png",
    data: { url: d.url || "/app", checkin: d.checkin || null },
  };
  // Pedido de confirmação de presença: botões Sim/Não (Android; no iPhone o toque abre a tela com os botões)
  if (d.checkin) {
    opts.actions = [{ action: "sim", title: "✅ Sim, estou aqui" }, { action: "nao", title: "Não" }];
    opts.tag = "checkin-" + d.checkin;
    opts.requireInteraction = true;
  }
  e.waitUntil(self.registration.showNotification(d.title || "Comunhão", opts));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  if (data.checkin && e.action === "nao") return; // "Não": nada a fazer
  let path = data.url || "/app";
  // "Sim": abre o app já confirmando (o GPS só pode ser lido com o app aberto)
  if (data.checkin && e.action === "sim") path = "/app/presenca?s=" + data.checkin + "&auto=1";
  const url = new URL(path, self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.location.origin + "/app")) { await c.focus(); if ("navigate" in c) await c.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
