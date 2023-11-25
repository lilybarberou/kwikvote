'use client';

import { resetServiceWorker, unregisterServiceWorkers } from '@/utils/service-worker';
import { useEffect, useState } from 'react';

export default function Home() {
    const requestPermission = async () => {
        const notificationsSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

        if (!notificationsSupported) {
            throw new Error('Les notifications ne sont pas supportées par votre navigateur');
        }

        const receivedPermission = await window.Notification.requestPermission();

        if (receivedPermission !== 'granted') {
            throw new Error('Veuillez autoriser les notifications pour utiliser cette fonctionnalité');
        }
    };

    const enableNotifications = async () => {
        try {
            await requestPermission();
            await subscribe();
        } catch (err) {
            alert(err);
        }
    };

    const getSubscriptionEndpoint = async () => {
        const subscription = await navigator.serviceWorker.ready.then((registration) => {
            return registration.pushManager.getSubscription();
        });

        console.log(
            subscription?.endpoint ===
                'https://fcm.googleapis.com/fcm/send/crcwQ1gSQM8:APA91bFGrz5Jju8gFqZA8_12GRXUmyjdZf6qxpuqd4VMwF2RuhVS2M6r0VlKzaogY3BVmMA1UgecYH_9ZlGhOdM-zwEXXFemdKhJ8GpmAlaRfWhYvoKyKKFVfwGD9kOKG6wsMfpBNMhr'
        );
        return subscription?.endpoint ?? undefined;
    };

    const createPoll = async () => {
        const pollTitle = document.getElementById('test')?.value;
        fetch('/api/poll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title: pollTitle }),
        })
            .then((res) => res.json())
            .then((data) => console.log(data));
    };

    const getPollById = async () => {
        const res = await fetch('/api/poll/042c020c-2443-4a2f-b75a-6d1e01c81119');
        const data = await res.json();
        console.log(data);
    };

    return (
        <div className="flex flex-col w-fit">
            <button onClick={enableNotifications}>Activer les notifications</button>
            <button onClick={getSubscriptionEndpoint}>Voir subscription ID</button>
            <input id="test" />
            <button onClick={createPoll}>Créer poll</button>
            <button onClick={getPollById}>Poll by id</button>
        </div>
    );
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
    const swRegistration = await navigator.serviceWorker.register('/service.js');

    const options = {
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        userVisibleOnly: true,
    };

    const subscription = await swRegistration.pushManager.subscribe(options);
    // await saveSubscription(subscription);
};
