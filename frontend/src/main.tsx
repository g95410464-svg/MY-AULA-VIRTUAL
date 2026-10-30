import React, { useEffect, useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  CalendarDays,
  MessageCircle,
  Megaphone,
  Users,
  Settings,
  BarChart3,
  ShieldCheck,
  LogOut,
  Bell,
  Search,
  ArrowUpRight,
  ArrowLeft,
  Plus,
  Clock,
  ChevronRight,
  FileText,
  Download,
  Send,
  X,
  Menu,
  Sun,
  Moon,
  CheckCircle2,
  Link as LinkIcon,
  Leaf,
  Languages,
  Calculator,
  MoreHorizontal,
  KeyRound,
} from "lucide-react";
import {
  api,
  csrf,
  upload,
  roles,
  date,
  datetime,
  type Row,
  type User,
} from "./api";
import "./style.css";
import LoginScreen from "./LoginScreen";
import { AcademicCalendar } from "./AcademicCalendar";

import type { Field, Dialog } from "./ui";
import { ScheduleView } from "./ScheduleView";
import { DirectMessages } from "./DirectMessages";
import { SubmissionDetail } from "./SubmissionDetail";
import { RoleHierarchy } from "./RoleHierarchy";
import { hasRole } from "./api";

const days = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const emptyCatalog = {
  groups: [],
  people: [],
  period: [],
  grade: [],
  section: [],
  subject: [],
  enrollments: [],
  scopes: [],
  courses: [],
};
const opts = (rows: Row[], label = "name") =>
  rows.map((x) => ({ value: x.id, label: x[label] }));
