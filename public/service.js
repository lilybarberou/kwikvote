self.addEventListener('install', () => {
    // Skip over the "waiting" lifecycle state, to ensure that our
    // new service worker is activated immediately, even if there's
    // another tab open controlled by our older service worker code.
    self.skipWaiting();
});

self.addEventListener('push', async (event) => {
    if (event.data) {
        const eventData = await event.data.json();
        showLocalNotification(eventData.title, eventData.body, eventData.link, self.registration);
    }
});

const showLocalNotification = (title, body, link, swRegistration) => {
    swRegistration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        tag: link,
    });
};

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(self.clients.openWindow(event.notification.tag));
});
