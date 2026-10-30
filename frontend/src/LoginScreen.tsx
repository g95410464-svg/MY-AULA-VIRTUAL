import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { login, type User } from "./api";
import "./login-figma.css";

export default function LoginScreen({
  onLogin,
}: {
  onLogin: (user: User) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState<"password" | "account" | null>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (help) helpDialog.current?.showModal();
    else helpDialog.current?.close();
  }, [help]);

  return (
    <div className="figma-login" data-figma-node="102:29">
      <section className="fl-main" aria-label="Acceso a Tu Aula Virtual">
        <div className="fl-stack">
          <header className="fl-intro">
            <h1>
              Tu Aula Virtual <span aria-hidden="true">👋</span>
            </h1>
            <p>
              Un espacio para aprender y enseñar.
              <br />
              Ingresa con tu cuenta institucional.
            </p>
          </header>

          <form
            className="fl-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              setBusy(true);
              setError("");
              try {
                onLogin(
                  await login(
                    String(values.get("email")),
                    String(values.get("password")),
                  ),
                );
              } catch (failure) {
                setError((failure as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="login-email">
              Correo electrónico
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="nombre@institucion.edu"
                required
              />
            </label>
            <label htmlFor="login-password">
              Contraseña
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Tu contraseña"
                required
              />
            </label>
            <button
              type="button"
              className="fl-forgot"
              onClick={() => setHelp("password")}
            >
              ¿Olvidaste tu contraseña?
            </button>
            {error && (
              <p className="fl-error" role="alert">
                {error}
              </p>
            )}
            <button className="fl-submit" disabled={busy}>
              {busy ? "Ingresando…" : "Entrar a mi aula"}
            </button>
          </form>

          <p className="fl-account">
            ¿No tienes cuenta?{" "}
            <button type="button" onClick={() => setHelp("account")}>
              Solicita acceso
            </button>
          </p>
        </div>

        <div className="fl-footer">
          <span>© {new Date().getFullYear()} Tu Aula Virtual</span>
          <small>
            Diseño de acceso:{" "}
            <a
              href="https://www.figma.com/community/file/1249321675959577741/login-page"
              target="_blank"
              rel="noopener noreferrer"
            >
              Marwan
            </a>{" "}
            ·{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 4.0
            </a>
          </small>
        </div>
      </section>

      <picture className="fl-art" data-illustration="school-emblem">
        <source
          media="(max-width: 900px)"
          srcSet="/assets/school/colegio-horizonte-mobile.svg"
        />
        <img
          src="/assets/school/colegio-horizonte-desktop.svg"
          alt="Colegio Horizonte, institución ficticia. Un libro y una pantalla representan el aula virtual."
          fetchPriority="high"
        />
      </picture>

      <dialog
        className="fl-help"
        ref={helpDialog}
        onClose={() => setHelp(null)}
        aria-labelledby="access-help-title"
      >
        <div className="fl-help-heading">
          <h2 id="access-help-title">
            {help === "password"
              ? "Recupera tu acceso"
              : "Únete a Tu Aula Virtual"}
          </h2>
          <button
            type="button"
            aria-label="Cerrar ayuda"
            onClick={() => setHelp(null)}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          {help === "password"
            ? "Solicita al administrador de tu institución que restablezca tu contraseña. Recibirás una contraseña temporal y deberás cambiarla al ingresar."
            : "La administración de tu institución crea las cuentas y asigna el rol y los grupos correspondientes. Solicita tu cuenta al responsable académico."}
        </p>
        <button
          type="button"
          className="fl-submit"
          onClick={() => setHelp(null)}
        >
          Entendido
        </button>
      </dialog>
    </div>
  );
}
