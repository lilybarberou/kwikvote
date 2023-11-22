'use client';

import { useEffect, useState } from 'react';

export default function Home() {
    const [ok, setOk] = useState(false);

    useEffect(() => {
        const notificationsSupported = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
        setOk(notificationsSupported());
    }, []);

    if (!ok) {
        return <p>Please install this app on your home screen first!</p>;
    }

    const requestPermission = async () => {
        if (!ok) {
            return;
        }

        const receivedPermission = await window?.Notification.requestPermission();

        if (receivedPermission === 'granted') {
            subscribe();
        }
    };

    return <button onClick={requestPermission}>Recevoir les notifications</button>;
}

const saveSubscription = async (subscription: PushSubscription) => {
    const ORIGIN = window.location.origin;
    const BACKEND_URL = `${ORIGIN}/api/push`;

    const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
    });
    return response.json();
};

const subscribe = async () => {
    const swRegistration = await resetServiceWorker();

    try {
        const options = {
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            userVisibleOnly: true,
        };

        const subscription = await swRegistration.pushManager.subscribe(options);

        await saveSubscription(subscription);

        console.log({ subscription });
    } catch (err) {
        console.error('Error', err);
    }
};

export const registerServiceWorker = async () => {
    return navigator.serviceWorker.register('/service.js');
};

export const unregisterServiceWorkers = async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
};

export const resetServiceWorker = async () => {
    await unregisterServiceWorkers();
    return registerServiceWorker();
};
