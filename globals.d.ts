declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_VAPID_EMAIL: string;
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: string;
    VAPID_PRIVATE_KEY: string;
    DATABASE_URL: string;
    DOMAIN: string;
    ADMIN_PASSWORD: string;
  }
}

// Define the generic response type based on SafeAction type
interface ApiResponse<S extends any, Data> {
  data?: Data & CommonResponseData<S>;
  serverError?: string;
  validationErrors?: Partial<Record<keyof Infer<S> | "_root", string[]>>;
}

type GetDataFromAction<TFunc extends (...args: any[]) => any> = Awaited<
  ReturnType<TFunc>
>["data"];
