const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
let accessToken: string | null = null;
let refreshRequest: Promise<AuthSession> | null = null;
type AuthSession = { accessToken: string; expiresIn: number };
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: string[],
  ) {
    super(message);
  }
}
export function setAccessToken(token: string | null) {
  accessToken = token;
}
async function requestAccessToken() {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    accessToken = null;
    throw new ApiError("Sesi berakhir", response.status);
  }
  const body = await response.json();
  const session = body.data as AuthSession;
  accessToken = session.accessToken;
  return session;
}
export function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = requestAccessToken().finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    await refreshAccessToken();
    return api<T>(path, init, false);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      body.message ?? "Terjadi kesalahan",
      response.status,
      body.code,
      body.details,
    );
  return body as T;
}
