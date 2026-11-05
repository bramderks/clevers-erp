self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Clevers", {
      body: data.body || "",
      icon: "/logo.png",
      badge: "/logo.png",
      data: {
        href: data.href || "/dashboard",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/dashboard";

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    for (const client of clients) {
      const url = new URL(client.url);
      if (url.origin === self.location.origin) {
        await client.focus();
        if (url.pathname !== href) {
          await client.navigate(href);
        }
        return;
      }
    }

    await self.clients.openWindow(href);
  })());
});
