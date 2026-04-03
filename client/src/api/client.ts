import axios, { type AxiosError } from "axios";

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

function toApiError(error: AxiosError): ApiError {
  const data = error.response?.data;
  const msg =
    typeof data === "object" && data !== null && "error" in data
      ? String((data as { error: unknown }).error)
      : error.message;
  return new ApiError(msg || "Request failed", error.response?.status ?? 0, data);
}

export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      window.location.replace("/login");
    }
    return Promise.reject(toApiError(error));
  },
);
