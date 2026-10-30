export type Row = Record<string, any>;
export type User = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "COORDINATOR" | "TEACHER" | "STUDENT";
  roles?: User["role"][];
  must_change_password: boolean;
};
let token = "";
export async function csrf() {
  const r = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  if (!r.ok) throw Error("No se pudo iniciar una sesión segura.");
  token = (await r.json()).token;
}
export async function api<T = Row[]>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (method !== "GET" && !token) await csrf();
  const headers: Record<string, string> = {};
  if (method !== "GET") headers["X-XSRF-TOKEN"] = token;
  if (
    body !== undefined &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams)
  )
    headers["Content-Type"] = "application/json";
  const r = await fetch("/api" + url, {
    method,
    credentials: "same-origin",
    headers,
    body:
      body instanceof FormData || body instanceof URLSearchParams
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  if (!r.ok) {
    let message =
      r.status === 401
        ? "Tu sesión terminó o las credenciales son incorrectas."
        : r.status === 403
          ? "No tienes autorización para esta operación."
          : "No se pudo completar la operación.";
    try {
      const j = await r.json();
      if (j.message) message = j.message;
    } catch {}
    throw Error(message);
  }
  return r.status === 204 || r.headers.get("content-length") === "0"
    ? (undefined as T)
    : r.headers.get("content-type")?.includes("json")
      ? await r.json()
      : (undefined as T);
}
export async function upload(course: number, purpose: string, file: File) {
  const form = new FormData();
  form.set("purpose", purpose);
  form.set("file", file);
  return api<Row>(`/courses/${course}/files`, "POST", form);
}
export async function login(email: string, password: string) {
  await csrf();
  await api("/auth/login", "POST", new URLSearchParams({ email, password }));
  await csrf();
  return api<User>("/auth/me");
}
export const roles: Record<User["role"], string> = {
  STUDENT: "Alumno",
  TEACHER: "Maestro",
  COORDINATOR: "Coordinador",
  ADMIN: "Administrador",
};
export const date = (v: string) =>
  new Date(v).toLocaleDateString("es-GT", { day: "numeric", month: "short" });
export const datetime = (v: string) =>
  new Date(v).toLocaleString("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export const hasRole = (user: User | null, role: User["role"]) =>
  !!user && (user.roles ?? [user.role]).includes(role);
