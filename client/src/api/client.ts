type RequestOptions = Omit<RequestInit, "body"> & {
    body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers, ...rest } = options;

    const res = await fetch(path, {
        ...rest,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        let message = `Request failed: ${res.status}`;
        try {
            const data = await res.json();
            message = data.message ?? message;
        } catch {
            // ignore parse errors
        }
        throw new Error(message);
    }

    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
}

export const apiClient = {
    get: <T>(path: string, options?: RequestOptions) =>
        request<T>(path, { method: "GET", ...options }),

    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
        request<T>(path, { method: "POST", body, ...options }),

    patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
        request<T>(path, { method: "PATCH", body, ...options }),

    delete: <T>(path: string, options?: RequestOptions) =>
        request<T>(path, { method: "DELETE", ...options }),
};
