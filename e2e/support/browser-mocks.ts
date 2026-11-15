// Runs in the page before its scripts (context.addInitScript): replaces the
// Notification, service worker and push APIs with doubles, so that the app
// "subscribes" with a fake subscription instead of a real push service.
// The permission and the subscription survive reloads (localStorage).
export const installPushMock = ({
  endpoint,
  keys,
}: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) => {
  const storage = {
    get: (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
  };
  const PERMISSION = "__e2e_notification_permission";
  const SUBSCRIBED = "__e2e_push_subscribed";

  class FakeNotification {
    static get permission() {
      return storage.get(PERMISSION) ?? "default";
    }
    static async requestPermission() {
      storage.set(PERMISSION, "granted");
      return "granted";
    }
  }

  const subscription = {
    endpoint,
    expirationTime: null,
    options: {},
    getKey: () => null,
    toJSON: () => ({ endpoint, expirationTime: null, keys }),
    unsubscribe: async () => {
      storage.set(SUBSCRIBED, "");
      return true;
    },
  };
  const registration = {
    scope: location.origin + "/",
    active: { state: "activated" },
    pushManager: {
      subscribe: async () => {
        storage.set(SUBSCRIBED, "1");
        return subscription;
      },
      getSubscription: async () =>
        storage.get(SUBSCRIBED) ? subscription : null,
      permissionState: async () =>
        FakeNotification.permission === "granted" ? "granted" : "prompt",
    },
  };
  const serviceWorker = {
    controller: null,
    ready: Promise.resolve(registration),
    register: async () => registration,
    getRegistration: async () => registration,
    getRegistrations: async () => [registration],
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  Object.defineProperty(window, "Notification", {
    value: FakeNotification,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(Navigator.prototype, "serviceWorker", {
    get: () => serviceWorker,
    configurable: true,
  });
};
