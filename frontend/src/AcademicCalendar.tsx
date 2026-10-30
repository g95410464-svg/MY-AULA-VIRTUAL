import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  ClipboardList,
} from "lucide-react";
import { api, datetime, type Row, type User } from "./api";
import type { OpenForm } from "./ui";

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function AcademicCalendar({
  tasks,
  schedules,
  courses,
  onCourse,
  user,
  openForm,
}: {
  user: User;
  openForm: OpenForm;
  tasks: Row[];
  schedules: Row[];
  courses: Row[];
  onCourse: (id: number) => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [day, setDay] = useState(() => key(new Date()));
  const offset = (month.getDay() + 6) % 7,
    count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dates = Array.from(
    { length: Math.ceil((count + offset) / 7) * 7 },
    (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1),
  );
  const [notes, setNotes] = useState<Row[]>([]),
    [institutional, setInstitutional] = useState<Row[]>([]),
    [error, setError] = useState("");
  const staff = user.role !== "STUDENT",
    from = key(dates[0]),
    to = key(dates[dates.length - 1]);
  const reload = useCallback(async () => {
    const q = `?from=${from}&to=${to}`;
    const [n, e] = await Promise.all([
      staff ? api(`/calendar/annotations${q}`) : Promise.resolve([]),
      api(`/calendar/events${q}`),
    ]);
    return { n, e };
  }, [from, to, staff]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    setNotes([]);
    setInstitutional([]);
    reload()
      .then(({ n, e }) => {
        if (!cancelled) {
          setNotes(n);
          setInstitutional(e);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [reload, revision]);
  function add(institution = false) {
    openForm(
      institution ? "Crear evento institucional" : "Crear anotación personal",
      [
        {
          key: "date",
          label: "Fecha",
          type: "date",
          required: true,
          value: day,
        },
        { key: "title", label: "Título", required: true },
        { key: "content", label: "Contenido", type: "textarea" },
      ],
      async (v) => {
        await api(
          `/calendar/${institution ? "events" : "annotations"}`,
          "POST",
          { ...v, content: v.content ?? "" },
        );
        setRevision((n) => n + 1);
      },
    );
  }
  function remove(row: Row, institution = false) {
    openForm(
      institution ? "Eliminar evento institucional" : "Eliminar anotación",
      [],
      async () => {
        await api(
          `/calendar/${institution ? "events" : "annotations"}/${row.id}`,
          "DELETE",
        );
        setRevision((n) => n + 1);
      },
      row.title,
    );
  }
  function events(date: Date) {
    const dateKey = key(date),
      weekday = ((date.getDay() + 6) % 7) + 1;
    return {
      notes: notes.filter((n) => String(n.on_date).slice(0, 10) === dateKey),
      institutional: institutional.filter(
        (n) => String(n.on_date).slice(0, 10) === dateKey,
      ),
      due: tasks.filter((t) => key(new Date(t.due_at)) === dateKey),
      classes: schedules.filter((s) => {
        const c = courses.find((c) => c.id === s.course_id);
        return (
          s.weekday === weekday &&
          c &&
          dateKey >= c.starts_on &&
          dateKey <= c.ends_on
        );
      }),
    };
  }
  const selected = new Date(day + "T12:00:00"),
    current = events(selected);
  function move(n: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(next);
    setDay(key(next));
  }
  return (
    <>
      <section className="panel">
        <div className="section-head">
          <h2>
            <CalendarDays size={19} />
            {month.toLocaleDateString("es-GT", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="calendar-controls">
            <button
              className="icon-btn"
              aria-label="Mes anterior"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="secondary"
              onClick={() => {
                setMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                );
                setDay(key(new Date()));
              }}
            >
              Hoy
            </button>
            <button
              className="icon-btn"
              aria-label="Mes siguiente"
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <p className="muted small">
          {user.role === "ADMIN" || user.role === "COORDINATOR"
            ? "Eventos institucionales y anotaciones personales."
            : "Fechas de entrega, clases semanales y eventos institucionales."}{" "}
          Selecciona un día para ver su agenda.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="calendar-scroll">
          <div className="month-grid">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div className="calendar-weekday" key={d}>
                {d}
              </div>
            ))}
            {dates.map((d) => {
              const e = events(d);
              return (
                <button
                  key={key(d)}
                  aria-label={d.toLocaleDateString("es-GT", {
                    dateStyle: "full",
                  })}
                  aria-pressed={key(d) === day}
                  className={`calendar-day ${d.getMonth() !== month.getMonth() ? "outside" : ""} ${key(d) === day ? "chosen" : ""}`}
                  onClick={() => setDay(key(d))}
                >
                  <span
                    className={key(d) === key(new Date()) ? "current-day" : ""}
                  >
                    {d.getDate()}
                  </span>
                  {[...e.notes, ...e.institutional].slice(0, 2).map((n, i) => (
                    <small className="calendar-event" key={"n" + i}>
                      {n.title}
                    </small>
                  ))}
                  {e.due
                    .slice(
                      0,
                      Math.max(0, 2 - e.notes.length - e.institutional.length),
                    )
                    .map((t) => (
                      <small className="calendar-event assignment" key={t.id}>
                        {t.title}
                      </small>
                    ))}
                  {e.classes
                    .slice(
                      0,
                      Math.max(
                        0,
                        2 -
                          e.due.length -
                          e.notes.length -
                          e.institutional.length,
                      ),
                    )
                    .map((s) => (
                      <small className="calendar-event" key={s.id}>
                        {s.starts_at.slice(0, 5)} {s.subject_name}
                      </small>
                    ))}
                  {e.due.length +
                    e.classes.length +
                    e.notes.length +
                    e.institutional.length >
                    2 && (
                    <small className="muted">
                      +
                      {e.due.length +
                        e.classes.length +
                        e.notes.length +
                        e.institutional.length -
                        2}{" "}
                      más
                    </small>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <section className="panel">
        <h2>
          Agenda del{" "}
          {selected.toLocaleDateString("es-GT", {
            day: "numeric",
            month: "long",
          })}
        </h2>
        <div className="form-actions">
          {staff && (
            <button className="primary" onClick={() => add()}>
              Agregar anotación
            </button>
          )}
          {user.role === "ADMIN" && (
            <button className="secondary" onClick={() => add(true)}>
              Crear evento institucional
            </button>
          )}
        </div>
        {[
          ...current.notes.map((n) => ({ ...n, personal: true })),
          ...current.institutional.map((n) => ({ ...n, personal: false })),
        ].map((n: Row) => (
          <article className="agenda-row" key={(n.personal ? "n" : "e") + n.id}>
            <CalendarDays size={18} />
            <div>
              <span className="badge gray">
                {n.personal ? "Anotación personal" : "Evento institucional"}
              </span>
              <h3>{n.title}</h3>
              <p className="instructions">{n.content}</p>
            </div>
            {(n.personal || user.role === "ADMIN") && (
              <button
                className="text-btn danger"
                onClick={() => remove(n, !n.personal)}
              >
                Eliminar
              </button>
            )}
          </article>
        ))}
        {current.classes.map((s) => (
          <div className="agenda-row" key={"c" + s.id}>
            <Clock size={18} />
            <div>
              <h3>
                {s.subject_name} · {s.group_name}
              </h3>
              <p>
                {s.starts_at.slice(0, 5)} – {s.ends_at.slice(0, 5)} ·{" "}
                {s.modality}
              </p>
            </div>
            <button className="text-btn" onClick={() => onCourse(s.course_id)}>
              Ver asignatura
              <ChevronRight size={14} />
            </button>
          </div>
        ))}
        {current.due.map((t) => (
          <div className="agenda-row" key={"t" + t.id}>
            <ClipboardList size={18} />
            <div>
              <h3>{t.title}</h3>
              <p>
                {t.course_name} · Entrega: {datetime(t.due_at)}
              </p>
            </div>
            <button className="text-btn" onClick={() => onCourse(t.course_id)}>
              Ver actividad
              <ChevronRight size={14} />
            </button>
          </div>
        ))}
        {!current.classes.length &&
          !current.due.length &&
          !current.notes.length &&
          !current.institutional.length && (
            <p className="muted small">
              No tienes actividades programadas para este día.
            </p>
          )}
      </section>
    </>
  );
}
