const defaultOrigin = "http://127.0.0.1:3001";

export function getAppOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? defaultOrigin;
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p.startsWith("/api")) return `${getAppOrigin()}${p}`;
  return `${getAppOrigin()}/api${p}`;
}

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiText(path: string): Promise<string> {
  const res = await fetch(apiUrl(path), { credentials: "include" });
  const text = await res.text();
  if (!res.ok) {
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : res.statusText;
    throw new ApiError(msg || "Request failed", res.status, data);
  }
  return text;
}

export async function api<T = Json>(
  path: string,
  init?: RequestInit & { json?: Json },
): Promise<T> {
  const { json, headers: hdrs, ...rest } = init ?? {};
  const headers = new Headers(hdrs);
  if (json !== undefined) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(apiUrl(path), {
    credentials: "include",
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : res.statusText;
    throw new ApiError(msg || "Request failed", res.status, data);
  }
  return data as T;
}
