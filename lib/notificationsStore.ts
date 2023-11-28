import { create } from 'zustand';

type Store = {
    subscriptionEndpoint: string | null;
    notificationsSupported: boolean;
    notificationsPermission: NotificationPermission;
    setSubscriptionEndpoint: (endpoint: string | null) => void;
    init: (obj: { notificationsSupported: boolean; notificationsPermission: NotificationPermission; endpoint: string | null }) => void;
};

export const useNotificationsStore = create<Store>()((set, get) => ({
    subscriptionEndpoint: null,
    notificationsSupported: false,
    notificationsPermission: 'default',
    setSubscriptionEndpoint: (endpoint) => set({ subscriptionEndpoint: endpoint }),
    init: ({ notificationsSupported, notificationsPermission, endpoint }) =>
        set({ notificationsSupported, notificationsPermission, subscriptionEndpoint: endpoint }),
}));
