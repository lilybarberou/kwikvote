declare namespace NodeJS {
    interface ProcessEnv {
        NEXT_PUBLIC_VAPID_EMAIL: string;
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: string;
        VAPID_PRIVATE_KEY: string;
        DATABASE_URL: string;
        DOMAIN: string;
    }
}
