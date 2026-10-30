import { useEffect, useRef } from "react";
import { datetime, type Row } from "./api";

export function SubmissionDetail({
  submission: s,
  onClose,
}: {
  submission: Row;
  onClose: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const all = Array.from(
          root.current?.querySelectorAll<HTMLElement>("button,a[href]") ?? [],
        );
        if (e.shiftKey && document.activeElement === all[0]) {
          e.preventDefault();
          all.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
          e.preventDefault();
          all[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop">
      <section
        ref={root}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-title"
      >
        <div className="section-head">
          <h2 id="submission-title">Detalle de entrega</h2>
          <button
            className="icon-btn"
            aria-label="Cerrar detalle"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <h3>{s.task_title}</h3>
        <p>{s.student_name}</p>
        <p>Entregada: {datetime(s.submitted_at)}</p>
        <p>
          {s.score == null
            ? "Pendiente de calificar"
            : `Calificación: ${s.score} / ${s.max_score}`}
        </p>
        {s.feedback && (
          <p className="instructions">Observaciones: {s.feedback}</p>
        )}
        {s.file_id && (
          <div className="form-actions">
            <a className="file-link" href={`/api/files/${s.file_id}`} download>
              {s.file_name ?? "Descargar adjunto"}
            </a>
            {["application/pdf", "image/png", "image/jpeg"].includes(
              s.file_mime,
            ) && (
              <a
                className="file-link"
                href={`/api/files/${s.file_id}?preview=true`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Vista previa
              </a>
            )}
          </div>
        )}
        {s.url && /^https?:\/\//i.test(s.url) && (
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            Abrir trabajo entregado
          </a>
        )}
      </section>
    </div>
  );
}
