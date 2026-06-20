import { useEffect, useMemo, useState } from "react";

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
  const [languages, setLanguages] = useState([]);
  const [languageCode, setLanguageCode] = useState("en");
  const [targetSentence, setTargetSentence] = useState("How are you today?");
  const [spokenText, setSpokenText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`
    }),
    [token]
  );

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/languages`, { headers: authHeaders })
      .then((response) => {
        if (!response.ok) return parseApiError(response);
        return response.json();
      })
      .then((data) => {
        setLanguages(data);
        if (data[0]) setLanguageCode(data[0].code);
      })
      .catch((err) => setError(err.message));
  }, [token, authHeaders]);

  function saveToken(newToken) {
    setToken(newToken);
    localStorage.setItem("token", newToken);
  }

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
    try {
      setError("");
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
      setResult(await response.json());
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function evaluateAudio(chunks) {
    if (!chunks.length) return;
    setError("");
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
    if (!response.ok) return parseApiError(response);
    const data = await response.json();
    setSpokenText(data.transcript);
    setResult(data);
  }

  async function startRecording() {
    setError("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      try {
        await evaluateAudio(chunks);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    };
    recorder.start();
    setMediaRecorder(recorder);
    setRecording(true);
  }

  async function stopRecordingAndEvaluate() {
    if (!mediaRecorder) return;
    mediaRecorder.stop();
    setRecording(false);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setResult(null);
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
    <main className="container">
      <h1>LangAI Family</h1>
      <button className="ghost" onClick={logout}>
        Sign out
      </button>
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
          <button type="submit">Evaluate text</button>
          {!recording ? (
            <button type="button" onClick={startRecording}>
              Record audio
            </button>
          ) : (
            <button type="button" onClick={stopRecordingAndEvaluate}>
              Stop + evaluate audio
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
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
    </main>
  );
}
