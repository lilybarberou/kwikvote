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
    // Android doesn't close the notification when you click on it
    event.notification.close();

    // This looks to see if the current is already open and
    // focuses if it is
    event.waitUntil(
        clients
            .matchAll({
                type: 'window',
            })
            .then(function (clientList) {
                for (var i = 0; i < clientList.length; i++) {
                    var client = clientList[i];
                    if (client.url == '/' && 'focus' in client) return client.focus();
                }
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.tag);
                }
            })
    );
});
