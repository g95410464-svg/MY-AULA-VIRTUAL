import { Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, datetime, roles, type Row, type User } from "./api";

export function DirectMessages({ user }: { user: User }) {
  const [conversations, setConversations] = useState<Row[]>([]),
    [selected, setSelected] = useState<number | null>(null),
    [data, setData] = useState<Row | null>(null),
    [recipients, setRecipients] = useState<Row[]>([]),
    [search, setSearch] = useState(""),
    [recipient, setRecipient] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const c = await api("/conversations");
    setConversations(c);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const poll = () =>
      refresh().catch((e) => {
        if (!cancelled) setError(e.message);
      });
    void poll();
    const id = setInterval(() => {
      void poll();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh]);
  useEffect(() => {
    if (user.role === "STUDENT") return;
    let cancelled = false;
    const id = setTimeout(
      () =>
        api(`/message-recipients?search=${encodeURIComponent(search)}`)
          .then((r) => {
            if (!cancelled) setRecipients(r);
          })
          .catch((e) => {
            if (!cancelled) setError(e.message);
          }),
      250,
    );
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [search, user.role]);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    if (selected === null) return;
    const fetchMessages = () =>
      api<Row>(`/conversations/${selected}/messages`)
        .then((r) => {
          if (!cancelled) {
            setData(r);
            setError("");
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setData(null);
            setError(e.message);
          }
        });
    void fetchMessages();
    const id = setInterval(() => {
      void fetchMessages();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selected, refresh]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const c = await api<Row>("/conversations", "POST", {
        recipientId: Number(recipient),
      });
      await refresh();
      setSelected(c.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      body = String(new FormData(form).get("body") ?? "").trim();
    if (!body || !selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/conversations/${selected}/messages`, "POST", { body });
      setData(await api<Row>(`/conversations/${selected}/messages`));
      form.reset();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel chat-panel">
      <h2>Mensajes privados</h2>
      <p className="muted">
        {user.role === "STUDENT"
          ? "Aquí puedes leer los mensajes de Administración. Estos mensajes no permiten respuesta."
          : user.role === "ADMIN"
            ? "Envía mensajes a la comunidad. Los alumnos reciben mensajes de solo lectura."
            : "Conversaciones privadas entre maestros y coordinadores de sus grupos."}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {user.role !== "STUDENT" && (
        <>
          <label>
            Buscar destinatario
            <input
              aria-label="Buscar destinatario"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setRecipient("");
              }}
            />
          </label>
          <label>
            Destinatario
            <select
              aria-label="Destinatario"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {recipients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {roles[p.role as User["role"]]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary"
            disabled={!recipient || busy}
            onClick={() => void start()}
          >
            Abrir conversación privada
          </button>
        </>
      )}
      <div className="catalog-chips">
        {conversations.map((c) => (
          <button
            className="chip"
            aria-pressed={selected === c.id}
            key={c.id}
            onClick={() => setSelected(c.id)}
          >
            {c.recipient_name}
            {c.read_only ? " · Solo lectura" : ""}
          </button>
        ))}
      </div>
      {!conversations.length && (
        <p className="muted">Todavía no tienes conversaciones privadas.</p>
      )}
      {selected && data && (
        <>
          <h3>
            {conversations.find((c) => c.id === selected)?.recipient_name}
          </h3>
          <div className="messages" aria-live="polite">
            {data.messages.map((m: Row) => (
              <article
                className={`message ${m.sender_id === user.id ? "own" : ""}`}
                key={m.id}
              >
                <div>
                  <small>{m.sender_name}</small>
                  <p>{m.body}</p>
                  <time>{datetime(m.created_at)}</time>
                </div>
              </article>
            ))}
            {!data.messages.length && (
              <p className="muted">La conversación aún no tiene mensajes.</p>
            )}
          </div>
          {data.readOnly ? (
            <p className="feedback">
              Solo lectura. No puedes responder a Administración.
            </p>
          ) : (
            <form className="chat-compose" onSubmit={(e) => void send(e)}>
              <input
                aria-label="Mensaje privado"
                name="body"
                maxLength={3000}
                required
                placeholder="Escribe un mensaje privado…"
              />
              <button
                className="primary"
                aria-label="Enviar mensaje privado"
                disabled={busy}
              >
                <Send size={18} />
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
