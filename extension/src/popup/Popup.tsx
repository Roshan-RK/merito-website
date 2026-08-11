import { useEffect, useState } from "react";

const JD_STORAGE_KEY = "meritoJdText";
const EMAIL_STORAGE_KEY = "meritoRecruiterEmail";
const LEVEL_STORAGE_KEY = "meritoCandidateLevel";
const SANS = "-apple-system, 'Segoe UI', Roboto, sans-serif";
const LEVELS: { value: "entry" | "mid" | "senior"; label: string }[] = [
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
];

export function Popup() {
  const [jdText, setJdText] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<"entry" | "mid" | "senior">("mid");
  const [saved, setSaved] = useState(false);
  const [verifySent, setVerifySent] = useState(false);

  useEffect(() => {
    chrome.storage.local.get([JD_STORAGE_KEY, EMAIL_STORAGE_KEY, LEVEL_STORAGE_KEY]).then((result) => {
      setJdText((result[JD_STORAGE_KEY] as string) ?? "");
      setEmail((result[EMAIL_STORAGE_KEY] as string) ?? "");
      setLevel((result[LEVEL_STORAGE_KEY] as "entry" | "mid" | "senior") ?? "mid");
    });
  }, []);

  function save() {
    chrome.storage.local
      .set({ [JD_STORAGE_KEY]: jdText, [EMAIL_STORAGE_KEY]: email, [LEVEL_STORAGE_KEY]: level })
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      });
  }

  function clear() {
    setJdText("");
    chrome.storage.local.remove(JD_STORAGE_KEY);
  }

  async function sendVerification() {
    if (!email.trim()) return;
    await chrome.runtime.sendMessage({ type: "VERIFY_RECRUITER_EMAIL", email: email.trim() });
    setVerifySent(true);
  }

  return (
    <div style={{ padding: 16, fontFamily: SANS, width: 320, boxSizing: "border-box" }}>
      <h2 style={{ fontSize: 14, margin: "0 0 8px" }}>Score against your JD</h2>
      <p style={{ fontSize: 11.5, color: "#6C6779", margin: "0 0 8px" }}>
        Your email is used to confirm you're a recruiter before scoring profiles that aren't yet on Merito
        (10/month). If you don&apos;t see a confirmation email, check spam.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: 8, fontFamily: SANS, marginBottom: 6 }}
      />
      <button onClick={sendVerification} style={{ width: "100%", marginBottom: 8 }}>
        {verifySent ? "Verification email sent" : "Confirm email"}
      </button>
      <label style={{ fontSize: 11.5, color: "#6C6779" }}>Candidate level for scoring</label>
      <select
        value={level}
        onChange={(e) => setLevel(e.target.value as "entry" | "mid" | "senior")}
        style={{ width: "100%", fontSize: 12, padding: 6, marginBottom: 8 }}
      >
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
      <textarea
        value={jdText}
        onChange={(e) => setJdText(e.target.value)}
        rows={10}
        style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: 8, fontFamily: SANS }}
        placeholder="Paste job description..."
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={save} style={{ flex: 1 }}>
          {saved ? "Saved" : "Save"}
        </button>
        <button onClick={clear}>Clear</button>
      </div>
    </div>
  );
}
