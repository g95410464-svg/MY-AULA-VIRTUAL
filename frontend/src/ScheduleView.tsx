import { useEffect, useState } from "react";
import { api, type Row, type User, hasRole } from "./api";
import type { Field, OpenForm } from "./ui";

const days = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const minutes = (s: string) =>
  Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const time = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export function ScheduleView({
  user,
  catalog,
  openForm,
  management = false,
}: {
  user: User;
  catalog: Row;
  openForm: OpenForm;
  management?: boolean;
}) {
  const admin = hasRole(user, "ADMIN"),
    coordinator = hasRole(user, "COORDINATOR");
  const selector = admin || management;
  const teachers = (catalog.people ?? []).filter(
    (p: Row) => p.active && hasRole(p as User, "TEACHER"),
  );
  const [teacher, setTeacher] = useState(""),
    [search, setSearch] = useState("");
  const [blocks, setBlocks] = useState<Row[]>([]),
    [breaks, setBreaks] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const teacherId = selector ? Number(teacher) : user.id;
  useEffect(() => {
    let cancelled = false;
    setError("");
    setBlocks([]);
    setBreaks([]);
    if (selector && !teacherId) return;
    setBusy(true);
    const query = selector ? `?teacherId=${teacherId}` : "";
    Promise.all([
      api(`/schedules${query}`),
      user.role === "STUDENT"
        ? Promise.resolve([])
        : api(`/schedule-breaks${query}`),
    ])
      .then(([s, b]) => {
        if (!cancelled) {
          setBlocks(s);
          setBreaks(b);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teacherId, selector, user.id, user.role, revision]);
  const courses = (catalog.courses ?? []).filter(
    (c: Row) => c.teacher_id === teacherId,
  );
  const canEdit = (c: Row) =>
    admin ||
    (coordinator &&
      catalog.groups?.some((g: Row) => g.id === c.group_id && g.can_manage));
  const editable = courses.filter(canEdit);
  const dayField: Field = {
    key: "weekday",
    label: "Día",
    type: "select-number",
    required: true,
    options: days.map((label, i) => ({ label, value: i + 1 })),
  };
  function edit(block?: Row) {
    openForm(
      block ? "Editar bloque de clase" : "Programar clase",
      [
        {
          key: "courseId",
          label: "Asignatura y grupo",
          type: "select-number",
          required: true,
          value: block?.course_id,
          options: (block
            ? courses.filter((c: Row) => c.id === block.course_id)
            : editable
          ).map((c: Row) => ({
            value: c.id,
            label: `${c.name} · ${c.group_name}`,
          })),
        },
        { ...dayField, value: block?.weekday },
        {
          key: "startsAt",
          label: "Hora de inicio",
          type: "time",
          required: true,
          value: block?.starts_at?.slice(0, 5),
        },
        {
          key: "endsAt",
          label: "Hora final",
          type: "time",
          required: true,
          value: block?.ends_at?.slice(0, 5),
        },
        {
          key: "modality",
          label: "Modalidad",
          value: block?.modality,
          required: true,
          options: [
            { value: "PRESENCIAL", label: "Presencial" },
            { value: "VIRTUAL", label: "Virtual" },
            { value: "HIBRIDA", label: "Híbrida" },
          ],
        },
        {
          key: "url",
          label: "Enlace (opcional)",
          type: "url",
          value: block?.url,
        },
      ],
      async (v) => {
        await api(
          block ? `/schedules/${block.id}` : "/schedules",
          block ? "PUT" : "POST",
          v,
        );
        setRevision((n) => n + 1);
      },
    );
  }
  function remove(block: Row, recess = false) {
    openForm(
      recess ? "Retirar receso" : "Retirar clase del horario",
      [],
      async () => {
        await api(
          `/${recess ? "schedule-breaks" : "schedules"}/${block.id}`,
          "DELETE",
        );
        setRevision((n) => n + 1);
      },
      "Se retirará únicamente este bloque del horario semanal.",
    );
  }
  return (
    <>
      <section className="panel">
        <div className="section-head">
          <h2>{selector ? "Horario por docente" : "Mi horario semanal"}</h2>
          {selector && teacherId > 0 && editable.length > 0 && (
            <button className="primary" onClick={() => edit()}>
              Programar clase
            </button>
          )}
        </div>
        {selector && (
          <>
            <label>
              Buscar docente
              <input
                aria-label="Buscar docente"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre del maestro"
              />
            </label>
            <label>
              Docente
              <select
                aria-label="Docente del horario"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
              >
                <option value="">Selecciona un docente</option>
                {teachers
                  .filter(
                    (p: Row) =>
                      p.name
                        .toLocaleLowerCase()
                        .includes(search.toLocaleLowerCase()) ||
                      String(p.id) === teacher,
                  )
                  .map((p: Row) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}
        {selector && !teacherId && (
          <p className="muted">
            Selecciona un maestro para consultar y editar sus bloques.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {busy && <p role="status">Cargando horario…</p>}
        {selector && teacherId > 0 && editable.length > 0 && (
          <button
            className="secondary"
            onClick={() =>
              openForm(
                "Agregar receso",
                [
                  {
                    key: "title",
                    label: "Título",
                    required: true,
                    value: "Receso",
                  },
                  dayField,
                  {
                    key: "startsAt",
                    label: "Hora de inicio",
                    type: "time",
                    required: true,
                  },
                  {
                    key: "endsAt",
                    label: "Hora final",
                    type: "time",
                    required: true,
                  },
                ],
                async (v) => {
                  await api("/schedule-breaks", "POST", { ...v, teacherId });
                  setRevision((n) => n + 1);
                },
              )
            }
          >
            Agregar receso
          </button>
        )}
      </section>
      {(!selector || teacherId > 0) && !busy && (
        <div className="week-grid">
          {days.map((day, i) => {
            const entries: Row[] = [
              ...blocks
                .filter((b) => b.weekday === i + 1)
                .map((b) => ({ ...b, recess: false })),
              ...breaks
                .filter((b) => b.weekday === i + 1)
                .map((b) => ({ ...b, recess: true })),
            ].sort((a: Row, b: Row) => a.starts_at.localeCompare(b.starts_at));
            const rows: Row[] = [];
            let cursor = Math.min(
              420,
              ...entries.map((b) => minutes(b.starts_at)),
            );
            const end = Math.max(
              960,
              ...entries.map((b) => minutes(b.ends_at)),
            );
            for (const b of entries) {
              const start = minutes(b.starts_at);
              if (start > cursor)
                rows.push({
                  free: true,
                  starts_at: time(cursor),
                  ends_at: time(start),
                });
              rows.push(b);
              cursor = Math.max(cursor, minutes(b.ends_at));
            }
            if (cursor < end)
              rows.push({
                free: true,
                starts_at: time(cursor),
                ends_at: time(end),
              });
            return (
              <section className="week-day" key={day}>
                <h3>{day}</h3>
                {rows.map((b, j) => (
                  <article className="schedule-card" key={j}>
                    <small>
                      {b.starts_at.slice(0, 5)} – {b.ends_at.slice(0, 5)}
                    </small>
                    <h3>
                      {b.free
                        ? "Bloque libre"
                        : b.recess
                          ? b.title
                          : b.subject_name}
                    </h3>
                    {!b.free && !b.recess && (
                      <>
                        <p>{b.group_name}</p>
                        <span className="badge gray">
                          {b.modality === "HIBRIDA"
                            ? "Híbrida"
                            : b.modality === "VIRTUAL"
                              ? "Virtual"
                              : "Presencial"}
                        </span>
                        {b.url && /^https?:\/\//i.test(b.url) && (
                          <a
                            href={b.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Acceder a clase
                          </a>
                        )}
                      </>
                    )}
                    {!b.free &&
                      selector &&
                      (b.recess
                        ? editable.length > 0
                        : canEdit(
                            courses.find((c: Row) => c.id === b.course_id) ??
                              {},
                          )) && (
                        <div className="form-actions">
                          {!b.recess && (
                            <button
                              className="text-btn"
                              onClick={() => edit(b)}
                            >
                              Editar
                            </button>
                          )}
                          <button
                            className="text-btn danger"
                            onClick={() => remove(b, b.recess)}
                          >
                            Retirar
                          </button>
                        </div>
                      )}
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
