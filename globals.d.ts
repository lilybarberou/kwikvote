declare namespace NodeJS {
  interface ProcessEnv {
    ADMIN_PASSWORD: string;
    DATABASE_URL: string;
    DOMAIN: string;
    NEXT_PUBLIC_VAPID_EMAIL: string;
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: string;
    PORT: string;
    VAPID_PRIVATE_KEY: string;
  }
}

// Define the generic response type based on SafeAction type
interface ApiResponse<S extends any, Data> {
  data?: Data & CommonResponseData<S>;
  serverError?: string;
  validationErrors?: Partial<Record<keyof Infer<S> | "_root", string[]>>;
}

type GetDataFromAction<TFunc extends (...args: any[]) => any> = NonNullable<
  Awaited<ReturnType<TFunc>>
>["data"];
