export type InferSchema<T> = T extends { static: infer S }
  ? S
  : T extends Record<string, unknown>
    ? { [K in keyof T]: InferSchema<T[K]> }
    : never;
