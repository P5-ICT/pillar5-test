import type { AdminFile, AdminList, AttemptState, FileInfo, PublicConfig } from "./types";

const STUDENT_KEY = "p5.token";
const ADMIN_KEY = "p5.admin";

function read(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function write(storage: "local" | "session", key: string, value: string | null) {
  try {
    const s = storage === "local" ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* storage can be blocked in private windows. The test still works for this visit. */
  }
}

export const studentToken = {
  get: () => read("local", STUDENT_KEY),
  set: (v: string | null) => write("local", STUDENT_KEY, v),
};
export const adminToken = {
  get: () => read("session", ADMIN_KEY),
  set: (v: string | null) => write("session", ADMIN_KEY, v),
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0].msg === "string") {
      return String(detail[0].msg).replace(/^Value error, /, "");
    }
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && typeof init.body === "string") headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your internet connection.");
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) throw new ApiError(response.status, messageFrom(body, `Something went wrong (${response.status}).`));
  return body as T;
}

/* ---------- student ---------- */
export const getConfig = () => request<PublicConfig>("/api/config");

export const startAttempt = (first_name: string, surname: string) =>
  request<{ token: string; attempt: AttemptState }>("/api/attempts", {
    method: "POST",
    body: JSON.stringify({ first_name, surname }),
  });

export const getAttempt = (token: string) => request<AttemptState>("/api/attempt", {}, token);

export const saveAnswer = (token: string, question_id: number, choice: number) =>
  request<{ ok: boolean }>(
    "/api/attempt/answers",
    { method: "PUT", body: JSON.stringify({ question_id, choice }) },
    token,
  );

export const uploadFile = (token: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return request<{ files: FileInfo[]; skipped: string[] }>("/api/attempt/files", { method: "POST", body: form }, token);
};

export const removeFile = (token: string, id: number) =>
  request<{ files: FileInfo[] }>(`/api/attempt/files/${id}`, { method: "DELETE" }, token);

export const submitAttempt = (token: string) =>
  request<AttemptState>("/api/attempt/submit", { method: "POST" }, token);

/* ---------- facilitator ---------- */
export const adminLogin = (password: string) =>
  request<{ token: string }>("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });

export const adminList = (token: string) => request<AdminList>("/api/admin/attempts", {}, token);

export const adminDetail = (token: string, id: number) =>
  request<{ id: number; files: AdminFile[] }>(`/api/admin/attempts/${id}`, {}, token);

export const adminMark = (token: string, id: number, b_mark: number) =>
  request<{ ok: boolean }>(
    `/api/admin/attempts/${id}/mark`,
    { method: "PUT", body: JSON.stringify({ b_mark }) },
    token,
  );

export const adminDelete = (token: string, id: number) =>
  request<{ ok: boolean }>(`/api/admin/attempts/${id}`, { method: "DELETE" }, token);

export async function adminCsv(token: string): Promise<Blob> {
  const response = await fetch("/api/admin/export.csv", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status, "Could not download the results.");
  return response.blob();
}
