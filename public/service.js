self.addEventListener('push', async (event) => {
    if (event.data) {
        const eventData = await event.data.json();
        showLocalNotification(eventData.title, eventData.body, eventData.link, self.registration);
    }
});

const showLocalNotification = (title, body, link, swRegistration) => {
    swRegistration.showNotification(title, {
        body,
        actions: [{ action: link, title: 'Lien du sondage' }],
        icon: '/icons/icon-192.png',
    });
};

self.addEventListener('notificationclick', (event) => {
    // Get the URL to navigate to (in this case, '/home')
    const urlToOpen = new URL(event.action).href;

    // Prevent other listeners from handling the event
    event.notification.close();

    // Open a new window/tab with the specified URL
    event.waitUntil(clients.openWindow(urlToOpen));
});
