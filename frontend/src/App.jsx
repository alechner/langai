import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "/api/v1";

function formatApiDetail(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const path = Array.isArray(item.loc) ? item.loc.join(".") : "field";
          return item.msg ? `${path}: ${item.msg}` : JSON.stringify(item);
        }
        return String(item);
      })
      .join(" | ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return "Unexpected API error";
}

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function parseApiError(response) {
  let detail = `Request failed with ${response.status}`;
  try {
    const data = await response.json();
    if (data.detail) detail = formatApiDetail(data.detail);
  } catch (_error) {
    // keep default message
  }
  throw new Error(detail);
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [activeView, setActiveView] = useState("pronunciation");

  const [languages, setLanguages] = useState([]);
  const [languageCode, setLanguageCode] = useState("en");
  const [targetSentence, setTargetSentence] = useState("How are you today?");
  const [spokenText, setSpokenText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isSubmittingText, setIsSubmittingText] = useState(false);
  const [isSubmittingAudio, setIsSubmittingAudio] = useState(false);

  const [logs, setLogs] = useState([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const operationIdRef = useRef(0);
  const audioOperationIdRef = useRef(0);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`
    }),
    [token]
  );

  const isBusy = isSubmittingText || isSubmittingAudio;
  const isAdmin = Boolean(currentUser?.is_admin);

  function saveToken(newToken) {
    setToken(newToken);
    localStorage.setItem("token", newToken);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setCurrentUser(null);
    setResult(null);
    setStatusMessage("");
    setActiveView("pronunciation");
  }

  useEffect(() => {
    if (!token) return;

    async function bootstrap() {
      try {
        setError("");
        const [meResponse, languagesResponse] = await Promise.all([
          fetch(`${API_BASE}/users/me`, { headers: authHeaders }),
          fetch(`${API_BASE}/languages`, { headers: authHeaders })
        ]);
        if (!meResponse.ok) await parseApiError(meResponse);
        if (!languagesResponse.ok) await parseApiError(languagesResponse);

        const me = await meResponse.json();
        const languagesData = await languagesResponse.json();
        setCurrentUser(me);
        setLanguages(languagesData);
        if (languagesData[0]) setLanguageCode(languagesData[0].code);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    }

    bootstrap();
  }, [token, authHeaders]);

  useEffect(() => {
    if (activeView !== "logs" || !isAdmin || logsLoaded || !token) return;

    async function loadLogs() {
      try {
        setIsLoadingLogs(true);
        setError("");
        const response = await fetch(`${API_BASE}/admin/logs?limit=200`, { headers: authHeaders });
        if (!response.ok) await parseApiError(response);
        setLogs(await response.json());
        setLogsLoaded(true);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoadingLogs(false);
      }
    }

    loadLogs();
  }, [activeView, authHeaders, isAdmin, logsLoaded, token]);

  useEffect(() => {
    if (activeView !== "users" || !isAdmin || usersLoaded || !token) return;

    async function loadUsers() {
      try {
        setIsLoadingUsers(true);
        setError("");
        const response = await fetch(`${API_BASE}/users/admin`, { headers: authHeaders });
        if (!response.ok) await parseApiError(response);
        setUsers(await response.json());
        setUsersLoaded(true);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoadingUsers(false);
      }
    }

    loadUsers();
  }, [activeView, authHeaders, isAdmin, token, usersLoaded]);

  async function register(event) {
    event.preventDefault();
    try {
      setError("");
      if (!fullName.trim()) {
        throw new Error("Full name is required to register.");
      }
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName, password })
      });
      if (!response.ok) await parseApiError(response);
      await loginWithPassword();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function loginWithPassword(event) {
    if (event) event.preventDefault();
    try {
      setError("");
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);

      const response = await fetch(`${API_BASE}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      if (!response.ok) await parseApiError(response);
      const data = await response.json();
      saveToken(data.access_token);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function evaluateText(event) {
    event.preventDefault();
    if (isBusy) return;
    const operationId = ++operationIdRef.current;

    try {
      setError("");
      setStatusMessage("Analisando texto... aguarde.");
      setIsSubmittingText(true);
      const response = await fetch(`${API_BASE}/practice/evaluate`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          language_code: languageCode,
          target_sentence: targetSentence,
          spoken_text: spokenText
        })
      });
      if (!response.ok) await parseApiError(response);
      const data = await response.json();
      if (operationId !== operationIdRef.current) return;
      setResult(data);
      setStatusMessage("");
    } catch (err) {
      setError(getErrorMessage(err));
      setStatusMessage("");
    } finally {
      setIsSubmittingText(false);
    }
  }

  async function evaluateAudio(chunks, operationId) {
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: "audio/webm" });
    const formData = new FormData();
    formData.append("language_code", languageCode);
    formData.append("target_sentence", targetSentence);
    formData.append("audio", blob, "attempt.webm");

    const response = await fetch(`${API_BASE}/practice/evaluate-audio`, {
      method: "POST",
      headers: authHeaders,
      body: formData
    });
    if (!response.ok) await parseApiError(response);
    const data = await response.json();
    if (operationId !== operationIdRef.current) return;
    setSpokenText(data.transcript);
    setResult(data);
    setStatusMessage("");
  }

  async function startRecording() {
    if (isBusy) return;
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        try {
          await evaluateAudio(chunks, audioOperationIdRef.current);
        } catch (err) {
          setError(getErrorMessage(err));
          setStatusMessage("");
        } finally {
          setIsSubmittingAudio(false);
        }
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function stopRecordingAndEvaluate() {
    if (!mediaRecorder || isSubmittingAudio) return;
    audioOperationIdRef.current = ++operationIdRef.current;
    mediaRecorder.stop();
    setRecording(false);
    setIsSubmittingAudio(true);
    setStatusMessage("Analisando áudio... aguarde.");
  }

  async function toggleAdmin(targetUser) {
    try {
      setError("");
      const response = await fetch(`${API_BASE}/users/admin/${targetUser.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ is_admin: !targetUser.is_admin })
      });
      if (!response.ok) await parseApiError(response);
      const updatedUser = await response.json();
      setUsers((previousUsers) =>
        previousUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user))
      );
      if (currentUser && currentUser.id === updatedUser.id) {
        setCurrentUser(updatedUser);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (!token) {
    return (
      <main className="container">
        <h1>LangAI Family</h1>
        <p>Register or sign in to practice pronunciation.</p>
        <form onSubmit={loginWithPassword} className="card">
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="row">
            <button type="submit">Sign in</button>
            <button type="button" onClick={register}>
              Register
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>LangAI Family</h1>
        <div className="topbar-right">
          <span>{currentUser ? `${currentUser.full_name} (${currentUser.email})` : "Loading user..."}</span>
          <button className="ghost" onClick={logout}>
            Logoff
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar card">
          <button
            className={activeView === "pronunciation" ? "menu-button active" : "menu-button"}
            onClick={() => setActiveView("pronunciation")}
          >
            Pronúncia
          </button>
          {isAdmin && (
            <button
              className={activeView === "logs" ? "menu-button active" : "menu-button"}
              onClick={() => setActiveView("logs")}
            >
              Logs
            </button>
          )}
          {isAdmin && (
            <button
              className={activeView === "users" ? "menu-button active" : "menu-button"}
              onClick={() => setActiveView("users")}
            >
              Usuários
            </button>
          )}
        </aside>

        <main className="content">
          {error && <p className="error">{error}</p>}

          {activeView === "pronunciation" && (
            <>
              <form onSubmit={evaluateText} className="card">
                <label>Language</label>
                <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)}>
                  {languages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.name}
                    </option>
                  ))}
                </select>

                <label>Target sentence</label>
                <textarea value={targetSentence} onChange={(e) => setTargetSentence(e.target.value)} rows={2} />

                <label>Spoken text (manual mode)</label>
                <textarea value={spokenText} onChange={(e) => setSpokenText(e.target.value)} rows={2} />

                <div className="row">
                  <button type="submit" disabled={isBusy}>
                    Evaluate text
                  </button>
                  {!recording ? (
                    <button type="button" onClick={startRecording} disabled={isBusy}>
                      Record audio
                    </button>
                  ) : (
                    <button type="button" onClick={stopRecordingAndEvaluate} disabled={isSubmittingAudio}>
                      Stop + evaluate audio
                    </button>
                  )}
                </div>
                {statusMessage && <p className="status">{statusMessage}</p>}
              </form>

              {result && (
                <section className="card">
                  <h2>Feedback</h2>
                  <p>
                    <strong>Transcript:</strong> {result.transcript}
                  </p>
                  <p>
                    <strong>Similarity:</strong> {result.similarity_score}
                  </p>
                  <p>
                    <strong>Pronunciation:</strong> {result.pronunciation_score}
                  </p>
                  <p>
                    <strong>Coach feedback:</strong> {result.feedback}
                  </p>
                </section>
              )}
            </>
          )}

          {activeView === "logs" && isAdmin && (
            <section className="card">
              <h2>Logs da aplicação</h2>
              {isLoadingLogs ? (
                <p>Carregando logs...</p>
              ) : (
                <div className="logs-list">
                  {logs.map((logEntry, index) => (
                    <pre key={`${logEntry.timestamp}-${index}`} className="log-entry">
                      [{new Date(logEntry.timestamp).toLocaleString()}] {logEntry.level} {logEntry.logger}:{" "}
                      {logEntry.message}
                    </pre>
                  ))}
                  {!logs.length && <p>Nenhum log disponível.</p>}
                </div>
              )}
            </section>
          )}

          {activeView === "users" && isAdmin && (
            <section className="card">
              <h2>Administração de usuários</h2>
              {isLoadingUsers ? (
                <p>Carregando usuários...</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Perfil</th>
                      <th>Criado em</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.full_name}</td>
                        <td>{user.email}</td>
                        <td>{user.is_admin ? "Administrador" : "Usuário"}</td>
                        <td>{new Date(user.created_at).toLocaleString()}</td>
                        <td>
                          <button type="button" onClick={() => toggleAdmin(user)}>
                            {user.is_admin ? "Remover admin" : "Tornar admin"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!users.length && (
                      <tr>
                        <td colSpan={5}>Nenhum usuário encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
