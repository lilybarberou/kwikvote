self.addEventListener("install", () => {
  // Skip over the "waiting" lifecycle state, to ensure that our
  // new service worker is activated immediately, even if there's
  // another tab open controlled by our older service worker code.
  self.skipWaiting();
});

self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();

    // keeps the service worker alive until the notification is shown, or the
    // browser can drop it (or show its own "updated in the background" one)
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icons/icon-192x192.png",
        tag: data.link,
      }),
    );
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
