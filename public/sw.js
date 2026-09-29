// Push: sayfa kapalıyken / ekran kilitliyken "sıra size geldi" bildirimi. Sunucu çağırma anında gönderir (src/push.js).
self.addEventListener("push", (e) => {
  const m = e.data?.json() ?? {};
  e.waitUntil(self.registration.showNotification(m.title ?? "Sıra size geldi!", {
    body: m.body, tag: m.tag, data: { url: m.url ?? "/" },
    icon: "/icons/icon-192.png", badge: "/icons/icon-192.png",
    vibrate: [500, 200, 500, 200, 500], requireInteraction: true, renotify: !!m.tag,
  }));
});

// Bildirime dokununca açık sekmeye geç, yoksa sıra sayfasını aç
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => new URL(c.url).pathname === "/join");
    return open ? open.focus() : clients.openWindow(e.notification.data?.url ?? "/");
  }));
});
