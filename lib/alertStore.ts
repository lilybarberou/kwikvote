import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Alerts = 'pollLegend';

type Store = {
  alerts: Record<Alerts, boolean>;
  updateAlert: (alert: Alerts, value: boolean) => void;
};

export const useAlertStore = create<Store>()(
  persist(
    (set, get) => ({
      alerts: {
        pollLegend: false,
      },
      updateAlert: (alert, value) => set({ alerts: { ...get().alerts, [alert]: value } }),
    }),
    { name: 'alerts' }
  )
);
