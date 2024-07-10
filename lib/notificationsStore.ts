import { Subscription } from "@prisma/client";
import { create } from "zustand";

export type StoreSub = Omit<Subscription, "createdAt">;

type Store = {
  subscription: StoreSub | null;
  notificationsSupported: boolean;
  notificationsPermission: NotificationPermission;
  setSubscriptionEndpoint: (subscription: StoreSub | null) => void;
  init: (obj: {
    notificationsSupported: boolean;
    notificationsPermission: NotificationPermission;
    subscription: StoreSub | null;
  }) => void;
};

export const useNotificationsStore = create<Store>()((set, get) => ({
  subscription: null,
  notificationsSupported: false,
  notificationsPermission: "default",
  setSubscriptionEndpoint: (subscription) => set({ subscription }),
  init: ({ notificationsSupported, notificationsPermission, subscription }) =>
    set({ notificationsSupported, notificationsPermission, subscription }),
}));
