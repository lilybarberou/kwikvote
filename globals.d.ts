interface SuccessResponse {
  success: boolean;
  message: string;
}

// Define the generic response type based on SafeAction type
interface ApiResponse<S extends any, Data> {
  data?: Data & CommonResponseData<S>;
  serverError?: string;
  validationErrors?: Partial<Record<keyof Infer<S> | "_root", string[]>>;
}

type GetDataFromAction<TFunc extends (...args: any[]) => any> = NonNullable<
  Exclude<NonNullable<Awaited<ReturnType<TFunc>>>["data"], SuccessResponse>
>;
