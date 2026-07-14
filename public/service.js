self.addEventListener("install", () => {
  // Skip over the "waiting" lifecycle state, to ensure that our
  // new service worker is activated immediately, even if there's
  // another tab open controlled by our older service worker code.
  self.skipWaiting();
});

self.addEventListener("push", async (event) => {
  if (event.data) {
    const data = await event.data.json();

    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      tag: data.link,
    });
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const notificationUrl = new URL(
    event.notification.tag || "/",
    self.location.origin,
  );
  const targetUrl = new URL(
    `${notificationUrl.pathname}${notificationUrl.search}${notificationUrl.hash}`,
    self.location.origin,
  );

  event.waitUntil(self.clients.openWindow(targetUrl.href));
});
