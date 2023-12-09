import { Subscription } from '@prisma/client';
import { create } from 'zustand';

type Store = {
    subscription: Subscription | null;
    notificationsSupported: boolean;
    notificationsPermission: NotificationPermission;
    setSubscriptionEndpoint: (subscription: Subscription | null) => void;
    init: (obj: { notificationsSupported: boolean; notificationsPermission: NotificationPermission; subscription: Subscription | null }) => void;
};

export const useNotificationsStore = create<Store>()((set, get) => ({
    subscription: null,
    notificationsSupported: false,
    notificationsPermission: 'default',
    setSubscriptionEndpoint: (subscription) => set({ subscription }),
    init: ({ notificationsSupported, notificationsPermission, subscription }) => set({ notificationsSupported, notificationsPermission, subscription }),
}));