const safeLink = (url: string) => /^https?:\/\//i.test(url);
function External({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return safeLink(url) ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={14} />
    </a>
  ) : null;
}
function FileLink({
  id,
  name = "Descargar archivo",
}: {
  id: string;
  name?: string;
}) {
  return (
    <a className="file-link" href={`/api/files/${id}`}>
      <Download size={15} />
      {name}
    </a>
  );
}
function Empty({ text = "No hay registros todavía." }: { text?: string }) {
  return (
    <div className="empty">
      <BookOpen size={26} />
      <p>{text}</p>
    </div>
  );
}
function FormDialog({
  dialog,
  onClose,
  onDone,
}: {
  dialog: Dialog;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    document
      .querySelector<HTMLElement>(
        ".dialog input,.dialog select,.dialog textarea",
      )
      ?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key === "Tab") {
        const els = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".dialog button,.dialog input,.dialog select,.dialog textarea",
          ),
        ).filter((x) => !x.hasAttribute("disabled"));
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", h);
    return () => {
      document.removeEventListener("keydown", h);
      old?.focus();
    };
  }, [onClose, busy]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const v: Row = {};
    dialog.fields.forEach(
      (f) =>
        (v[f.key] =
          f.type === "checkbox"
            ? data.has(f.key)
            : f.type === "file"
              ? (data.get(f.key) as File)?.size
                ? data.get(f.key)
                : null
              : f.type === "number" || f.type === "select-number"
                ? Number(data.get(f.key))
                : data.get(f.key)),
    );
    setBusy(true);
    setError("");
    try {
      await dialog.submit(v);
      onDone();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="dialog"
      >
        <div className="section-head">
          <h2 id="dialog-title">{dialog.title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar"
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {dialog.description && <p className="muted">{dialog.description}</p>}
        <form onSubmit={submit}>
          {dialog.fields.map((f) => (
            <label key={f.key}>
              {f.label}
              {f.type === "textarea" ? (
                <textarea
                  aria-label={f.label}
                  name={f.key}
                  required={f.required}
                  defaultValue={f.value}
                  maxLength={20000}
                />
              ) : f.options ? (
                <select
                  aria-label={f.label}
                  name={f.key}
                  required={f.required}
                  defaultValue={f.value ?? f.options[0]?.value ?? ""}
                >
                  <option value="" disabled>
                    Seleccionar…
                  </option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "checkbox" ? (
                <input
                  aria-label={f.label}
                  name={f.key}
                  type="checkbox"
                  defaultChecked={f.value}
                />
              ) : (
                <input
                  aria-label={f.label}
                  name={f.key}
                  type={
                    f.type === "select-number" ? "number" : (f.type ?? "text")
                  }
                  required={f.required}
                  defaultValue={f.type === "file" ? undefined : f.value}
                  min={f.min}
                  max={f.max}
                  minLength={f.type === "password" ? 12 : undefined}
                  maxLength={f.type === "password" ? 72 : undefined}
                  accept={
                    f.type === "file"
                      ? ".pdf,.docx,.pptx,.png,.jpg,.jpeg"
                      : undefined
                  }
                />
              )}
            </label>
          ))}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function App() {
  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState("Inicio"),
    [courses, setCourses] = useState<Row[]>([]),
    [allTasks, setAllTasks] = useState<Row[]>([]),
    [schedules, setSchedules] = useState<Row[]>([]),
    [notices, setNotices] = useState<Row[]>([]),
    [notifications, setNotifications] = useState<Row[]>([]),
    [catalog, setCatalog] = useState<Row>(emptyCatalog),
    [reports, setReports] = useState<Row[]>([]),
    [audit, setAudit] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row | null>(null),
    [tab, setTab] = useState("Actividades"),
    [resources, setResources] = useState<Row[]>([]),
    [messages, setMessages] = useState<Row[]>([]),
    [review, setReview] = useState<{ task: Row; rows: Row[] } | null>(null),
    [submissionDetail, setSubmissionDetail] = useState<Row | null>(null),
    [attachments, setAttachments] = useState<Record<number, Row[]>>({}),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [loading, setLoading] = useState(false),
    [search, setSearch] = useState(""),
    [mobile, setMobile] = useState(false),
    [dark, setDark] = useState(localStorage.getItem("aula-theme") === "dark");
  const staff = user?.role !== "STUDENT",
    manager = user?.role === "ADMIN" || user?.role === "COORDINATOR",
    canTeach = hasRole(user, "TEACHER"),
    classroom = user?.role === "STUDENT" || canTeach;
  const userRef = useRef(user);
  userRef.current = user;
  const clearSession = useCallback(() => {
    userRef.current = null;
    setUser(null);
    setSelected(null);
    setCourses([]);
    setAllTasks([]);
    setSchedules([]);
    setNotices([]);
    setNotifications([]);
    setCatalog(emptyCatalog);
    setReports([]);
    setAudit([]);
    setMessages([]);
    setResources([]);
    setReview(null);
    setSubmissionDetail(null);
    setDialog(null);
    setAttachments({});
    setPage("Inicio");
    setError("");
    setSuccess("");
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("aula-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    csrf()
      .then(() => api<User>("/auth/me"))
      .then((u) => {
        setUser(u);
        if (u.must_change_password) setPage("Mi cuenta");
      })
      .catch(() => {})
      .finally(() => setBoot(false));
  }, []);
  const load = useCallback(async () => {
    if (!user || user.must_change_password) return;
    setLoading(true);
    setError("");
    try {
      const [c, s, n, nt] = await Promise.all([
        api("/courses"),
        api("/schedules"),
        api("/notices"),
        api("/notifications"),
      ]);
      const [tasks, nextCatalog, nextReports, nextAudit] = await Promise.all([
        Promise.all(
          c.map(async (x) =>
            (await api(`/courses/${x.id}/tasks`)).map((t) => ({
              ...t,
              course_name: x.name,
              color: x.color,
              group_name: x.group_name,
            })),
          ),
        ),
        manager ? api<Row>("/catalog") : Promise.resolve(emptyCatalog),
        canTeach ? api("/reports") : Promise.resolve([]),
        user.role === "ADMIN" ? api("/audit") : Promise.resolve([]),
      ]);
      if (userRef.current !== user) return;
      setCourses(c);
      setSchedules(s);
      setNotices(n);
      setNotifications(nt);
      setAllTasks(tasks.flat());
      setCatalog(nextCatalog);
      setReports(nextReports);
      setAudit(nextAudit);
    } catch (e) {
      if (userRef.current === user) setError((e as Error).message);
    } finally {
      if (userRef.current === user) setLoading(false);
    }
  }, [user, manager, canTeach]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!user || user.must_change_password) return;
    let cancelled = false;
    const id = setInterval(() => {
      api("/notifications")
        .then((n) => {
          if (!cancelled) setNotifications(n);
        })
        .catch(() => {});
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setMessages([]);
    setResources([]);
    setAttachments({});
    Promise.all([
      api(`/courses/${selected.id}/resources`),
      api(`/courses/${selected.id}/messages`),
    ])
      .then(([r, m]) => {
        if (!cancelled) {
          setResources(r);
          setMessages(m);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [selected]);
  useEffect(() => {
    if (!selected || (tab !== "Conversación" && page !== "Chat")) return;
    let cancelled = false;
    const id = setInterval(
      () =>
        api(`/courses/${selected.id}/messages`)
          .then((m) => {
            if (!cancelled) setMessages(m);
          })
          .catch(() => {}),
      5000,
    );
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selected, tab, page]);
  useEffect(() => {
    if (!user || user.must_change_password || !classroom) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const rows = await Promise.all(
          courses.map(async (c) =>
            (await api(`/courses/${c.id}/tasks`)).map((t) => ({
              ...t,
              course_name: c.name,
              color: c.color,
              group_name: c.group_name,
            })),
          ),
        );
        if (!cancelled) setAllTasks(rows.flat());
        if (review) {
          const rows = await api(`/tasks/${review.task.id}/submissions`);
          if (!cancelled)
            setReview((current) =>
              current && current.task.id === review.task.id
                ? { ...current, rows }
                : current,
            );
        }
      } catch {}
    };
    window.addEventListener("focus", refresh);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      clearInterval(id);
    };
  }, [user, courses, classroom, review?.task.id]);
  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(""), 5000);
    return () => clearTimeout(id);
  }, [success]);
  const done = () => {
    setSuccess("Cambios guardados.");
    void load();
    if (selected)
      api(`/courses/${selected.id}/resources`)
        .then(setResources)
        .catch(() => {});
  };
  const close = useCallback(() => setDialog(null), []);
  async function act(fn: () => Promise<unknown>) {
    try {
      setError("");
      await fn();
      done();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function navigate(p: string) {
    setPage(p);
    setSelected(null);
    setReview(null);
    setSearch("");
    setMobile(false);
  }
  function openCourse(c: Row, t = "Actividades") {
    setSelected(c);
    setTab(t);
    setPage("Asignaturas");
    setReview(null);
  }
  function form(
    title: string,
    fields: Field[],
    submit: Dialog["submit"],
    description?: string,
  ) {
    setDialog({ title, fields, submit, description });
  }
  const text = (
    key: string,
    label: string,
    value?: any,
    type = "text",
    required = true,
  ): Field => ({ key, label, value, type, required });
  const select = (
    key: string,
    label: string,
    rows: Row[],
    value?: any,
  ): Field => ({
    key,
    label,
    type: "select-number",
    options: opts(rows),
    required: true,
    value,
  });
  const fileField: Field = {
    key: "file",
    label: "Adjunto (PDF, DOCX, PPTX, JPG o PNG · máximo 5 MB)",
    type: "file",
  };
  const pending = allTasks.filter(
      (t) => !t.submission_id && new Date(t.due_at) > new Date(),
    ),
    due = [...allTasks]
      .filter(
        (t) => new Date(t.due_at) > new Date() && (!t.submission_id || staff),
      )
      .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
  const today = ((new Date().getDay() + 6) % 7) + 1,
    todayClasses = schedules.filter((s) => s.weekday === today);
  function createTask(c: Row) {
    form(
      "Nueva actividad",
      [
        text("title", "Título"),
        text("description", "Instrucciones", undefined, "textarea"),
        text(
          "publishedAt",
          "Publicación",
          new Date(Date.now() - 60000 - new Date().getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16),
          "datetime-local",
        ),
        text("dueAt", "Fecha límite", undefined, "datetime-local"),
        {
          key: "deliveryType",
          label: "Tipo de entrega",
          required: true,
          options: [
            { value: "BOTH", label: "Archivo o enlace" },
            { value: "FILE", label: "Archivo" },
            { value: "LINK", label: "Enlace" },
          ],
        },
        text("maxScore", "Puntuación máxima", 100, "number"),
        fileField,
      ],
      async (v) => {
        let fileId = null;
        if (v.file) fileId = (await upload(c.id, "TASK", v.file)).id;
        await api(`/courses/${c.id}/tasks`, "POST", {
          ...v,
          file: undefined,
          fileId,
          publishedAt: new Date(v.publishedAt).toISOString(),
          dueAt: new Date(v.dueAt).toISOString(),
          maxScore: Number(v.maxScore),
        });
      },
    );
  }
  function createResource(c: Row) {
    form(
      "Publicar material",
      [
        text("title", "Título"),
        text("unit", "Unidad"),
        text("body", "Contenido", undefined, "textarea"),
        text("url", "Enlace (opcional)", undefined, "url", false),
        fileField,
      ],
      async (v) => {
        let fileId = null;
        if (v.file) fileId = (await upload(c.id, "RESOURCE", v.file)).id;
        await api(`/courses/${c.id}/resources`, "POST", {
          ...v,
          file: undefined,
          fileId,
        });
      },
    );
  }
  function submitTask(t: Row) {
    const fields: Field[] = [];
    if (t.delivery_type !== "LINK")
      fields.push({
        ...fileField,
        required: t.delivery_type === "FILE" && !t.submission_file,
      });
    if (t.delivery_type !== "FILE")
      fields.push(
        text(
          "url",
          "Enlace a tu trabajo",
          t.submission_url,
          "url",
          t.delivery_type === "LINK",
        ),
      );
    form(
      t.submission_id ? "Actualizar entrega" : "Entregar actividad",
      fields,
      async (v) => {
        let fileId = t.submission_file ?? null;
        if (v.file)
          fileId = (await upload(t.course_id, "SUBMISSION", v.file)).id;
        await api(`/tasks/${t.id}/submission`, "POST", {
          fileId,
          url: v.url || null,
        });
      },
      "Puedes actualizar tu entrega hasta la fecha límite, mientras no haya sido calificada.",
    );
  }
  async function reviewTask(t: Row) {
    await act(async () => {
      const rows = await api(`/tasks/${t.id}/submissions`);
      const course = courses.find((c) => c.id === t.course_id);
      if (course) openCourse(course);
      setReview({ task: t, rows });
    });
  }
  function taskCards(tasks: Row[]) {
    return tasks.length ? (
      <div className="task-list">
        {tasks.map((t) => (
          <article className="task-row" key={t.id}>
            <div
              className="task-symbol"
              style={{ color: t.color ?? selected?.color }}
            >
              <ClipboardList size={21} />
            </div>
            <div className="task-info">
              <div className="tag-line">
                <span>
                  {t.course_name ?? selected?.name} ·{" "}
                  {t.group_name ?? selected?.group_name}
                </span>
                <span
                  className={`badge ${t.submission_id ? "green" : new Date(t.due_at) < new Date() ? "gray" : "orange"}`}
                >
                  {t.score != null
                    ? `${t.score} / ${t.max_score}`
                    : t.submission_id
                      ? "Entregada"
                      : new Date(t.due_at) < new Date()
                        ? "Vencida"
                        : "Pendiente"}
                </span>
              </div>
              <h3>{t.title}</h3>
              <p className="instructions">{t.description}</p>
              <div className="task-meta">
                <span>
                  <Clock size={13} />
                  {datetime(t.due_at)}
                </span>
                <span>
                  {t.delivery_type === "FILE"
                    ? "Archivo"
                    : t.delivery_type === "LINK"
                      ? "Enlace"
                      : "Archivo o enlace"}
                </span>
              </div>
              {t.feedback && (
                <p className="feedback">Observación: {t.feedback}</p>
              )}
              {t.submission_file && (
                <FileLink id={t.submission_file} name="Mi archivo entregado" />
              )}
              {t.submission_url && (
                <External url={t.submission_url}>Mi enlace entregado</External>
              )}
              {attachments[t.id]?.map((f) => (
                <FileLink key={f.id} id={f.id} name={f.name} />
              ))}
            </div>
            <div className="row-actions">
              <button
                className="text-btn"
                onClick={() =>
                  void act(async () => {
                    const fs = await api(`/tasks/${t.id}/files`);
                    setAttachments((v) => ({ ...v, [t.id]: fs }));
                    if (!fs.length)
                      setSuccess("Esta actividad no tiene adjuntos.");
                  })
                }
              >
                Ver adjuntos
              </button>
              {user?.role === "STUDENT" ? (
                <button
                  className="secondary"
                  disabled={new Date(t.due_at) < new Date() || t.score != null}
                  onClick={() => submitTask(t)}
                >
                  {t.submission_id ? "Actualizar" : "Entregar"}
                  <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  className="secondary"
                  onClick={() => void reviewTask(t)}
                >
                  Ver entregas
                  <span className="count">{t.submission_count}</span>
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    ) : (
      <Empty text="No hay actividades en esta sección." />
    );
  }
  const courseCards = (list: Row[]) =>
    list.length ? (
      <div className="course-grid">
        {list.map((c) => {
          const Icon = /matem/i.test(c.name)
            ? Calculator
            : /ciencia/i.test(c.name)
              ? Leaf
              : /ingl/i.test(c.name)
                ? Languages
                : BookOpen;
          const tasks = allTasks.filter((t) => t.course_id === c.id);
          return (
            <button
              className="course-card"
              style={{ "--course": c.color } as React.CSSProperties}
              key={c.id}
              onClick={() => openCourse(c)}
            >
              <div className="course-art">
                <span className="course-icon">
                  <Icon size={34} strokeWidth={1.5} />
                </span>
              </div>
              <div className="course-body">
                <p className="eyebrow">
                  {c.group_name}
                  <span> / {c.period_name}</span>
                </p>
                <h3>{c.name}</h3>
                <p className="teacher">
                  <span className="mini-avatar">
                    {c.teacher_name.slice(0, 1)}
                  </span>
                  {c.teacher_name}
                </p>
                <div className="course-footer">
                  <span>
                    <ClipboardList size={14} />
                    {tasks.length} actividades
                  </span>
                  <span className="course-enter">
                    Entrar
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    ) : (
      <Empty text="No tienes asignaturas asignadas. Consulta a tu coordinación." />
    );
  function passwordForm() {
    form(
      "Cambiar contraseña",
      [
        text("current", "Contraseña actual", undefined, "password"),
        text(
          "password",
          "Nueva contraseña (12–72 caracteres)",
          undefined,
          "password",
        ),
      ],
      async (v) => {
        await api("/auth/password", "POST", v);
        await csrf();
        const u = await api<User>("/auth/me");
        setUser(u);
        setPage("Inicio");
      },
    );
  }
  function management() {
    const groups = catalog.groups as Row[],
      people = catalog.people as Row[];
    return (
      <>
        <section className="panel">
          <div className="section-head">
            <h2>Registro y matrícula de alumnos</h2>
            <button
              className="primary"
              onClick={() =>
                form(
                  "Registrar y matricular alumno",
                  [
                    text("name", "Nombre completo"),
                    text("email", "Correo electrónico", undefined, "email"),
                    text(
                      "password",
                      "Contraseña temporal (12–72 caracteres)",
                      undefined,
                      "password",
                    ),
                    select("groupId", "Grupo", groups),
                  ],
                  async (v) => {
                    await api("/academic/students", "POST", v);
                  },
                  "El alumno deberá cambiar su contraseña al ingresar.",
                )
              }
            >
              Registrar alumno
            </button>
          </div>
          <p className="muted">
            Registra un alumno nuevo o utiliza Matricular en su grupo para un
            alumno existente.
          </p>
        </section>
        {user?.role === "ADMIN" && (
          <section className="panel">
            <div className="section-head">
              <h2>Maestros</h2>
              <button
                className="primary"
                onClick={() =>
                  form(
                    "Agregar maestro",
                    [
                      text("name", "Nombre completo"),
                      text("email", "Correo electrónico", undefined, "email"),
                      text(
                        "password",
                        "Contraseña temporal (12–72 caracteres)",
                        undefined,
                        "password",
                      ),
                    ],
                    async (v) => {
                      await api("/teachers", "POST", v);
                    },
                  )
                }
              >
                Agregar maestro
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {people
                    .filter((p) => hasRole(p as User, "TEACHER"))
                    .map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.email}</td>
                        <td>{p.active ? "Activo" : "Inactivo"}</td>
                        <td>
                          <button
                            className="text-btn"
                            onClick={() =>
                              form(
                                "Editar maestro",
                                [
                                  text("name", "Nombre", p.name),
                                  text("email", "Correo", p.email, "email"),
                                  {
                                    key: "active",
                                    label: "Cuenta activa",
                                    type: "checkbox",
                                    value: p.active,
                                  },
                                ],
                                async (v) => {
                                  await api(`/teachers/${p.id}`, "PUT", v);
                                  if (p.id === user.id) clearSession();
                                },
                              )
                            }
                          >
                            Editar
                          </button>
                          {p.active && p.role === "TEACHER" && (
                            <button
                              className="text-btn danger"
                              onClick={() =>
                                form(
                                  "Desactivar maestro",
                                  [],
                                  async () => {
                                    await api(`/teachers/${p.id}`, "DELETE");
                                  },
                                  "Se cerrarán sus sesiones. Sus asignaciones y entregas se conservan; puedes reasignar las materias a otro maestro.",
                                )
                              }
                            >
                              Desactivar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <div className="management-grid">
          {user?.role === "ADMIN" && (
            <section className="panel">
              <div className="section-head">
                <h2>Catálogos académicos</h2>
                <Settings size={19} />
              </div>
              {(["period", "grade", "section", "subject"] as const).map(
                (type, i) => (
                  <div className="catalog-line" key={type}>
                    <div>
                      <h3>
                        {["Períodos", "Grados", "Secciones", "Asignaturas"][i]}
                      </h3>
                      <div className="catalog-chips">
                        {catalog[type].map((x: Row) => (
                          <button
                            key={x.id}
                            className="chip"
                            onClick={() =>
                              form(
                                "Editar " + x.name,
                                [
                                  text("name", "Nombre", x.name),
                                  ...(type === "subject"
                                    ? [text("color", "Color", x.color, "color")]
                                    : type === "period"
                                      ? [
                                          text(
                                            "startsOn",
                                            "Inicio",
                                            x.starts_on,
                                            "date",
                                          ),
                                          text(
                                            "endsOn",
                                            "Final",
                                            x.ends_on,
                                            "date",
                                          ),
                                        ]
                                      : []),
                                ],
                                async (v) => {
                                  await api(
                                    `/catalog/${type}/${x.id}`,
                                    "PUT",
                                    v,
                                  );
                                },
                              )
                            }
                          >
                            {x.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      className="icon-btn"
                      aria-label={"Crear " + type}
                      onClick={() =>
                        form(
                          "Crear " +
                            ["período", "grado", "sección", "asignatura"][i],
                          [
                            text("name", "Nombre"),
                            ...(type === "subject"
                              ? [text("color", "Color", "#6154d9", "color")]
                              : type === "period"
                                ? [
                                    text(
                                      "startsOn",
                                      "Inicio",
                                      undefined,
                                      "date",
                                    ),
                                    text("endsOn", "Final", undefined, "date"),
                                  ]
                                : []),
                          ],
                          async (v) => {
                            await api("/catalog/" + type, "POST", v);
                          },
                        )
                      }
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                ),
              )}
            </section>
          )}
          <section className="panel">
            <div className="section-head">
              <h2>Grupos y secciones</h2>
              {user?.role === "ADMIN" && (
                <button
                  className="text-btn"
                  onClick={() =>
                    form(
                      "Crear grupo",
                      [
                        text("name", "Nombre"),
                        select("periodId", "Período", catalog.period),
                        select("gradeId", "Grado", catalog.grade),
                        select("sectionId", "Sección", catalog.section),
                      ],
                      async (v) => {
                        await api("/groups", "POST", v);
                      },
                    )
                  }
                >
                  <Plus size={16} />
                  Nuevo
                </button>
              )}
            </div>
            {groups.map((g) => (
              <div className="group-line" key={g.id}>
                <span className="tile-icon">
                  <Users size={20} />
                </span>
                <div>
                  <h3>{g.name}</h3>
                  <small>
                    {
                      catalog.enrollments.filter(
                        (e: Row) => e.group_id === g.id,
                      ).length
                    }{" "}
                    alumnos matriculados
                  </small>
                </div>
                {manager && (
                  <button
                    className="text-btn"
                    onClick={() =>
                      form(
                        "Matricular en " + g.name,
                        [
                          select(
                            "studentId",
                            "Alumno",
                            people.filter(
                              (p) =>
                                p.role === "STUDENT" &&
                                p.active &&
                                !catalog.enrollments.some(
                                  (e: Row) =>
                                    e.student_id === p.id &&
                                    e.group_id === g.id,
                                ),
                            ),
                          ),
                        ],
                        async (v) => {
                          await api(`/groups/${g.id}/enrollments`, "POST", v);
                        },
                      )
                    }
                  >
                    Matricular
                  </button>
                )}
              </div>
            ))}
            {user?.role === "COORDINATOR" && (
              <p className="muted small">
                Tu coordinación muestra únicamente los grupos asignados. Los
                nuevos alumnos se pueden registrar y matricular desde este
                módulo.
              </p>
            )}
          </section>
        </div>
        <section className="panel">
          <div className="section-head">
            <h2>Asignaciones docentes</h2>
            <button
              className="primary"
              onClick={() =>
                form(
                  "Asignar materia a un grupo",
                  [
                    select("subjectId", "Asignatura", catalog.subject),
                    select(
                      "groupId",
                      "Grupo",
                      groups.filter(
                        (g) => user?.role === "ADMIN" || g.can_manage,
                      ),
                    ),
                    select(
                      "teacherId",
                      "Docente",
                      people.filter(
                        (p) => hasRole(p as User, "TEACHER") && p.active,
                      ),
                    ),
                  ],
                  async (v) => {
                    await api("/courses", "POST", v);
                  },
                )
              }
            >
              <Plus size={16} />
              Nueva asignación
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asignatura</th>
                  <th>Grupo</th>
                  <th>Docente</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {(catalog.courses as Row[]).map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.group_name}</td>
                    <td>{c.teacher_name}</td>
                    <td>
                      {(user?.role === "ADMIN" ||
                        groups.find((g) => g.id === c.group_id)
                          ?.can_manage) && (
                        <button
                          className="text-btn"
                          onClick={() =>
                            form(
                              "Cambiar docente",
                              [
                                select(
                                  "teacherId",
                                  "Docente",
                                  people.filter(
                                    (p) =>
                                      hasRole(p as User, "TEACHER") && p.active,
                                  ),
                                  c.teacher_id,
                                ),
                              ],
                              async (v) => {
                                await api(`/courses/${c.id}/teacher`, "PUT", v);
                              },
                            )
                          }
                        >
                          Cambiar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {user?.role === "COORDINATOR" && (
          <ScheduleView
            user={user}
            catalog={catalog}
            openForm={form}
            management
          />
        )}
        <section className="panel">
          <h2>Matrículas</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Grupo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {catalog.enrollments.map((e: Row) => (
                  <tr key={`${e.student_id}-${e.group_id}`}>
                    <td>{people.find((p) => p.id === e.student_id)?.name}</td>
                    <td>{groups.find((g) => g.id === e.group_id)?.name}</td>
                    <td>
                      {(user?.role === "ADMIN" ||
                        groups.find((g) => g.id === e.group_id)
                          ?.can_manage) && (
                        <button
                          className="text-btn danger"
                          onClick={() =>
                            form(
                              "Retirar matrícula",
                              [],
                              async () => {
                                await api(
                                  `/groups/${e.group_id}/enrollments/${e.student_id}`,
                                  "DELETE",
                                );
                              },
                              "Se retirará el acceso del alumno a este grupo. Las entregas se conservan.",
                            )
                          }
                        >
                          Retirar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {user?.role === "ADMIN" && (
          <section className="panel">
            <div className="section-head">
              <h2>Ámbito de coordinadores</h2>
              <button
                className="secondary"
                onClick={() =>
                  form(
                    "Asignar coordinación",
                    [
                      select("groupId", "Grupo", groups),
                      select(
                        "userId",
                        "Coordinador",
                        people.filter(
                          (p) => p.role === "COORDINATOR" && p.active,
                        ),
                      ),
                      {
                        key: "canManage",
                        label: "Permitir gestionar asignaciones y horarios",
                        type: "checkbox",
                      },
                    ],
                    async (v) => {
                      await api(`/groups/${v.groupId}/coordinators`, "POST", v);
                    },
                  )
                }
              >
                <Plus size={16} />
                Asignar
              </button>
            </div>
            {catalog.scopes.map((s: Row) => (
              <div className="group-line" key={`${s.user_id}-${s.group_id}`}>
                <div>
                  <h3>
                    {people.find((p) => p.id === s.user_id)?.name} ·{" "}
                    {groups.find((g) => g.id === s.group_id)?.name}
                  </h3>
                  <small>
                    {s.can_manage
                      ? "Supervisión y gestión"
                      : "Solo supervisión"}
                  </small>
                </div>
                <button
                  className="text-btn danger"
                  onClick={() =>
                    form(
                      "Retirar coordinación",
                      [],
                      async () => {
                        await api(
                          `/groups/${s.group_id}/coordinators/${s.user_id}`,
                          "DELETE",
                        );
                      },
                      "El coordinador perderá el acceso a este grupo.",
                    )
                  }
                >
                  Retirar
                </button>
              </div>
            ))}
          </section>
        )}
      </>
    );
  }
  if (boot) return <div className="boot">Preparando Tu Aula Virtual…</div>;
  if (!user)
    return (
      <LoginScreen
        onLogin={(u) => {
          setUser(u);
          setPage(u.must_change_password ? "Mi cuenta" : "Inicio");
        }}
      />
    );
  const nav = [
    ["Inicio", LayoutDashboard],
    ...(classroom
      ? [
          ["Asignaturas", BookOpen],
          ["Actividades", ClipboardList],
        ]
      : []),
    ...(classroom || user.role === "ADMIN" ? [["Horario", CalendarDays]] : []),
    ["Calendario", CalendarDays],
    ["Chat", MessageCircle],
    ["Avisos", Megaphone],
    ["Jerarquía y permisos", ShieldCheck],
    ...(canTeach ? [["Reportes", BarChart3]] : []),
    ...(manager ? [["Gestión académica", Settings]] : []),
    ...(user.role === "ADMIN"
      ? [
          ["Usuarios", Users],
          ["Auditoría", ShieldCheck],
        ]
      : []),
  ] as [string, typeof BookOpen][];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Inicio");
          }}
        >
          <span>
            <GraduationCap size={25} />
          </span>
          <span className="brand-copy">
            <strong>Tu Aula</strong>
            <small>Virtual</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">A</span>
          <div>
            <b>Comunidad académica</b>
            <small>{courses[0]?.period_name ?? "Campus virtual"}</small>
          </div>
          <span className="online-dot" />
        </div>
        <p className="nav-label">NAVEGACIÓN</p>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              onClick={() => navigate(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Actividades" && pending.length > 0 && !staff && (
                <span className="nav-count">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-caption">
            <ShieldCheck size={15} />
            <span>Espacio institucional</span>
          </div>
          <button className="user-card" onClick={() => navigate("Mi cuenta")}>
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span>
              <b>{user.name}</b>
              <small>{roles[user.role]}</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
          <button
            className="logout"
            onClick={() =>
              void api("/auth/logout", "POST")
                .then(clearSession)
                .catch((e) => setError(e.message))
            }
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-shade"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-btn mobile-toggle"
            aria-label="Abrir menú"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Mi espacio
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-btn"
              aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="icon-btn notification-btn"
              aria-label="Notificaciones"
              onClick={() => navigate("Notificaciones")}
            >
              <Bell size={20} />
              {notifications.some((n) => !n.read_at) && <i />}
            </button>
            <button
              className="avatar small-avatar"
              aria-label="Mi cuenta"
              onClick={() => navigate("Mi cuenta")}
            >
              {user.name.slice(0, 1)}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {new Date().toLocaleDateString("es-GT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <h1>
                {selected
                  ? selected.name
                  : page === "Inicio"
                    ? `Hola, ${user.name.split(" ")[0]}`
                    : page}
              </h1>
              <p>
                {selected
                  ? `${selected.group_name} · ${selected.teacher_name}`
                  : page === "Inicio"
                    ? {
                        STUDENT:
                          "Tus asignaturas, entregas y clases, en orden.",
                        TEACHER:
                          "Organiza tus clases y da seguimiento a tus alumnos.",
                        COORDINATOR:
                          "Una visión clara de tus grupos y su actividad.",
                        ADMIN:
                          "Supervisa la comunidad y la operación académica.",
                      }[user.role]
                    : "Comunidad académica · " + roles[user.role]}
              </p>
            </div>
            {selected ? (
              <button
                className="secondary"
                onClick={() => {
                  setSelected(null);
                  setReview(null);
                }}
              >
                <ArrowLeft size={16} />
                Volver
              </button>
            ) : (
              <div className="date-chip">
                <CalendarDays size={17} />
                {new Date().getFullYear()}
                <span> · </span>Mi aula
              </div>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="text-btn" onClick={() => void load()}>
                Reintentar
              </button>
            </div>
          )}
          {success && (
            <div className="toast" role="status">
              <CheckCircle2 size={17} />
              {success}
            </div>
          )}
          {loading && (
            <div className="loading" role="status">
              Actualizando información…
            </div>
          )}
          {user.must_change_password ? (
            <section className="panel">
              <KeyRound />
              <h2>Protege tu acceso</h2>
              <p>
                Tu cuenta utiliza una contraseña temporal. Cámbiala para
                continuar.
              </p>
              <button className="primary" onClick={passwordForm}>
                Cambiar contraseña
              </button>
            </section>
          ) : (
            <>
              {page === "Inicio" && !classroom && (
                <>
                  <section className="panel">
                    <h2>Gestión de la comunidad educativa</h2>
                    <p className="muted">
                      Administra las matrículas y asignaciones de los grupos
                      bajo tu responsabilidad.
                    </p>
                    <div className="form-actions">
                      <button
                        className="primary"
                        onClick={() => navigate("Gestión académica")}
                      >
                        Abrir gestión académica
                      </button>
                      <button
                        className="secondary"
                        onClick={() => navigate("Calendario")}
                      >
                        Ver calendario
                      </button>
                      <button
                        className="secondary"
                        onClick={() => navigate("Chat")}
                      >
                        Mensajes privados
                      </button>
                    </div>
                  </section>
                  <section className="panel">
                    <h2>Grupos asignados</h2>
                    {catalog.groups.map((g: Row) => (
                      <div className="group-line" key={g.id}>
                        <h3>{g.name}</h3>
                        <span>
                          {
                            catalog.enrollments.filter(
                              (e: Row) => e.group_id === g.id,
                            ).length
                          }{" "}
                          alumnos matriculados
                        </span>
                      </div>
                    ))}
                  </section>
                </>
              )}
              {page === "Inicio" && classroom && (
                <>
                  {user.role !== "COORDINATOR" && (
                    <section className="academic-brief">
                      <div className="brief-intro">
                        <span className="brief-label">
                          {staff
                            ? "SEGUIMIENTO ACADÉMICO"
                            : "TU ESPACIO DE APRENDIZAJE"}
                        </span>
                        <h2>
                          {staff
                            ? "Una visión clara de tu aula."
                            : "Enfócate en lo que sigue."}
                        </h2>
                        <p>
                          {staff
                            ? "Consulta las actividades de tus grupos y acompaña cada entrega."
                            : "Revisa tus próximas entregas y organiza tu semana de estudio."}
                        </p>
                        <button onClick={() => navigate("Actividades")}>
                          Revisar actividades
                          <ArrowUpRight size={17} />
                        </button>
                      </div>
                      <div className="brief-next">
                        <span className="brief-label">
                          {due.length
                            ? "PRÓXIMA ENTREGA"
                            : "AGENDA DE ACTIVIDADES"}
                        </span>
                        <div className="brief-icon">
                          <ClipboardList size={22} />
                        </div>
                        <h3>{due[0]?.title ?? "Sin entregas próximas"}</h3>
                        <p>
                          {due[0]
                            ? `${due[0].course_name} · ${due[0].group_name}`
                            : "Consulta tus asignaturas para continuar."}
                        </p>
                        {due[0] && (
                          <span className="brief-deadline">
                            <Clock size={14} />
                            {datetime(due[0].due_at)}
                          </span>
                        )}
                      </div>
                    </section>
                  )}
                  <section className="stat-grid">
                    {[
                      [
                        BookOpen,
                        courses.length,
                        "Asignaturas",
                        "Materias en curso",
                        "purple",
                      ],
                      [
                        ClipboardList,
                        staff ? allTasks.length : pending.length,
                        staff
                          ? "Actividades creadas"
                          : "Actividades pendientes",
                        staff
                          ? "En tus grupos asignados"
                          : "Por fecha de entrega",
                        "orange",
                      ],
                      [
                        CalendarDays,
                        todayClasses.length,
                        "Clases para hoy",
                        "En tu horario semanal",
                        "teal",
                      ],
                      [
                        CheckCircle2,
                        staff
                          ? reports.reduce(
                              (n, r) => n + Number(r.submissions),
                              0,
                            )
                          : allTasks.filter((t) => t.submission_id).length,
                        staff ? "Entregas recibidas" : "Actividades entregadas",
                        "Seguimiento de actividades",
                        "blue",
                      ],
                    ].map(([Icon, n, label, sub, color]) => {
                      const I = Icon as typeof BookOpen;
                      return (
                        <article className="stat" key={String(label)}>
                          <span className={`stat-icon ${color}`}>
                            <I size={21} />
                          </span>
                          <div>
                            <strong>{String(n).padStart(2, "0")}</strong>
                            <b>{String(label)}</b>
                            <small>{String(sub)}</small>
                          </div>
                        </article>
                      );
                    })}
                  </section>
                  <div className="dashboard-columns">
                    <div>
                      <section className="panel upcoming">
                        <div className="section-head">
                          <h2>Próximas entregas</h2>
                          <button
                            className="text-btn"
                            onClick={() => navigate("Actividades")}
                          >
                            Ver actividades
                            <ChevronRight size={16} />
                          </button>
                        </div>
                        {due.length ? (
                          due.slice(0, 3).map((t) => (
                            <button
                              className="due-row"
                              key={t.id}
                              onClick={() =>
                                openCourse(
                                  courses.find((c) => c.id === t.course_id)!,
                                )
                              }
                            >
                              <span className="due-date">
                                <b>{new Date(t.due_at).getDate()}</b>
                                {new Date(t.due_at).toLocaleDateString(
                                  "es-GT",
                                  { month: "short" },
                                )}
                              </span>
                              <span>
                                <h3>{t.title}</h3>
                                <small>
                                  {t.course_name} · {t.group_name}
                                </small>
                              </span>
                              <span className="badge orange">
                                {date(t.due_at)}
                              </span>
                              <ChevronRight size={16} />
                            </button>
                          ))
                        ) : (
                          <Empty text="Estás al día. No hay próximas entregas." />
                        )}
                      </section>
                      <div className="section-head">
                        <h2>
                          Mis asignaturas{" "}
                          <span className="sub-count">{courses.length}</span>
                        </h2>
                        <button
                          className="text-btn"
                          onClick={() => navigate("Asignaturas")}
                        >
                          Ver todas
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      {courseCards(courses.slice(0, 4))}
                    </div>
                    <aside className="dashboard-aside">
                      <section className="panel">
                        <div className="section-head">
                          <h2>Clases de hoy</h2>
                          <span className="today-badge">HOY</span>
                        </div>
                        <p className="small muted">
                          {days[today - 1]}, {new Date().getDate()} de{" "}
                          {new Date().toLocaleDateString("es-GT", {
                            month: "long",
                          })}
                        </p>
                        {todayClasses.length ? (
                          todayClasses.map((s) => (
                            <div className="today-class" key={s.id}>
                              <span className="timeline-dot" />
                              <div>
                                <small>
                                  {s.starts_at.slice(0, 5)} —{" "}
                                  {s.ends_at.slice(0, 5)}
                                </small>
                                <h3>{s.subject_name}</h3>
                                <p>{s.teacher_name}</p>
                                <span className="badge gray">{s.modality}</span>
                                {s.url && (
                                  <External url={s.url}>
                                    Entrar a clase
                                  </External>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <Empty text="Hoy no tienes clases programadas." />
                        )}
                        <button
                          className="full-link"
                          onClick={() => navigate("Horario")}
                        >
                          Ver horario completo
                          <ArrowUpRight size={15} />
                        </button>
                      </section>
                      <section className="panel notice-panel">
                        <div className="section-head">
                          <h2>Tablón académico</h2>
                          <Megaphone size={18} />
                        </div>
                        {notices.slice(0, 2).map((n) => (
                          <article className="notice-preview" key={n.id}>
                            <span className="notice-dot" />
                            <small>
                              {n.group_name} · {date(n.created_at)}
                            </small>
                            <h3>{n.title}</h3>
                            <p>{n.body}</p>
                            <span className="small muted">{n.author_name}</span>
                          </article>
                        ))}
                        {!notices.length && (
                          <Empty text="No hay avisos recientes." />
                        )}
                        <button
                          className="full-link"
                          onClick={() => navigate("Avisos")}
                        >
                          Todos los avisos
                          <ChevronRight size={15} />
                        </button>
                      </section>
                    </aside>
                  </div>
                </>
              )}
              {page === "Asignaturas" && classroom && !selected && (
                <>
                  <div className="filter-bar">
                    <div className="search">
                      <Search size={17} />
                      <input
                        aria-label="Buscar asignatura"
                        placeholder="Buscar una asignatura…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <span className="muted small">
                      {courses.length} asignaturas en tu espacio
                    </span>
                  </div>
                  {courseCards(
                    courses.filter((c) =>
                      (c.name + " " + c.group_name)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    ),
                  )}
                </>
              )}
              {selected && (
                <>
                  <div className="tabs">
                    {["Actividades", "Materiales", "Conversación"].map((t) => (
                      <button
                        className={tab === t ? "active" : ""}
                        key={t}
                        onClick={() => {
                          setTab(t);
                          setReview(null);
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {tab === "Actividades" && (
                    <>
                      {review ? (
                        <section className="panel">
                          <div className="section-head">
                            <h2>Entregas · {review.task.title}</h2>
                            <button
                              className="text-btn"
                              onClick={() => setReview(null)}
                            >
                              Volver a actividades
                            </button>
                          </div>
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Alumno</th>
                                  <th>Entrega</th>
                                  <th>Nota</th>
                                  <th>Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {review.rows.map((r) => (
                                  <tr key={r.student_id}>
                                    <td>
                                      {r.student_name}
                                      {r.id && (
                                        <button
                                          className="text-btn"
                                          onClick={() =>
                                            void act(async () => {
                                              setSubmissionDetail(
                                                await api<Row>(
                                                  `/submissions/${r.id}`,
                                                ),
                                              );
                                            })
                                          }
                                        >
                                          Ver entrega
                                        </button>
                                      )}
                                    </td>
                                    <td>
                                      {r.id ? (
                                        <>
                                          <small>
                                            {datetime(r.submitted_at)}
                                          </small>
                                          {r.file_id && (
                                            <FileLink id={r.file_id} />
                                          )}
                                          {r.url && (
                                            <External url={r.url}>
                                              Ver enlace
                                            </External>
                                          )}
                                        </>
                                      ) : (
                                        <span className="muted">
                                          Sin entregar
                                        </span>
                                      )}
                                    </td>
                                    <td>{r.score ?? "—"}</td>
                                    <td>
                                      {r.id && canTeach && (
                                        <button
                                          className="text-btn"
                                          onClick={() =>
                                            form(
                                              "Calificar entrega",
                                              [
                                                {
                                                  ...text(
                                                    "score",
                                                    "Nota",
                                                    r.score ?? 0,
                                                    "number",
                                                  ),
                                                  min: "0",
                                                  max: String(
                                                    review.task.max_score,
                                                  ),
                                                },
                                                text(
                                                  "feedback",
                                                  "Observaciones",
                                                  r.feedback ?? "",
                                                  "textarea",
                                                  false,
                                                ),
                                              ],
                                              async (v) => {
                                                await api(
                                                  `/submissions/${r.id}/grade`,
                                                  "PUT",
                                                  {
                                                    ...v,
                                                    score: Number(v.score),
                                                  },
                                                );
                                                setReview({
                                                  ...review,
                                                  rows: await api(
                                                    `/tasks/${review.task.id}/submissions`,
                                                  ),
                                                });
                                              },
                                            )
                                          }
                                        >
                                          Calificar
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      ) : (
                        <>
                          <div className="section-head">
                            <h2>Actividades de la asignatura</h2>
                            {canTeach && (
                              <button
                                className="primary"
                                onClick={() => createTask(selected)}
                              >
                                <Plus size={16} />
                                Nueva actividad
                              </button>
                            )}
                          </div>
                          {taskCards(
                            allTasks.filter((t) => t.course_id === selected.id),
                          )}
                        </>
                      )}
                    </>
                  )}
                  {tab === "Materiales" && (
                    <>
                      <div className="section-head">
                        <h2>Biblioteca de aprendizaje</h2>
                        {canTeach && (
                          <button
                            className="primary"
                            onClick={() => createResource(selected)}
                          >
                            <Plus size={16} />
                            Publicar material
                          </button>
                        )}
                      </div>
                      <div className="resource-grid">
                        {resources.map((r) => (
                          <article className="panel resource" key={r.id}>
                            <FileText size={25} />
                            <p className="eyebrow">{r.unit}</p>
                            <h2>{r.title}</h2>
                            <p className="instructions">{r.body}</p>
                            {r.file_id && (
                              <FileLink id={r.file_id} name={r.file_name} />
                            )}
                            {r.url && (
                              <External url={r.url}>Abrir recurso</External>
                            )}
                          </article>
                        ))}
                      </div>
                      {!resources.length && (
                        <Empty text="No hay materiales publicados." />
                      )}
                    </>
                  )}
                  {tab === "Conversación" && chat()}
                </>
              )}
              {page === "Actividades" &&
                classroom &&
                !selected &&
                taskCards(allTasks)}
              {page === "Calendario" && (
                <AcademicCalendar
                  user={user}
                  openForm={form}
                  tasks={user.role === "ADMIN" ? [] : allTasks}
                  schedules={user.role === "ADMIN" ? [] : schedules}
                  courses={user.role === "ADMIN" ? [] : courses}
                  onCourse={(id) => {
                    const c = courses.find((c) => c.id === id);
                    if (c) openCourse(c);
                  }}
                />
              )}
              {page === "Horario" && (classroom || user.role === "ADMIN") && (
                <ScheduleView user={user} catalog={catalog} openForm={form} />
              )}
              {page === "Chat" && (
                <>
                  <DirectMessages user={user} />
                  {classroom && (
                    <p className="muted">
                      Selecciona la conversación de tu asignatura y grupo.
                    </p>
                  )}
                  <div className="chat-course-list">
                    {courses.map((c) => (
                      <button
                        className="panel chat-course"
                        key={c.id}
                        onClick={() => openCourse(c, "Conversación")}
                      >
                        <MessageCircle size={23} />
                        <div>
                          <h3>{c.name}</h3>
                          <p>
                            {c.group_name} · {c.teacher_name}
                          </p>
                        </div>
                        <ChevronRight size={19} />
                      </button>
                    ))}
                  </div>
                  {classroom && !courses.length && <Empty />}
                </>
              )}
              {page === "Avisos" && (
                <>
                  <div className="section-head">
                    <h2>Lo que pasa en tu comunidad</h2>
                    {manager && (
                      <button
                        className="primary"
                        onClick={() =>
                          form(
                            "Publicar aviso",
                            [
                              select("groupId", "Grupo", catalog.groups),
                              text("title", "Título"),
                              text("body", "Mensaje", undefined, "textarea"),
                            ],
                            async (v) => {
                              await api("/notices", "POST", v);
                            },
                          )
                        }
                      >
                        <Plus size={16} />
                        Publicar aviso
                      </button>
                    )}
                  </div>
                  {notices.map((n) => (
                    <article className="panel notice-full" key={n.id}>
                      <span className="badge purple">{n.group_name}</span>
                      <h2>{n.title}</h2>
                      <p className="instructions">{n.body}</p>
                      <small className="muted">
                        {n.author_name} · {datetime(n.created_at)}
                      </small>
                    </article>
                  ))}
                  {!notices.length && <Empty />}
                </>
              )}
              {page === "Notificaciones" && (
                <section className="panel">
                  {notifications.length ? (
                    notifications.map((n) => (
                      <div
                        className={`notification-row ${n.read_at ? "" : "unread"}`}
                        key={n.id}
                      >
                        <Bell size={19} />
                        <div>
                          <h3>{n.title}</h3>
                          <small>{datetime(n.created_at)}</small>
                        </div>
                        {n.course_id &&
                          courses.some((c) => c.id === n.course_id) && (
                            <button
                              className="text-btn"
                              onClick={() =>
                                openCourse(
                                  courses.find((c) => c.id === n.course_id)!,
                                )
                              }
                            >
                              Abrir
                            </button>
                          )}
                        {!n.read_at && (
                          <button
                            className="secondary"
                            onClick={() =>
                              void act(() =>
                                api(`/notifications/${n.id}/read`, "POST"),
                              )
                            }
                          >
                            Marcar leída
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <Empty text="No tienes notificaciones." />
                  )}
                </section>
              )}
              {page === "Gestión académica" && manager && management()}
              {page === "Reportes" && canTeach && (
                <section className="panel">
                  <h2>Seguimiento de actividades</h2>
                  <p className="muted">
                    Información de tus asignaturas y grupos autorizados.
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Asignatura</th>
                          <th>Grupo</th>
                          <th>Alumnos</th>
                          <th>Tareas</th>
                          <th>Entregas</th>
                          <th>Calificadas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((r) => (
                          <tr key={r.id}>
                            <td>{r.name}</td>
                            <td>{r.group_name}</td>
                            <td>{r.students}</td>
                            <td>{r.tasks}</td>
                            <td>{r.submissions}</td>
                            <td>{r.graded}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!reports.length && <Empty />}
                </section>
              )}
              {page === "Usuarios" && user.role === "ADMIN" && (
                <section className="panel">
                  <div className="section-head">
                    <h2>Comunidad educativa</h2>
                    <button
                      className="primary"
                      onClick={() =>
                        form(
                          "Crear usuario",
                          [
                            text("name", "Nombre completo"),
                            text(
                              "email",
                              "Correo electrónico",
                              undefined,
                              "email",
                            ),
                            {
                              key: "role",
                              label: "Rol",
                              required: true,
                              options: Object.entries(roles).map(
                                ([value, label]) => ({ value, label }),
                              ),
                            },
                            text(
                              "password",
                              "Contraseña temporal (12–72 caracteres)",
                              undefined,
                              "password",
                            ),
                          ],
                          async (v) => {
                            await api("/users", "POST", v);
                          },
                        )
                      }
                    >
                      <Plus size={16} />
                      Crear usuario
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Correo</th>
                          <th>Rol</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catalog.people.map((p: Row) => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td>{p.email}</td>
                            <td>
                              {(p.roles ?? [p.role])
                                .map((r: User["role"]) => roles[r])
                                .join(" + ")}
                            </td>
                            <td>
                              <span
                                className={`badge ${p.active ? "green" : "gray"}`}
                              >
                                {p.active ? "Activo" : "Inactivo"}
                              </span>
                            </td>
                            <td>
                              <button
                                className="text-btn"
                                onClick={() =>
                                  form(
                                    "Editar usuario",
                                    [
                                      text("name", "Nombre", p.name),
                                      text("email", "Correo", p.email, "email"),
                                      {
                                        key: "role",
                                        label: "Rol",
                                        value: p.role,
                                        required: true,
                                        options: Object.entries(roles).map(
                                          ([value, label]) => ({
                                            value,
                                            label,
                                          }),
                                        ),
                                      },
                                      {
                                        key: "active",
                                        label: "Cuenta activa",
                                        type: "checkbox",
                                        value: p.active,
                                      },
                                    ],
                                    async (v) => {
                                      await api(`/users/${p.id}`, "PUT", v);
                                      if (p.id === user.id) {
                                        clearSession();
                                      }
                                    },
                                  )
                                }
                              >
                                Editar
                              </button>
                              {["ADMIN", "COORDINATOR"].includes(p.role) && (
                                <button
                                  className="text-btn"
                                  onClick={() =>
                                    form(
                                      "Roles adicionales",
                                      [
                                        {
                                          key: "teacher",
                                          label: "También es maestro",
                                          type: "checkbox",
                                          value: hasRole(p as User, "TEACHER"),
                                        },
                                      ],
                                      async (v) => {
                                        await api(
                                          `/users/${p.id}/roles`,
                                          "PUT",
                                          {
                                            roles: v.teacher
                                              ? [p.role, "TEACHER"]
                                              : [p.role],
                                          },
                                        );
                                        if (p.id === user.id) clearSession();
                                      },
                                      "Al cambiar roles se cerrarán sus sesiones. Para retirar Maestro, primero reasigna sus materias.",
                                    )
                                  }
                                >
                                  Roles
                                </button>
                              )}
                              {p.id !== user.id && (
                                <button
                                  className="text-btn"
                                  onClick={() =>
                                    form(
                                      "Restablecer acceso",
                                      [
                                        text(
                                          "password",
                                          "Contraseña temporal",
                                          undefined,
                                          "password",
                                        ),
                                      ],
                                      async (v) => {
                                        await api(
                                          `/users/${p.id}/reset`,
                                          "POST",
                                          v,
                                        );
                                      },
                                      "Se cerrarán las sesiones previas y el usuario deberá cambiar esta contraseña al ingresar.",
                                    )
                                  }
                                >
                                  Restablecer
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {page === "Auditoría" && user.role === "ADMIN" && (
                <section className="panel">
                  <h2>Registro de acciones</h2>
                  <p className="muted">Últimas 200 operaciones registradas.</p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Responsable</th>
                          <th>Acción</th>
                          <th>Registro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.map((x) => (
                          <tr key={x.id}>
                            <td>{datetime(x.created_at)}</td>
                            <td>{x.actor_name}</td>
                            <td>{x.action}</td>
                            <td>{x.target}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!audit.length && <Empty />}
                </section>
              )}
              {page === "Jerarquía y permisos" && <RoleHierarchy />}
              {page === "Mi cuenta" && (
                <section className="panel account">
                  <span className="avatar">{user.name.slice(0, 1)}</span>
                  <h2>{user.name}</h2>
                  <p>{user.email}</p>
                  <span className="badge purple">{roles[user.role]}</span>
                  <hr />
                  <h3>Seguridad de tu cuenta</h3>
                  <p className="muted">
                    Utiliza una contraseña única de entre 12 y 72 caracteres.
                  </p>
                  <button className="primary" onClick={passwordForm}>
                    <KeyRound size={16} />
                    Cambiar contraseña
                  </button>
                </section>
              )}
            </>
          )}
          <footer>
            Tu Aula Virtual · Gestión académica
            <span>Tu Aula Virtual · Comunidad educativa</span>
          </footer>
        </main>
      </div>
      {submissionDetail && (
        <SubmissionDetail
          submission={submissionDetail}
          onClose={() => setSubmissionDetail(null)}
        />
      )}
      {dialog && <FormDialog dialog={dialog} onClose={close} onDone={done} />}
    </div>
  );
  function chat() {
    return (
      <section className="panel chat-panel">
        <div className="section-head">
          <h2>
            <MessageCircle size={20} />
            Conversación de la asignatura
          </h2>
          <span className="badge green">Grupo privado</span>
        </div>
        <p className="muted small">
          Participan los alumnos y el maestro de la asignatura. Se muestran los
          100 mensajes más recientes.
        </p>
        <div className="messages" aria-live="polite">
          {messages.map((m) => (
            <div
              className={`message ${m.sender_id === user?.id ? "own" : ""}`}
              key={m.id}
            >
              <span className="mini-avatar">{m.sender_name[0]}</span>
              <div>
                <small>
                  {m.sender_name} · {roles[m.sender_role as User["role"]]}
                </small>
                <p>{m.body}</p>
                <time>{datetime(m.created_at)}</time>
              </div>
            </div>
          ))}
          {!messages.length && (
            <Empty text="Inicia la conversación de tu grupo." />
          )}
        </div>
        <form
          className="chat-compose"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const body = String(new FormData(f).get("body"));
            const b = f.querySelector("button")!;
            b.disabled = true;
            try {
              await api(`/courses/${selected?.id}/messages`, "POST", { body });
              setMessages(await api(`/courses/${selected?.id}/messages`));
              f.reset();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              b.disabled = false;
            }
          }}
        >
          <label className="sr-only" htmlFor="message">
            Escribe un mensaje
          </label>
          <input
            id="message"
            name="body"
            placeholder="Comparte una idea o pregunta…"
            maxLength={3000}
            required
          />
          <button className="primary" aria-label="Enviar mensaje">
            <Send size={18} />
          </button>
        </form>
      </section>
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
