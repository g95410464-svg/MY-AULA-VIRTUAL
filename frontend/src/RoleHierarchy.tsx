import { useEffect, useState } from "react";
import { api, roles, type Row, type User } from "./api";

export function RoleHierarchy() {
  const [model, setModel] = useState<Row | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    api<Row>("/access-model")
      .then((value) => {
        if (!cancelled) setModel(value);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (error)
    return (
      <p role="alert" className="error">
        {error}
      </p>
    );
  if (!model) return <p role="status">Cargando jerarquía y permisos…</p>;
  return (
    <>
      <section className="panel">
        <h2>Mi acceso</h2>
        <p>
          Rol principal:{" "}
          <strong>{roles[model.current.primaryRole as User["role"]]}</strong>
        </p>
        <p>
          Roles efectivos:{" "}
          {model.current.effectiveRoles
            .map((role: User["role"]) => roles[role])
            .join(" + ")}
        </p>
        <p className="muted">
          El nivel indica responsabilidad institucional. Cada operación valida
          también tus roles, grupos, asignaciones y propiedad de los datos.
        </p>
      </section>
      <section className="panel">
        <h2>Jerarquía institucional</h2>
        {model.hierarchy.map((profile: Row) => (
          <article className="group-line" key={profile.role}>
            <span className="badge purple">
              Nivel {profile.organizationLevel}
            </span>
            <div>
              <h3>{profile.label}</h3>
              <p>{profile.responsibility}</p>
            </div>
          </article>
        ))}
        <p className="feedback">
          Administrador y Coordinador necesitan también el rol Maestro para
          impartir clases y calificar sus materias asignadas. Las anotaciones
          personales y conversaciones privadas conservan sus restricciones de
          acceso.
        </p>
      </section>
      <section className="panel">
        <h2>Matriz de permisos por rol</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Acción</th>
                <th>Administrador</th>
                <th>Coordinador</th>
                <th>Maestro</th>
                <th>Alumno</th>
              </tr>
            </thead>
            <tbody>
              {model.permissions.map((permission: Row) => (
                <tr key={permission.action}>
                  <td>{permission.action}</td>
                  <td>{permission.admin}</td>
                  <td>{permission.coordinator}</td>
                  <td>{permission.teacher}</td>
                  <td>{permission.student}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
